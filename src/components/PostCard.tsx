import React, { useState, useEffect, useRef } from 'react';
import {
  Heart,
  MessageSquare,
  Share2,
  Check,
  Send,
  Clock,
  Tag as TagIcon,
  ChevronDown,
  ChevronUp,
  Edit3,
  Trash2,
  Lock,
  Unlock,
  Key,
  Eye,
  EyeOff,
  Copy,
  AlertCircle,
  ArrowLeft,
  LogOut,
} from 'lucide-react';
import { SerialPost, PostComment } from '../types';
import { CommentItem } from './CommentItem';
import {
  subscribeToPostComments,
  addPostComment,
  toggleCommentLike,
  updateComment,
  deleteComment,
} from '../lib/firebase';
import { generateRealisticCommentsForPost } from '../lib/commentsEngine';
import { soundPlayer } from '../lib/audio';
import { hashPasscode, decryptPostContent } from '../lib/crypto';

interface PostCardProps {
  post: SerialPost;
  currentUserToken: string;
  onToggleLike: (postId: string, currentLiked: boolean) => void;
  onAddReaction: (postId: string, emoji: string) => void;
  onEditPost: (postId: string, newContent: string, postAuthorToken: string, createdAt: number) => Promise<{ success: boolean; message?: string }>;
  onDeletePost: (postId: string, postAuthorToken: string, createdAt: number, isPrivate?: boolean) => Promise<{ success: boolean; message?: string }>;
  soundEnabled: boolean;
}

const COMMON_EMOJIS = ['🔥', '❤️', '💡', '👏', '😂'];

const formatCompactNumber = (count: number) => {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return count.toLocaleString();
};

