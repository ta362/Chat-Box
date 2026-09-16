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
import { ArrowDown, MessageSquareOff, WifiOff } from 'lucide-react';

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [isConnected, setIsConnected] = useState<boolean>(false);
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
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        if (data.messages) {
          setMessages(data.messages);
        }
        if (data.onlineCount) {
          setOnlineCount(data.onlineCount);
        }
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  }, []);

  // WebSocket Connection Lifecycle
  const connectWebSocket = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data: WsMessageEvent = JSON.parse(event.data);
          
          if (data.type === 'init') {
            if (data.payload?.messages) {
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
              // Deduplicate if already present (e.g. from optimistic update)
              if (prev.some((m) => m.id === newMsg.id || m.serialNumber === newMsg.serialNumber)) {
                return prev.map((m) =>
                  m.id === newMsg.id || m.serialNumber === newMsg.serialNumber ? newMsg : m
                );
              }
              return [...prev, newMsg];
            });

            // Sound chime if not current author
            if (newMsg.authorToken !== authorToken && soundEnabled) {
              soundPlayer.playPop();
            }

            // Scroll or increment badge
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
        setIsConnected(false);
        wsRef.current = null;
        // Auto-reconnect after 3s
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connectWebSocket();
          }, 3000);
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
      };
    } catch (e) {
      console.error('WebSocket connection failed:', e);
      setIsConnected(false);
    }
  }, [authorToken, soundEnabled]);

  useEffect(() => {
    fetchMessages();
    connectWebSocket();

    // Ping interval to keep connection alive
    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 20000);

    return () => {
      clearInterval(pingInterval);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
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
  }, [messages.length === 0]);

  // Send message handler
  const handleSendMessage = async (
    text: string,
    replyTo?: { serialNumber: number; text: string } | null
  ) => {
    setIsSending(true);
    if (soundEnabled) {
      soundPlayer.playSend();
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
        setMessages((prev) => {
          if (prev.some((m) => m.id === createdMsg.id)) return prev;
          return [...prev, createdMsg];
        });
        setTimeout(() => scrollToBottom('smooth'), 50);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
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

    try {
      await fetch(`/api/messages/${messageId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      });
    } catch (err) {
      console.error('Failed to react:', err);
    }
  };

  // Filter messages according to search query or serial number
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const query = searchQuery.toLowerCase().trim();

    // Check if query is looking for a serial number e.g. "5" or "#5"
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

      {/* Disconnection Warning Banner (if offline) */}
      {!isConnected && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800 flex items-center justify-center gap-2">
          <WifiOff className="w-3.5 h-3.5 text-amber-600" />
          <span>Disconnected from real-time stream. Reconnecting automatically...</span>
        </div>
      )}

      {/* Main Chat Stream Container */}
      <main
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 max-w-4xl w-full mx-auto px-4 py-5 overflow-y-auto space-y-3"
      >
        {/* Stream Banner / Serial Introduction */}
        <div className="text-center py-6 px-4 mb-2 bg-zinc-50/70 rounded-2xl border border-zinc-100">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 font-mono mb-1">
            Official Serial Registry
          </p>
          <h2 className="text-sm font-medium text-zinc-700">
            Messages are preserved in sequential serial order for everyone.
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Zero identity details • Complete freedom • Real-time global broadcast
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
