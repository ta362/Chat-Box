import React, { useState } from 'react';
import { Copy, Check, Reply, Smile, Heart, ThumbsUp, Flame, Sparkles } from 'lucide-react';
import { ChatMessage } from '../types';

interface MessageItemProps {
  message: ChatMessage;
  isCurrentUser: boolean;
  onReply: (message: ChatMessage) => void;
  onReact: (messageId: string, emoji: string) => void;
}

const COMMON_EMOJIS = ['❤️', '👍', '🔥', '✨', '👏', '💡'];

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const timeStr = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isToday) {
    return timeStr;
  }

  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isCurrentUser,
  onReply,
  onReact,
}) => {
  const [copied, setCopied] = useState(false);
  const [showEmojiBar, setShowEmojiBar] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedSerialNumber = `#${String(message.serialNumber).padStart(3, '0')}`;
  const reactionsList = Object.entries(message.reactions || {}).filter(
    (entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0
  );

  return (
    <div
      id={`message-${message.serialNumber}`}
      className={`group relative rounded-xl transition-all duration-150 p-3 sm:p-4 border ${
        isCurrentUser
          ? 'bg-zinc-50/80 border-zinc-300/80 hover:border-zinc-400'
          : 'bg-white border-zinc-200/90 hover:border-zinc-300'
      }`}
    >
      {/* Top Meta Line */}
      <div className="flex items-center justify-between gap-2 mb-1.5 text-xs">
        <div className="flex items-center gap-2">
          {/* Serial Number Badge */}
          <span className="inline-flex items-center px-2 py-0.5 rounded font-mono font-semibold text-xs bg-zinc-900 text-white tracking-wider">
            {formattedSerialNumber}
          </span>

          {/* Anonymous Tag */}
          <span
            className={`font-medium ${
              isCurrentUser ? 'text-zinc-900 font-semibold' : 'text-zinc-600'
            }`}
          >
            {isCurrentUser ? 'You (Anonymous)' : 'Anonymous'}
          </span>
        </div>

        {/* Time and Action Buttons */}
        <div className="flex items-center gap-2">
          <span className="text-zinc-400 text-[11px] font-mono">
            {formatTime(message.createdAt)}
          </span>

          {/* Action buttons (visible on hover / touch) */}
          <div className="opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            <button
              onClick={() => setShowEmojiBar(!showEmojiBar)}
              className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded transition-colors"
              title="Add reaction"
              aria-label="React"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onReply(message)}
              className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded transition-colors"
              title={`Reply to ${formattedSerialNumber}`}
              aria-label="Reply"
            >
              <Reply className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleCopy}
              className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded transition-colors"
              title="Copy text"
              aria-label="Copy"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Reply Snippet if message is a reply */}
      {message.replyTo && (
        <div className="mb-2 pl-2.5 py-1 border-l-2 border-zinc-300 text-xs text-zinc-500 bg-zinc-100/50 rounded-r">
          <span className="font-mono font-medium text-zinc-700">
            #{String(message.replyTo.serialNumber).padStart(3, '0')}:
          </span>{' '}
          <span className="italic line-clamp-1">{message.replyTo.text}</span>
        </div>
      )}

      {/* Message Body */}
      <div className="text-sm text-zinc-800 leading-relaxed break-words whitespace-pre-wrap font-normal">
        {message.text}
      </div>

      {/* Emoji Picker Popup Bar */}
      {showEmojiBar && (
        <div className="mt-2.5 flex items-center gap-1.5 p-1.5 bg-white border border-zinc-200 rounded-lg shadow-sm w-fit animate-fadeIn">
          {COMMON_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onReact(message.id, emoji);
                setShowEmojiBar(false);
              }}
              className="w-7 h-7 flex items-center justify-center rounded text-base hover:bg-zinc-100 transition-transform active:scale-125"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Reactions Display */}
      {reactionsList.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {reactionsList.map(([emoji, count]) => (
            <button
              key={emoji}
              onClick={() => onReact(message.id, emoji)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-zinc-100/80 hover:bg-zinc-200/80 border border-zinc-200 text-zinc-700 transition-colors active:scale-95"
            >
              <span>{emoji}</span>
              <span className="font-mono font-medium text-[11px]">{count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