export const PostCard: React.FC<PostCardProps> = ({
  post,
  currentUserToken,
  onToggleLike,
  onAddReaction,
  onEditPost,
  onDeletePost,
  soundEnabled,
}) => {
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [copied, setCopied] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Private post unlock state (transient in-memory only; auto-locks when user clicks outside/exits)
  const isPrivatePost = Boolean(post.isPrivate);
  const [unlockedContent, setUnlockedContent] = useState<string | null>(null);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [showPasscodeInput, setShowPasscodeInput] = useState(false);

  const isAuthor = post.authorToken === currentUserToken;
  const isLiked = Array.isArray(post.likedBy) && post.likedBy.includes(currentUserToken);
  const likesCount = typeof post.likesCount === 'number' ? post.likesCount : (post.likedBy?.length || 0);
  const commentsCount = Math.max(post.commentsCount || 0, comments.length);

  const THIRTY_MINUTES_MS = 30 * 60 * 1000;
  const elapsed = Date.now() - post.createdAt;
  // Public posts are editable and deletable within 30 mins; Private posts can be deleted anytime by author with no time limit
  const isEditable = !isPrivatePost && isAuthor && elapsed <= THIRTY_MINUTES_MS;
  const isDeletable = isAuthor && (isPrivatePost || elapsed <= THIRTY_MINUTES_MS);
  const remainingMinutes = Math.max(0, Math.ceil((THIRTY_MINUTES_MS - elapsed) / (1000 * 60)));

  // Auto-lock private post when user leaves/clicks outside the post card
  useEffect(() => {
    if (!unlockedContent) return;

    const handleOutsideClickOrTouch = (event: MouseEvent | TouchEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        // User clicked outside the post - auto lock immediately
        setUnlockedContent(null);
        setPasscodeInput('');
        setUnlockError('');
      }
    };

    document.addEventListener('mousedown', handleOutsideClickOrTouch);
    document.addEventListener('touchstart', handleOutsideClickOrTouch);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClickOrTouch);
      document.removeEventListener('touchstart', handleOutsideClickOrTouch);
    };
  }, [unlockedContent]);

  // Close comment drawer when clicking outside the post card
  useEffect(() => {
    if (!isCommentsOpen) return;
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        setIsCommentsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isCommentsOpen]);

  // Subscribe to comments when comment section is opened
  useEffect(() => {
    if (!isCommentsOpen) return;

    const unsubscribe = subscribeToPostComments(post.id, (loadedComments) => {
      const fullComments = generateRealisticCommentsForPost(post, post.commentsCount, loadedComments);
      setComments(fullComments);
    });

    return () => {
      unsubscribe();
    };
  }, [isCommentsOpen, post.id, post.commentsCount]);

  const handleToggleComments = () => {
    setIsCommentsOpen((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => commentInputRef.current?.focus(), 150);
      }
      return next;
    });
  };

  const handleLike = () => {
    if (soundEnabled && !isLiked) {
      soundPlayer.playPop();
    }
    onToggleLike(post.id, isLiked);
  };

  const handleReactionClick = (emoji: string) => {
    if (soundEnabled) {
      soundPlayer.playPop();
    }
    onAddReaction(post.id, emoji);
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || isSubmittingComment) return;

    setIsSubmittingComment(true);
    try {
      await addPostComment(post.id, newCommentText.trim(), currentUserToken);
      setNewCommentText('');
      if (soundEnabled) {
        soundPlayer.playSend();
      }
    } catch (err) {
      console.error('Error posting comment:', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim() || isSavingEdit) return;
    setIsSavingEdit(true);
    setEditError('');
    try {
      const res = await onEditPost(post.id, editContent, post.authorToken, post.createdAt);
      if (res.success) {
        setIsEditing(false);
        if (soundEnabled) soundPlayer.playPop();
      } else {
        setEditError(res.message || 'Failed to update');
      }
    } catch (err: any) {
      setEditError(err?.message || 'Failed to update');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete post #${post.serialNumber}? This action cannot be undone.`)) {
      return;
    }
    setIsDeleting(true);
    try {
      const res = await onDeletePost(post.id, post.authorToken, post.createdAt, isPrivatePost);
      if (!res.success) {
        alert(res.message || 'Failed to delete post.');
      } else {
        if (soundEnabled) soundPlayer.playPop();
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to delete post.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUnlockPost = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPass = passcodeInput.trim().toUpperCase();
    if (!cleanPass) {
      setUnlockError('Please enter the secret passcode');
      return;
    }

    setIsUnlocking(true);
    setUnlockError('');

    try {
      // 1. Check passcode hash if present
      if (post.passcodeHash) {
        const computedHash = await hashPasscode(cleanPass);
        if (computedHash !== post.passcodeHash) {
          setUnlockError('Incorrect passcode key. Please ask the post author.');
          setIsUnlocking(false);
          return;
        }
      }

      // 2. Decrypt post content
      const decrypted = await decryptPostContent(post.content, cleanPass);
      setUnlockedContent(decrypted);
      if (soundEnabled) {
        soundPlayer.playPop();
      }
    } catch (err: any) {
      console.warn('Unlock decrypt failed:', err);
      setUnlockError('Failed to decrypt. Key might be wrong or invalid.');
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleEditComment = async (
    commentId: string,
    newContent: string,
    commentAuthorToken: string,
    createdAt: number
  ) => {
    return updateComment(post.id, commentId, newContent, currentUserToken, commentAuthorToken, createdAt);
  };

  const handleDeleteComment = async (
    commentId: string,
    commentAuthorToken: string
  ) => {
    return deleteComment(post.id, commentId, currentUserToken, commentAuthorToken);
  };

  const formatTimeAgo = (timestamp: number) => {
    const elapsed = Date.now() - timestamp;
    const minutes = Math.floor(elapsed / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const formatExactDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <article
      ref={cardRef}
      id={`post-card-${post.serialNumber}`}
      className="bg-white rounded-2xl border border-zinc-200 shadow-xl shadow-zinc-300/70 hover:shadow-2xl hover:border-zinc-300 transition-all overflow-hidden"
    >
      <div className="p-4 sm:p-5">
        {/* Post Top Metadata: Serial Badge, Tag, Timestamp */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Primary Serial Badge */}
            <span className="inline-flex items-center justify-center font-mono font-bold text-sm bg-zinc-900 text-white px-3 py-1 rounded-xl shadow-xs">
              #{post.serialNumber}
            </span>

            {post.tag && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200">
                <TagIcon className="w-2.5 h-2.5 text-zinc-500" />
                {post.tag}
              </span>
            )}

            {isPrivatePost && (
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                unlockedContent !== null
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-300'
              }`}>
                {unlockedContent !== null ? (
                  <>
                    <Unlock className="w-2.5 h-2.5 text-emerald-600" />
                    Unlocked
                  </>
                ) : (
                  <>
                    <Lock className="w-2.5 h-2.5 text-amber-700" />
                    Private Locked
                  </>
                )}
              </span>
            )}

            {isAuthor && (
              <>
                <span className="text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md">
                  You
                </span>
                {isPrivatePost ? (
                  <span className="text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-md flex items-center gap-1" title="Private posts can be deleted anytime by you">
                    <Trash2 className="w-3 h-3 text-amber-700" />
                    Deletable Anytime
                  </span>
                ) : isEditable ? (
                  <span className="text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Editable ({remainingMinutes}m left)
                  </span>
                ) : (
                  <span className="text-[11px] font-medium bg-zinc-100 text-zinc-600 border border-zinc-200 px-2 py-0.5 rounded-md flex items-center gap-1" title="Post is now permanent after 30 minutes">
                    <Lock className="w-3 h-3 text-zinc-500" />
                    Permanent
                  </span>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Edit & Delete controls for author: private posts can be deleted anytime, public posts within 30 min */}
            {isAuthor && !isEditing && (
              <div className="flex items-center gap-1">
                {isEditable && (
                  <button
                    onClick={() => {
                      setEditContent(post.content);
                      setIsEditing(true);
                    }}
                    className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                    title="Edit post (Available within 30 mins)"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
                {isDeletable && (
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                    title={isPrivatePost ? "Delete private post (Available anytime)" : "Delete post (Available within 30 mins)"}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono" title={formatExactDate(post.createdAt)}>
              <Clock className="w-3 h-3 ml-1" />
              <span>{formatTimeAgo(post.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Post Main Content or Edit Form */}
        {isEditing ? (
          <div className="my-3 space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={3}
              maxLength={2000}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-sm sm:text-base text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400"
              placeholder="Edit your post content..."
            />
            {editError && <p className="text-xs text-rose-600 font-medium">{editError}</p>}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setEditContent(post.content);
                  setEditError('');
                }}
                disabled={isSavingEdit}
                className="px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={!editContent.trim() || isSavingEdit}
                className="px-3.5 py-1.5 text-xs font-semibold bg-zinc-900 text-white hover:bg-black rounded-lg transition-colors shadow-xs disabled:opacity-50"
              >
                {isSavingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        ) : isPrivatePost && unlockedContent === null ? (
          /* Locked State for Private Post */
          <div className="my-3 p-4 sm:p-5 rounded-2xl bg-amber-50/50 border border-amber-200/90 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center shrink-0 shadow-xs">
                <Lock className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-amber-950 text-sm sm:text-base flex items-center gap-1.5">
                  Private Post — Locked
                </h4>
                <p className="text-xs text-amber-800/90 mt-0.5 leading-relaxed">
                  This post was sent as private. Only users who have the secret generated passcode key can unlock and read this message.
                </p>
                {post.privateHint && (
                  <div className="mt-2 text-xs bg-white/80 border border-amber-200 rounded-lg px-2.5 py-1 text-amber-900 inline-block font-medium">
                    💡 <strong>Clue / Hint:</strong> {post.privateHint}
                  </div>
                )}
              </div>
            </div>

            {/* Passcode Unlock Input Form */}
            <form onSubmit={handleUnlockPost} className="pt-2 border-t border-amber-200/60 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={showPasscodeInput ? 'text' : 'password'}
                  value={passcodeInput}
                  onChange={(e) => {
                    setPasscodeInput(e.target.value);
                    if (unlockError) setUnlockError('');
                  }}
                  placeholder="Enter Secret Passcode (e.g. KEY-XXXX-XXXX)..."
                  className="w-full bg-white border border-amber-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-zinc-900 placeholder:text-amber-800/50 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono tracking-wider"
                />
                <button
                  type="button"
                  onClick={() => setShowPasscodeInput(!showPasscodeInput)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 p-1"
                  title={showPasscodeInput ? 'Hide password' : 'Show password'}
                >
                  {showPasscodeInput ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <button
                type="submit"
                disabled={!passcodeInput.trim() || isUnlocking}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer ${
                  passcodeInput.trim() && !isUnlocking
                    ? 'bg-amber-600 hover:bg-amber-700 text-white active:scale-98'
                    : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                }`}
              >
                {isUnlocking ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Unlocking...</span>
                  </>
                ) : (
                  <>
                    <Key className="w-3.5 h-3.5" />
                    <span>Unlock Post</span>
                  </>
                )}
              </button>
            </form>

            {unlockError && (
              <div className="text-xs text-rose-600 font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{unlockError}</span>
              </div>
            )}
          </div>
        ) : isPrivatePost && unlockedContent !== null ? (
          /* Unlocked State for Private Post */
          <div className="my-3 space-y-2">
            <div className="p-3.5 sm:p-5 rounded-2xl bg-gradient-to-b from-emerald-50/80 to-emerald-50/40 border border-emerald-200 shadow-xs text-zinc-900 text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words font-normal">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-emerald-200/70 text-xs">
                <span className="flex items-center gap-1.5 font-bold text-emerald-900">
                  <Unlock className="w-4 h-4 text-emerald-600" />
                  Unlocked Private Message
                </span>
                
                {/* Arrow Exit / Lock Button */}
                <button
                  type="button"
                  id={`btn-exit-lock-post-${post.id}`}
                  onClick={() => {
                    setUnlockedContent(null);
                    setPasscodeInput('');
                    setUnlockError('');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-emerald-300 text-emerald-900 hover:bg-emerald-100/70 font-semibold text-xs transition-all shadow-xs cursor-pointer active:scale-95"
                  title="Exit & Lock Post"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Exit & Lock</span>
                </button>
              </div>
              <div className="text-zinc-950 font-normal leading-relaxed">{unlockedContent}</div>
            </div>
            <p className="text-[11px] text-zinc-400 italic text-right pr-1">
              * Click anywhere outside or tap the exit arrow to automatically lock this post.
            </p>
          </div>
        ) : (
          /* Standard Public Post */
          <div className="text-zinc-900 text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words font-normal my-3">
            {post.content}
          </div>
        )}

        {/* Post Actions Bar: Like, Comments Toggle, Share (Hidden for Private Posts) */}
        {!isPrivatePost ? (
          <div className="flex items-center justify-between pt-3 mt-2 border-t border-zinc-100 text-xs text-zinc-600 gap-1">
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Like Button */}
              <button
                type="button"
                id={`btn-like-post-${post.id}`}
                onClick={handleLike}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition-all ${
                  isLiked
                    ? 'text-zinc-900 bg-zinc-100 border border-zinc-200/80 shadow-xs font-semibold'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 border border-transparent'
                }`}
                title={isLiked ? 'Unlike this post' : 'Like this post'}
              >
                <Heart
                  className={`w-4 h-4 transition-transform duration-200 ${
                    isLiked ? 'fill-zinc-900 text-zinc-900 scale-110' : 'group-hover:scale-110'
                  }`}
                />
                <span>{likesCount > 0 ? `${formatCompactNumber(likesCount)} Likes` : 'Like'}</span>
              </button>

              {/* Comments Toggle Button */}
              <button
                type="button"
                id={`btn-comments-post-${post.id}`}
                onClick={handleToggleComments}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition-colors ${
                  isCommentsOpen
                    ? 'bg-black text-white font-semibold'
                    : 'bg-zinc-900 text-white hover:bg-black'
                }`}
              >
                <MessageSquare className="w-4 h-4 text-white" />
                <span>{commentsCount > 0 ? `${commentsCount} Comments` : 'Comment'}</span>
                {isCommentsOpen ? (
                  <ChevronUp className="w-3.5 h-3.5 text-zinc-300" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-300" />
                )}
              </button>
            </div>

            {/* Share Button */}
            <button
              type="button"
              onClick={async () => {
                try {
                  const url = `${window.location.origin}${window.location.pathname}?post=${post.serialNumber}`;
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  // fallback
                }
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 transition-colors"
              title="Share post link"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">Copied link</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Share</span>
                </>
              )}
            </button>
          </div>
        ) : (
          /* Private post footer: Clean minimal footer without like or comment */
          <div className="flex items-center justify-between pt-2.5 mt-1 border-t border-zinc-100 text-[11px] text-zinc-400">
            <span className="flex items-center gap-1">
              <Lock className="w-3 h-3 text-amber-600" />
              <span>Private confidential post • No likes or comments</span>
            </span>

            {/* Share Button */}
            <button
              type="button"
              onClick={async () => {
                try {
                  const url = `${window.location.origin}${window.location.pathname}?post=${post.serialNumber}`;
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  // fallback
                }
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-zinc-100 text-zinc-500 hover:text-zinc-800 transition-colors"
              title="Share post link"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">Copied link</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Expandable Comments Drawer (Only rendered for non-private posts) */}
      {!isPrivatePost && isCommentsOpen && (
        <div className="border-t border-zinc-100 bg-zinc-50/70 p-4 sm:p-5 transition-all">
          <div className="space-y-3 mb-4">
            <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-2">
              <span>Discussion Thread</span>
              <span className="font-normal font-mono text-zinc-500">
                ({comments.length} {comments.length === 1 ? 'comment' : 'comments'})
              </span>
            </h4>

            {comments.length === 0 ? (
              <p className="text-xs text-zinc-400 italic py-2">
                No comments yet. Be the first to share your thoughts on #{post.serialNumber}!
              </p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {comments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    currentUserToken={currentUserToken}
                    onToggleCommentLike={(commentId, currentLiked) => {
                      setComments((prevComments) =>
                        prevComments.map((c) => {
                          if (c.id === commentId) {
                            const newLiked = !currentLiked;
                            const newLikedBy = newLiked
                              ? [...(c.likedBy || []), currentUserToken]
                              : (c.likedBy || []).filter((t) => t !== currentUserToken);
                            const newCount = Math.max(0, (c.likesCount || 0) + (newLiked ? 1 : -1));
                            return { ...c, likedBy: newLikedBy, likesCount: newCount };
                          }
                          return c;
                        })
                      );
                      toggleCommentLike(post.id, commentId, currentUserToken, currentLiked);
                    }}
                    onEditComment={handleEditComment}
                    onDeleteComment={handleDeleteComment}
                    soundEnabled={soundEnabled}
                  />
                ))}
              </div>
            )}
          </div>

          {/* New Comment Input Box */}
          <form onSubmit={handleCommentSubmit} className="flex items-center gap-2 pt-2 border-t border-zinc-200/60">
            <input
              ref={commentInputRef}
              type="text"
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder={`Write a comment on post #${post.serialNumber}...`}
              maxLength={1000}
              className="flex-1 bg-white border border-zinc-200/90 rounded-xl px-3 py-2 text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 shadow-md focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400"
            />
            <button
              type="submit"
              disabled={!newCommentText.trim() || isSubmittingComment}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                newCommentText.trim() && !isSubmittingComment
                  ? 'bg-zinc-900 text-white hover:bg-black shadow-xs'
                  : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
              }`}
            >
              {isSubmittingComment ? (
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-3 h-3" />
              )}
              <span>Reply</span>
            </button>
          </form>
        </div>
      )}
    </article>
  );
};
