import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Plus, X, Tag, Sparkles, PenLine, AlertTriangle, ShieldAlert, Lock, Key, Copy, Check, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { SerialPost } from '../types';
import { checkIsSimilarPost } from '../lib/similarity';
import { generateRandomPasscode, hashPasscode, encryptPostContent } from '../lib/crypto';

export interface PublishPostOptions {
  isPrivate?: boolean;
  passcode?: string;
  passcodeHash?: string;
  privateHint?: string;
}

interface CreatePostCardProps {
  onPublishPost: (content: string, tag?: string, options?: PublishPostOptions) => Promise<boolean>;
  nextSerialNumber: number;
  isPublishing: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  existingPosts?: SerialPost[];
}

const PRESET_TAGS = ['Romantic', 'Feelings', 'Funny Joke', 'Shayari', 'Thoughts', 'Story'];

export const CreatePostCard: React.FC<CreatePostCardProps> = ({
  onPublishPost,
  nextSerialNumber,
  isPublishing,
  isOpen: controlledIsOpen,
  onOpenChange,
  existingPosts = [],
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

  // Private Post state
  const [isPrivate, setIsPrivate] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [privateHint, setPrivateHint] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [showPasscodeText, setShowPasscodeText] = useState(true);

  const maxLength = 2000;
  const remainingChars = maxLength - content.length;

  // Real-time similarity / copyright duplicate check (only check if public)
  const similarityCheck = useMemo(() => {
    if (isPrivate) return { isDuplicate: false, similarityPercentage: 0, matchedPost: null };
    return checkIsSimilarPost(content, existingPosts, 0.70);
  }, [content, existingPosts, isPrivate]);

  // Generate passcode when user turns on private post
  const handleTogglePrivate = () => {
    const nextState = !isPrivate;
    setIsPrivate(nextState);
    if (nextState && !passcode) {
      setPasscode(generateRandomPasscode());
    }
  };

  const handleRegenerateKey = () => {
    setPasscode(generateRandomPasscode());
    setCopiedKey(false);
  };

  const handleCopyPasscode = async () => {
    if (!passcode) return;
    try {
      await navigator.clipboard.writeText(passcode);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      // Fallback
    }
  };

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
    if (!content.trim() || isPublishing || similarityCheck.isDuplicate) return;

    let finalContent = content.trim();
    let options: PublishPostOptions | undefined = undefined;

    if (isPrivate) {
      if (!passcode.trim()) {
        alert('Please generate or provide a passcode key for this private post.');
        return;
      }
      try {
        const cleanPass = passcode.trim().toUpperCase();
        const encrypted = await encryptPostContent(finalContent, cleanPass);
        const hash = await hashPasscode(cleanPass);
        finalContent = encrypted;
        options = {
          isPrivate: true,
          passcode: cleanPass,
          passcodeHash: hash,
          privateHint: privateHint.trim() || undefined,
        };
      } catch (encryptErr) {
        console.error('Failed to encrypt private post:', encryptErr);
        alert('Could not encrypt private post.');
        return;
      }
    }

    const success = await onPublishPost(finalContent, selectedTag || undefined, options);
    if (success) {
      setContent('');
      setSelectedTag('');
      setIsPrivate(false);
      setPasscode('');
      setPrivateHint('');
      setCopiedKey(false);
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
        className="w-full max-w-xl bg-white rounded-2xl border border-zinc-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 p-5 sm:p-6 max-h-[92vh] flex flex-col"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 overflow-y-auto pr-0.5">
          {/* Header indicator with next serial preview & close button */}
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 shrink-0">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white transition-colors ${
                isPrivate ? 'bg-amber-600' : 'bg-zinc-900'
              }`}>
                {isPrivate ? <Lock className="w-4 h-4" /> : <PenLine className="w-4 h-4" />}
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 text-sm sm:text-base flex items-center gap-1.5">
                  {isPrivate ? 'Create Private Locked Post' : 'New Anonymous Post'}
                </h3>
                <p className="text-xs text-zinc-400">
                  {isPrivate
                    ? 'Only people who have the generated Secret Key can unlock & read this post'
                    : 'Shared instantly with everyone in continuous serial sequence'}
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
              placeholder={
                isPrivate
                  ? "Type your confidential message here. It will be encrypted with the secret pass key before being posted..."
                  : "What's on your mind? Share an idea, question, or story anonymously..."
              }
              maxLength={maxLength}
              rows={4}
              className={`w-full bg-zinc-50/50 hover:bg-zinc-50 focus:bg-white border rounded-xl p-3.5 text-sm sm:text-base text-zinc-900 placeholder:text-zinc-400 resize-none focus:outline-none leading-relaxed transition-colors ${
                similarityCheck.isDuplicate
                  ? 'border-rose-300 focus:border-rose-500 bg-rose-50/20'
                  : isPrivate
                  ? 'border-amber-300/80 focus:border-amber-500'
                  : 'border-zinc-200 focus:border-zinc-400'
              }`}
            />
          </div>

          {/* Private Post Option Toggle */}
          <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg ${isPrivate ? 'bg-amber-100 text-amber-800' : 'bg-zinc-200 text-zinc-600'}`}>
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-900">Private Locked Post</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700 font-semibold">
                      Passcode Protected
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    Post will appear locked on the board. Reader must enter the generated key to open.
                  </p>
                </div>
              </div>

              <button
                type="button"
                id="btn-toggle-private-post"
                onClick={handleTogglePrivate}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isPrivate ? 'bg-amber-600' : 'bg-zinc-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    isPrivate ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* If Private is active, show the generated Secret Key box & copy action */}
            {isPrivate && (
              <div className="pt-2 border-t border-zinc-200/60 space-y-3 animate-in fade-in duration-200">
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-amber-700" />
                      Secret Passcode (Key)
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handleRegenerateKey}
                        className="text-[11px] text-amber-800 hover:text-amber-950 px-2 py-0.5 rounded hover:bg-amber-100 flex items-center gap-1 transition-colors"
                        title="Generate a new random key"
                      >
                        <RefreshCw className="w-3 h-3" /> New Key
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPasscodeText(!showPasscodeText)}
                        className="text-[11px] text-amber-800 hover:text-amber-950 p-1 rounded hover:bg-amber-100 transition-colors"
                        title={showPasscodeText ? 'Hide key' : 'Show key'}
                      >
                        {showPasscodeText ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-white border border-amber-300 rounded-lg px-3 py-2 font-mono font-bold text-base text-zinc-900 tracking-wider flex items-center justify-between shadow-xs">
                      <span>{showPasscodeText ? passcode : '••••••••••••'}</span>
                    </div>
                    <button
                      type="button"
                      id="btn-copy-generated-key"
                      onClick={handleCopyPasscode}
                      className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer ${
                        copiedKey
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-900 hover:bg-amber-950 text-white'
                      }`}
                    >
                      {copiedKey ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy Key
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-[11px] text-amber-900 leading-tight">
                    ⚠️ <strong>Copy this key now!</strong> Send it separately to the person you want to read this post. Without this key, no one can unlock or view the message.
                  </p>
                </div>

                {/* Optional Hint */}
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                    Public Hint (Optional - e.g. "For my friend Alex" or "Birth date year"):
                  </label>
                  <input
                    type="text"
                    value={privateHint}
                    onChange={(e) => setPrivateHint(e.target.value)}
                    placeholder="Enter an optional clue or hint for the recipient..."
                    maxLength={100}
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-xs text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Copyright / Duplicate Warning Banner */}
          {similarityCheck.isDuplicate && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-rose-950">
                  Copyright & Duplicate Content Protection
                </p>
                <p className="mt-0.5 text-rose-800 leading-normal">
                  This text is <strong>{similarityCheck.similarityPercentage}% similar</strong> to existing{' '}
                  <span className="font-mono font-bold bg-rose-100 px-1 py-0.5 rounded text-rose-950">
                    Post #{similarityCheck.matchedPost?.serialNumber}
                  </span>
                  . Duplicate posts are blocked to protect originality.
                </p>
              </div>
            </div>
          )}

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
          <div className="flex items-center justify-between pt-3 border-t border-zinc-100 gap-2 shrink-0">
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
                disabled={!content.trim() || isPublishing || similarityCheck.isDuplicate}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all shadow-xs ${
                  content.trim() && !isPublishing && !similarityCheck.isDuplicate
                    ? isPrivate
                      ? 'bg-amber-600 text-white hover:bg-amber-700 active:scale-98'
                      : 'bg-zinc-900 text-white hover:bg-black active:scale-98'
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
                    {isPrivate ? <Lock className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                    <span>{isPrivate ? `Lock & Post #${nextSerialNumber}` : `Post as #${nextSerialNumber}`}</span>
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


