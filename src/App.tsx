import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { MessageItem } from './components/MessageItem';
import { MessageInput } from './components/MessageInput';
import { InfoModal } from './components/InfoModal';
import { ChatMessage, WsMessageEvent } from './types';
import { soundPlayer } from './lib/audio';
import {
  getOrCreateAnonymousToken,
  getSoundPreference,
  setSoundPreference,
} from './lib/storage';
import { ArrowDown, MessageSquareOff } from 'lucide-react';

const INITIAL_FALLBACK_MESSAGES: ChatMessage[] = [
  {
    id: "msg-init-1",
    serialNumber: 1,
    text: "Welcome to Anonymous Live Chat! 👋 No accounts, no user details. Completely open for everyone.",
    createdAt: Date.now() - 1000 * 60 * 15,
    reactions: { "👋": 4, "✨": 3 },
  },
  {
    id: "msg-init-2",
    serialNumber: 2,
    text: "Every message is recorded in serial order. Anyone who opens or downloads this app will see the real-time continuous stream.",
    createdAt: Date.now() - 1000 * 60 * 10,
    reactions: { "❤️": 2, "🔥": 5 },
  },
  {
    id: "msg-init-3",
    serialNumber: 3,
    text: "Say whatever is on your mind! Keep it respectful and enjoy true anonymous freedom. 💬",
    createdAt: Date.now() - 1000 * 60 * 4,
    reactions: { "💡": 3 },
  },
];

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    // Check local backup cache if any
    try {
      const cached = localStorage.getItem('anon_local_messages_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return INITIAL_FALLBACK_MESSAGES;
  });

  const [onlineCount, setOnlineCount] = useState<number>(3);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(getSoundPreference());
  const [isInfoOpen, setIsInfoOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isUserScrolledUp, setIsUserScrolledUp] = useState<boolean>(false);
  const [newMessagesWhileScrolled, setNewMessagesWhileScrolled] = useState<number>(0);

  const authorToken = useMemo(() => getOrCreateAnonymousToken(), []);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isWsSupported = useRef<boolean>(true);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Sync to local backup storage whenever messages change
  useEffect(() => {
    try {
      if (messages.length > 0) {
        localStorage.setItem('anon_local_messages_cache', JSON.stringify(messages));
      }
    } catch {
      // ignore quota errors
    }
  }, [messages]);

  // BroadcastChannel for instant cross-tab sync on Vercel/serverless
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('anon_chat_sync');
        broadcastChannelRef.current = channel;

        channel.onmessage = (event) => {
          if (event.data?.type === 'new_message') {
            const newMsg = event.data.message;
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id || m.serialNumber === newMsg.serialNumber)) {
                return prev;
              }
              return [...prev, newMsg];
            });
          } else if (event.data?.type === 'reaction') {
            const { id, emoji } = event.data;
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== id) return m;
                return {
                  ...m,
                  reactions: {
                    ...(m.reactions || {}),
                    [emoji]: ((m.reactions || {})[emoji] || 0) + 1,
                  },
                };
              })
            );
          }
        };

        return () => {
          channel.close();
        };
      } catch (e) {
        console.warn('BroadcastChannel error:', e);
      }
    }
  }, []);

  // Toggle sound
  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabledState(next);
    setSoundPreference(next);
  };

  // Scroll to bottom smoothly
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    setNewMessagesWhileScrolled(0);
    setIsUserScrolledUp(false);
  };

  // Detect scroll position
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isUp = distanceFromBottom > 150;
    setIsUserScrolledUp(isUp);
    if (!isUp) {
      setNewMessagesWhileScrolled(0);
    }
  };

  // Fetch full message list via REST
  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/messages');
      if (res.ok) {
        const data = await res.json();
        if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages((prev) => {
            // Merge & preserve newest
            const map = new Map<string, ChatMessage>();
            prev.forEach((m) => map.set(m.id, m));
            data.messages.forEach((m: ChatMessage) => map.set(m.id, m));
            const merged = Array.from(map.values()).sort(
              (a, b) => a.serialNumber - b.serialNumber
            );
            return merged;
          });
        }
        if (data.onlineCount) {
          setOnlineCount(data.onlineCount);
        }
        setIsConnected(true);
      } else {
        // Still connected locally
        setIsConnected(true);
      }
    } catch {
      // Local state is still active
      setIsConnected(true);
    }
  }, []);

  // WebSocket Connection Lifecycle with graceful fallback to Polling
  const connectWebSocket = useCallback(() => {
    if (!isWsSupported.current) return;

    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        // If WS opens, stop fast polling
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          // Set slower background polling as backup
          pollingIntervalRef.current = setInterval(fetchMessages, 8000);
        }
      };

      ws.onmessage = (event) => {
        try {
          const data: WsMessageEvent = JSON.parse(event.data);

          if (data.type === 'init') {
            if (data.payload?.messages && Array.isArray(data.payload.messages)) {
              setMessages(data.payload.messages);
            }
            if (data.payload?.onlineCount) {
              setOnlineCount(data.payload.onlineCount);
            }
          } else if (data.type === 'presence:update') {
            if (data.payload?.onlineCount) {
              setOnlineCount(data.payload.onlineCount);
            }
          } else if (data.type === 'message:created') {
            const newMsg: ChatMessage = data.payload;
            setMessages((prev) => {
              if (
                prev.some(
                  (m) => m.id === newMsg.id || m.serialNumber === newMsg.serialNumber
                )
              ) {
                return prev.map((m) =>
                  m.id === newMsg.id || m.serialNumber === newMsg.serialNumber
                    ? newMsg
                    : m
                );
              }
              return [...prev, newMsg];
            });

            if (newMsg.authorToken !== authorToken && soundEnabled) {
              soundPlayer.playPop();
            }

            if (containerRef.current) {
              const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
              const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
              if (isNearBottom || newMsg.authorToken === authorToken) {
                setTimeout(() => scrollToBottom('smooth'), 50);
              } else {
                setNewMessagesWhileScrolled((c) => c + 1);
              }
            }
          } else if (data.type === 'message:reaction') {
            const { id, reactions } = data.payload;
            setMessages((prev) =>
              prev.map((m) => (m.id === id ? { ...m, reactions } : m))
            );
          }
        } catch (err) {
          console.error('Error handling WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        // On serverless hosts (like Vercel) where WebSocket is unavailable,
        // switch gracefully to Real-Time Polling without showing an error!
        setIsConnected(true);
      };

      ws.onerror = () => {
        ws.close();
        isWsSupported.current = false;
        setIsConnected(true);
      };
    } catch {
      isWsSupported.current = false;
      setIsConnected(true);
    }
  }, [authorToken, fetchMessages, soundEnabled]);

  useEffect(() => {
    fetchMessages();
    connectWebSocket();

    // Start auto-sync polling every 2.5s to ensure continuous real-time sync
    pollingIntervalRef.current = setInterval(fetchMessages, 2500);

    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket, fetchMessages]);

  // Initial scroll to bottom once messages load
  useEffect(() => {
    if (messages.length > 0 && !isUserScrolledUp) {
      scrollToBottom('auto');
    }
  }, []);

  // Send message handler
  const handleSendMessage = async (
    text: string,
    replyTo?: { serialNumber: number; text: string } | null
  ) => {
    setIsSending(true);
    if (soundEnabled) {
      soundPlayer.playSend();
    }

    const nextSerial =
      messages.length > 0
        ? Math.max(...messages.map((m) => m.serialNumber)) + 1
        : 1;

    const localMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      serialNumber: nextSerial,
      text: text.trim(),
      createdAt: Date.now(),
      authorToken,
      reactions: {},
      replyTo: replyTo || null,
    };

    // Optimistically add to UI immediately
    setMessages((prev) => [...prev, localMsg]);
    setTimeout(() => scrollToBottom('smooth'), 50);

    // Broadcast cross-tab
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type: 'new_message',
        message: localMsg,
      });
    }

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          authorToken,
          replyTo,
        }),
      });

      if (res.ok) {
        const createdMsg = await res.json();
        setMessages((prev) =>
          prev.map((m) => (m.id === localMsg.id ? createdMsg : m))
        );
      }
    } catch {
      // Local message remains intact
    } finally {
      setIsSending(false);
    }
  };

  // Add reaction handler
  const handleReact = async (messageId: string, emoji: string) => {
    // Optimistic reaction
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const currentCount = m.reactions?.[emoji] || 0;
        return {
          ...m,
          reactions: {
            ...(m.reactions || {}),
            [emoji]: currentCount + 1,
          },
        };
      })
    );

    // Broadcast reaction cross-tab
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type: 'reaction',
        id: messageId,
        emoji,
      });
    }

    try {
      await fetch(`/api/messages/${messageId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      });
    } catch {
      // Silently keep optimistic reaction
    }
  };

  // Filter messages according to search query or serial number
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const query = searchQuery.toLowerCase().trim();

    const isSerialSearch = query.startsWith('#')
      ? parseInt(query.slice(1), 10)
      : /^\d+$/.test(query)
      ? parseInt(query, 10)
      : null;

    return messages.filter((msg) => {
      if (isSerialSearch !== null && !isNaN(isSerialSearch)) {
        if (msg.serialNumber === isSerialSearch) return true;
      }
      return msg.text.toLowerCase().includes(query);
    });
  }, [messages, searchQuery]);

  return (
    <div className="min-h-screen bg-white text-zinc-900 flex flex-col justify-between selection:bg-zinc-200">
      {/* Top Header */}
      <Header
        onlineCount={onlineCount}
        totalMessages={messages.length}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        onOpenInfo={() => setIsInfoOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isSearchOpen={isSearchOpen}
        onToggleSearch={() => {
          setIsSearchOpen(!isSearchOpen);
          if (isSearchOpen) setSearchQuery('');
        }}
        isConnected={isConnected}
        onRefresh={() => {
          fetchMessages();
          connectWebSocket();
        }}
      />

      {/* Main Chat Stream Container */}
      <main
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 max-w-4xl w-full mx-auto px-4 py-5 overflow-y-auto space-y-3"
      >
        {/* Stream Banner / Serial Introduction */}
        <div className="text-center py-5 px-4 mb-2 bg-zinc-50/80 rounded-2xl border border-zinc-100">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 font-mono mb-1">
            Official Serial Registry
          </p>
          <h2 className="text-sm font-medium text-zinc-700">
            Messages are preserved in sequential serial order for everyone.
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Zero identity details • Complete freedom • Real-time continuous stream
          </p>
        </div>

        {/* Message Items List */}
        {filteredMessages.length === 0 ? (
          <div className="py-16 text-center text-zinc-400">
            <MessageSquareOff className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">
              {searchQuery ? 'No messages match your search.' : 'No messages yet.'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-xs text-zinc-900 underline font-medium"
              >
                Clear search filter
              </button>
            )}
          </div>
        ) : (
          filteredMessages.map((msg) => (
            <MessageItem
              key={msg.id}
              message={msg}
              isCurrentUser={Boolean(msg.authorToken && msg.authorToken === authorToken)}
              onReply={(m) => setReplyingTo(m)}
              onReact={handleReact}
            />
          ))
        )}

        {/* Auto Scroll Anchor */}
        <div ref={messagesEndRef} className="h-2" />
      </main>

      {/* Floating "Scroll to Bottom" button */}
      {isUserScrolledUp && (
        <button
          onClick={() => scrollToBottom('smooth')}
          className="fixed bottom-24 right-6 z-30 flex items-center gap-1.5 px-3 py-2 bg-zinc-900 text-white rounded-full text-xs font-medium shadow-lg hover:bg-black transition-all active:scale-95 animate-fadeIn"
        >
          <ArrowDown className="w-3.5 h-3.5" />
          <span>Latest</span>
          {newMessagesWhileScrolled > 0 && (
            <span className="ml-1 px-1.5 py-0.2 bg-emerald-500 text-white rounded-full text-[10px] font-bold">
              +{newMessagesWhileScrolled}
            </span>
          )}
        </button>
      )}

      {/* Sticky Bottom Message Input */}
      <MessageInput
        onSendMessage={handleSendMessage}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        isSending={isSending}
      />

      {/* Info Modal */}
      <InfoModal
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
        totalMessages={messages.length}
      />
    </div>
  );
}
