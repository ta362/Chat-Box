import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { SerialPost, PostComment } from '../types';
import { CommentItem } from './CommentItem';
import {
  subscribeToPostComments,
  addPostComment,
  toggleCommentLike,
} from '../lib/firebase';
import { generateRealisticCommentsForPost } from '../lib/commentsEngine';
import { soundPlayer } from '../lib/audio';

interface PostCardProps {
  post: SerialPost;
  currentUserToken: string;
  onToggleLike: (postId: string, currentLiked: boolean) => void;
  onAddReaction: (postId: string, emoji: string) => void;
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
  soundEnabled,
}) => {
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [copied, setCopied] = useState(false);

  const isAuthor = post.authorToken === currentUserToken;
  const isLiked = Array.isArray(post.likedBy) && post.likedBy.includes(currentUserToken);
  const likesCount = typeof post.likesCount === 'number' ? post.likesCount : (post.likedBy?.length || 0);
  const commentsCount = Math.max(post.commentsCount || 0, comments.length);

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
    setIsCommentsOpen((prev) => !prev);
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

  const handleCopyLink = () => {
    const textToCopy = `Anonymous Post #${post.serialNumber}: "${post.content.substring(0, 100)}..."\n${window.location.origin}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      id={`post-card-${post.serialNumber}`}
      className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs hover:border-zinc-300 transition-all overflow-hidden"
    >
      <div className="p-4 sm:p-5">
        {/* Post Top Metadata: Serial Badge, Tag, Timestamp */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
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

            {isAuthor && (
              <span className="text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md">
                You
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono" title={formatExactDate(post.createdAt)}>
            <Clock className="w-3 h-3 ml-1" />
            <span>{formatTimeAgo(post.createdAt)}</span>
          </div>
        </div>

        {/* Post Main Content */}
        <div className="text-zinc-900 text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words font-normal my-3">
          {post.content}
        </div>

        {/* Post Actions Bar: Like, Comments Toggle, Share */}
        <div className="flex items-center justify-between pt-3 mt-2 border-t border-zinc-100 text-xs text-zinc-600 gap-1">
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Like Button */}
            <button
              type="button"
              id={`btn-like-post-${post.id}`}
              onClick={handleLike}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition-all ${
                isLiked
                  ? 'text-rose-600 bg-rose-50 border border-rose-200 shadow-xs font-semibold'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
              title={isLiked ? 'Unlike this post' : 'Like this post'}
            >
              <Heart
                className={`w-4 h-4 transition-transform duration-200 ${
                  isLiked ? 'fill-rose-500 text-rose-500 scale-110' : 'group-hover:scale-110'
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
                  ? 'bg-zinc-100 text-zinc-900 font-semibold'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>{commentsCount > 0 ? `${commentsCount} Comments` : 'Comment'}</span>
              {isCommentsOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Comments Drawer */}
      {isCommentsOpen && (
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
                    onToggleCommentLike={(commentId, currentLiked) =>
                      toggleCommentLike(post.id, commentId, currentUserToken, currentLiked)
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {/* New Comment Input Box */}
          <form onSubmit={handleCommentSubmit} className="flex items-center gap-2 pt-2 border-t border-zinc-200/60">
            <input
              type="text"
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder={`Write a comment on post #${post.serialNumber}...`}
              maxLength={1000}
              className="flex-1 bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400"
            />
            <button
              type="submit"
              disabled={!newCommentText.trim() || isSubmittingComment}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                newCommentText.trim() && !isSubmittingComment
                  ? 'bg-zinc-900 text-white hover:bg-zinc-800 shadow-xs'
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
