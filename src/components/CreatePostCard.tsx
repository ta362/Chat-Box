import React, { useState, useRef, useEffect } from 'react';
import { Send, Plus, X, Tag, Sparkles, PenLine } from 'lucide-react';

interface CreatePostCardProps {
  onPublishPost: (content: string, tag?: string) => Promise<boolean>;
  nextSerialNumber: number;
  isPublishing: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const PRESET_TAGS = ['Thoughts', 'Question', 'Story', 'Tech', 'Idea', 'General'];

export const CreatePostCard: React.FC<CreatePostCardProps> = ({
  onPublishPost,
  nextSerialNumber,
  isPublishing,
  isOpen: controlledIsOpen,
  onOpenChange,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = (val: boolean) => {
    if (onOpenChange) onOpenChange(val);
    else setInternalIsOpen(val);
  };

  const [content, setContent] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const maxLength = 2000;
  const remainingChars = maxLength - content.length;

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    adjustTextareaHeight();
  };

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 220)}px`;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isPublishing) return;

    const success = await onPublishPost(content.trim(), selectedTag || undefined);
    if (success) {
      setContent('');
      setSelectedTag('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      setIsOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // If closed, do not render anything (zero clutter in the feed)
  if (!isOpen) {
    return null;
  }

  // Modal Dialog View
  return (
    <div
      id="create-post-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsOpen(false);
      }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        id="create-post-card"
        className="w-full max-w-xl bg-white rounded-2xl border border-zinc-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 p-5 sm:p-6"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {/* Header indicator with next serial preview & close button */}
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-zinc-900 text-white flex items-center justify-center font-bold">
                <PenLine className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 text-sm sm:text-base">
                  New Anonymous Post
                </h3>
                <p className="text-xs text-zinc-400">
                  Shared instantly with everyone in continuous serial sequence
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono bg-zinc-100 text-zinc-800 text-xs px-2.5 py-1 rounded-lg font-bold border border-zinc-200">
                Assigned #{nextSerialNumber}
              </span>
              <button
                type="button"
                id="btn-close-create-post"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Text Input area */}
          <div className="relative py-1">
            <textarea
              id="post-content-input"
              ref={textareaRef}
              value={content}
              onChange={handleTextChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder="What's on your mind? Share an idea, question, or story anonymously..."
              maxLength={maxLength}
              rows={4}
              className="w-full bg-zinc-50/50 hover:bg-zinc-50 focus:bg-white border border-zinc-200 focus:border-zinc-400 rounded-xl p-3.5 text-sm sm:text-base text-zinc-900 placeholder:text-zinc-400 resize-none focus:outline-none leading-relaxed transition-colors"
            />
          </div>

          {/* Tags Selection */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-zinc-400 mr-1 flex items-center gap-1">
              <Tag className="w-3 h-3" /> Topic:
            </span>
            {PRESET_TAGS.map((tag) => {
              const isSelected = selectedTag === tag;
              return (
                <button
                  key={tag}
                  type="button"
                  id={`tag-btn-${tag.toLowerCase()}`}
                  onClick={() => setSelectedTag(isSelected ? '' : tag)}
                  className={`px-3 py-1 rounded-full text-xs transition-all font-medium ${
                    isSelected
                      ? 'bg-zinc-900 text-white shadow-xs font-semibold'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>

          {/* Footer with char count, shortcut hint, and publish button */}
          <div className="flex items-center justify-between pt-3 border-t border-zinc-100 gap-2">
            <div className="flex items-center gap-3 text-xs text-zinc-400">
              <span className={remainingChars < 100 ? 'text-amber-600 font-semibold' : ''}>
                {remainingChars} chars left
              </span>
              <span className="hidden sm:inline text-zinc-300">•</span>
              <span className="hidden sm:inline text-zinc-400 text-[11px]">
                <kbd className="px-1.5 py-0.5 bg-zinc-100 border border-zinc-200 rounded font-mono">⌘+Enter</kbd>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
              >
                Cancel
              </button>
              <button
                id="btn-publish-post"
                type="submit"
                disabled={!content.trim() || isPublishing}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all shadow-xs ${
                  content.trim() && !isPublishing
                    ? 'bg-zinc-900 text-white hover:bg-black active:scale-98'
                    : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                }`}
              >
                {isPublishing ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Publishing...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Post as #{nextSerialNumber}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

