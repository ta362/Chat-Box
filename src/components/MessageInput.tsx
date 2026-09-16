import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Smile, CornerDownLeft } from 'lucide-react';
import { ChatMessage } from '../types';

interface MessageInputProps {
  onSendMessage: (text: string, replyTo?: { serialNumber: number; text: string } | null) => Promise<void>;
  replyingTo: ChatMessage | null;
  onCancelReply: () => void;
  isSending: boolean;
}

const QUICK_EMOJIS = ['👋', '❤️', '👍', '🔥', '✨', '🚀', '💯', '😂'];

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  replyingTo,
  onCancelReply,
  isSending,
}) => {
  const [text, setText] = useState('');
  const [showEmojiRow, setShowEmojiRow] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [text]);

  // Focus textarea when replyingTo changes
  useEffect(() => {
    if (replyingTo && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyingTo]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim() || isSending) return;

    const messageText = text.trim();
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const replyData = replyingTo
      ? {
          serialNumber: replyingTo.serialNumber,
          text: replyingTo.text,
        }
      : null;

    onCancelReply();
    await onSendMessage(messageText, replyData);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const insertEmoji = (emoji: string) => {
    setText((prev) => prev + emoji);
    textareaRef.current?.focus();
  };

  const charCount = text.length;
  const isTooLong = charCount > 2000;

  return (
    <div className="sticky bottom-0 z-20 w-full bg-white/95 backdrop-blur-md border-t border-zinc-200">
      <div className="max-w-4xl mx-auto px-4 py-3">
        {/* Reply Context Banner */}
        {replyingTo && (
          <div className="mb-2 flex items-center justify-between px-3 py-1.5 bg-zinc-100 border border-zinc-200 rounded-lg text-xs animate-fadeIn">
            <div className="flex items-center gap-1.5 text-zinc-600 truncate">
              <CornerDownLeft className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span>
                Replying to{' '}
                <strong className="font-mono text-zinc-900">
                  #{String(replyingTo.serialNumber).padStart(3, '0')}
                </strong>
                : <span className="italic truncate">{replyingTo.text}</span>
              </span>
            </div>
            <button
              onClick={onCancelReply}
              className="p-1 text-zinc-400 hover:text-zinc-700 rounded hover:bg-zinc-200 transition-colors shrink-0 ml-2"
              title="Cancel reply"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Quick Emoji Bar */}
        {showEmojiRow && (
          <div className="mb-2 flex items-center gap-1.5 overflow-x-auto py-1 px-2 bg-zinc-50 border border-zinc-200 rounded-lg animate-fadeIn">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => insertEmoji(emoji)}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-200 text-sm transition-transform active:scale-125"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Main Input Bar */}
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          {/* Emoji Toggle */}
          <button
            type="button"
            id="btn-quick-emojis"
            onClick={() => setShowEmojiRow(!showEmojiRow)}
            className={`p-2.5 rounded-xl border border-zinc-200 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 transition-colors ${
              showEmojiRow ? 'bg-zinc-100 text-zinc-900 border-zinc-300' : ''
            }`}
            title="Quick emojis"
          >
            <Smile className="w-5 h-5" />
          </button>

          {/* Text Area */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              id="message-textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write an anonymous message..."
              rows={1}
              maxLength={2000}
              className="w-full resize-none py-2.5 px-3.5 text-sm bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 leading-relaxed text-zinc-900 placeholder:text-zinc-400 transition-all max-h-40 min-h-[44px]"
            />
          </div>

          {/* Send Button */}
          <button
            type="submit"
            id="btn-send-message"
            disabled={!text.trim() || isTooLong || isSending}
            className="h-11 px-4 rounded-xl bg-zinc-900 hover:bg-black disabled:bg-zinc-200 disabled:text-zinc-400 text-white font-medium text-sm flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-95 shrink-0"
            title="Send (Enter)"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>

        {/* Character Count & Hint */}
        <div className="mt-1.5 px-1 flex items-center justify-between text-[11px] text-zinc-400">
          <span className="hidden sm:inline">
            Press <kbd className="px-1 py-0.5 bg-zinc-100 rounded border border-zinc-200 font-mono text-[10px]">Enter</kbd> to send, <kbd className="px-1 py-0.5 bg-zinc-100 rounded border border-zinc-200 font-mono text-[10px]">Shift+Enter</kbd> for new line
          </span>
          <span className="sm:hidden">
            100% Anonymous Public Stream
          </span>
          <span className={`font-mono ${isTooLong ? 'text-rose-500 font-semibold' : ''}`}>
            {charCount}/2000
          </span>
        </div>
      </div>
    </div>
  );
};
