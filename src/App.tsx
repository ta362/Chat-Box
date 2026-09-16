import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Header } from './components/Header';
import { MessageItem } from './components/MessageItem';
import { MessageInput } from './components/MessageInput';
import { InfoModal } from './components/InfoModal';
import { ChatMessage } from './types';
import { soundPlayer } from './lib/audio';
import {
  getOrCreateAnonymousToken,
  getSoundPreference,
  setSoundPreference,
} from './lib/storage';
import {
  subscribeToMessages,
  sendChatMessage,
  addMessageReaction,
  fetchMessageBySerial,
  fetchOlderArchivedMessages,
} from './lib/firebase';
import { ArrowDown, MessageSquareOff, Archive, Loader2, Sparkles } from 'lucide-react';

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

const COMPRESSION_LIMIT = 1000;

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
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

  const [onlineCount, setOnlineCount] = useState<number>(() => Math.floor(Math.random() * 4) + 2);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(getSoundPreference());
  const [isInfoOpen, setIsInfoOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isUserScrolledUp, setIsUserScrolledUp] = useState<boolean>(false);
  const [newMessagesWhileScrolled, setNewMessagesWhileScrolled] = useState<number>(0);

  // Archive & Serial Search States
  const [archivedMessageResult, setArchivedMessageResult] = useState<ChatMessage | null>(null);
  const [isSearchingArchive, setIsSearchingArchive] = useState<boolean>(false);
  const [isLoadingMoreArchive, setIsLoadingMoreArchive] = useState<boolean>(false);

  const authorToken = useMemo(() => getOrCreateAnonymousToken(), []);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previousMessagesCountRef = useRef<number>(0);

  // Sync to local backup storage whenever messages change
  useEffect(() => {
    try {
      if (messages.length > 0) {
        localStorage.setItem('anon_local_messages_cache', JSON.stringify(messages.slice(-500)));
      }
    } catch {
      // ignore
    }
  }, [messages]);

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

  // Connect to Firebase Firestore Real-Time Stream
  useEffect(() => {
    setIsConnected(true);

    const unsubscribe = subscribeToMessages(
      (realtimeMsgs) => {
        setIsConnected(true);
        if (realtimeMsgs.length > 0) {
          // Check if new incoming message arrived from another user
          if (
            previousMessagesCountRef.current > 0 &&
            realtimeMsgs.length > previousMessagesCountRef.current
          ) {
            const newestMsg = realtimeMsgs[realtimeMsgs.length - 1];
            if (newestMsg.authorToken !== authorToken && soundEnabled) {
              soundPlayer.playPop();
            }

            // Scroll if near bottom
            if (containerRef.current) {
              const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
              const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
              if (isNearBottom || newestMsg.authorToken === authorToken) {
                setTimeout(() => scrollToBottom('smooth'), 50);
              } else {
                setNewMessagesWhileScrolled((c) => c + 1);
              }
            }
          }

          previousMessagesCountRef.current = realtimeMsgs.length;
          setMessages(realtimeMsgs);
        }
      },
      (err) => {
        console.warn('Firestore subscription status:', err);
      }
    );

    const interval = setInterval(() => {
      setOnlineCount((prev) => Math.max(1, prev + (Math.random() > 0.5 ? 1 : -1)));
    }, 15000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [authorToken, soundEnabled]);

  // Initial scroll on load
  useEffect(() => {
    if (messages.length > 0 && !isUserScrolledUp) {
      scrollToBottom('auto');
    }
  }, []);

  // Check and query archive if search query looks like a serial number
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setArchivedMessageResult(null);
      setIsSearchingArchive(false);
      return;
    }

    const serialNum = trimmed.startsWith('#')
      ? parseInt(trimmed.slice(1), 10)
      : /^\d+$/.test(trimmed)
      ? parseInt(trimmed, 10)
      : null;

    if (serialNum !== null && !isNaN(serialNum)) {
      // Check if already in active rendered messages
      const foundLocally = messages.some((m) => m.serialNumber === serialNum);
      if (!foundLocally) {
        setIsSearchingArchive(true);
        fetchMessageBySerial(serialNum)
          .then((result) => {
            setArchivedMessageResult(result);
          })
          .finally(() => {
            setIsSearchingArchive(false);
          });
      } else {
        setArchivedMessageResult(null);
      }
    } else {
      setArchivedMessageResult(null);
    }
  }, [searchQuery, messages]);

  // Load older compressed messages from archive
  const handleLoadOlderCompressed = async () => {
    if (messages.length === 0 || isLoadingMoreArchive) return;
    const earliestSerial = messages[0].serialNumber;
    if (earliestSerial <= 1) return;

    setIsLoadingMoreArchive(true);
    try {
      const olderMsgs = await fetchOlderArchivedMessages(earliestSerial, 50);
      if (olderMsgs.length > 0) {
        setMessages((prev) => {
          const map = new Map<string, ChatMessage>();
          olderMsgs.forEach((m) => map.set(m.id, m));
          prev.forEach((m) => map.set(m.id, m));
          return Array.from(map.values()).sort((a, b) => a.serialNumber - b.serialNumber);
        });
      }
    } catch (err) {
      console.error('Failed to load older archive:', err);
    } finally {
      setIsLoadingMoreArchive(false);
    }
  };

  // Send message handler to Firestore
  const handleSendMessage = async (
    text: string,
    replyTo?: { serialNumber: number; text: string } | null
  ) => {
    setIsSending(true);
    if (soundEnabled) {
      soundPlayer.playSend();
    }

    try {
      await sendChatMessage(text, authorToken, replyTo);
      setTimeout(() => scrollToBottom('smooth'), 50);
    } catch (err) {
      console.error('Failed to send message:', err);
      // Fallback local update if offline
      const nextSerial =
        messages.length > 0
          ? Math.max(...messages.map((m) => m.serialNumber)) + 1
          : 1;
      const localMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        serialNumber: nextSerial,
        text: text.trim(),
        createdAt: Date.now(),
        authorToken,
        reactions: {},
        replyTo: replyTo || null,
      };
      setMessages((prev) => [...prev, localMsg]);
      setTimeout(() => scrollToBottom('smooth'), 50);
    } finally {
      setIsSending(false);
    }
  };

  // Add reaction handler
  const handleReact = async (messageId: string, emoji: string) => {
    // Optimistic local update
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

    // Also update archived search result if reacted to
    if (archivedMessageResult && archivedMessageResult.id === messageId) {
      setArchivedMessageResult((prev) =>
        prev
          ? {
              ...prev,
              reactions: {
                ...(prev.reactions || {}),
                [emoji]: ((prev.reactions || {})[emoji] || 0) + 1,
              },
            }
          : null
      );
    }

    await addMessageReaction(messageId, emoji);
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

    const matched = messages.filter((msg) => {
      if (isSerialSearch !== null && !isNaN(isSerialSearch)) {
        if (msg.serialNumber === isSerialSearch) return true;
      }
      return msg.text.toLowerCase().includes(query);
    });

    // If archived query returned a result not in current active window, prepend it
    if (
      archivedMessageResult &&
      !matched.some((m) => m.id === archivedMessageResult.id)
    ) {
      return [archivedMessageResult, ...matched];
    }

    return matched;
  }, [messages, searchQuery, archivedMessageResult]);

  const hasCompressedOlder = messages.length > 0 && messages[0].serialNumber > 1;

  return (
    <div className="min-h-screen bg-white text-zinc-900 flex flex-col justify-between selection:bg-zinc-200">
      {/* Top Header */}
      <Header
        onlineCount={onlineCount}
        totalMessages={messages.length > 0 ? Math.max(...messages.map((m) => m.serialNumber)) : 0}
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
        onRefresh={() => scrollToBottom('smooth')}
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
            Zero identity details • Automatic 1000+ archive compression • Search any serial # to recall
          </p>
        </div>

        {/* Compression / Older Archive Banner (if older messages exist before current view) */}
        {hasCompressedOlder && !searchQuery && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 text-xs text-zinc-600 mb-3 animate-fadeIn">
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-zinc-500 shrink-0" />
              <span>
                Messages <strong className="font-mono text-zinc-800">#001</strong> to{' '}
                <strong className="font-mono text-zinc-800">
                  #{String(messages[0].serialNumber - 1).padStart(3, '0')}
                </strong>{' '}
                are archived.
              </span>
            </div>
            <button
              onClick={handleLoadOlderCompressed}
              disabled={isLoadingMoreArchive}
              className="px-2.5 py-1 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-lg font-medium text-zinc-800 flex items-center gap-1 transition-all shadow-2xs text-[11px]"
            >
              {isLoadingMoreArchive ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Loading...</span>
                </>
              ) : (
                <span>Load Older</span>
              )}
            </button>
          </div>
        )}

        {/* Searching Archive indicator */}
        {isSearchingArchive && (
          <div className="p-3 bg-zinc-100 rounded-xl flex items-center justify-center gap-2 text-xs text-zinc-600">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Searching compressed archive for serial #{searchQuery}...</span>
          </div>
        )}

        {/* Found in Archive Callout */}
        {archivedMessageResult && (
          <div className="p-2.5 bg-zinc-900 text-white rounded-xl flex items-center justify-between text-xs animate-fadeIn shadow-sm">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>
                Retrieved archived message{' '}
                <strong className="font-mono">
                  #{String(archivedMessageResult.serialNumber).padStart(3, '0')}
                </strong>{' '}
                from database:
              </span>
            </div>
          </div>
        )}

        {/* Message Items List */}
        {filteredMessages.length === 0 && !isSearchingArchive ? (
          <div className="py-16 text-center text-zinc-400">
            <MessageSquareOff className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">
              {searchQuery
                ? `No message found matching "${searchQuery}".`
                : 'No messages yet.'}
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
