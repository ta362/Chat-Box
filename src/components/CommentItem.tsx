import React, { useState } from 'react';
import { Heart, Clock } from 'lucide-react';
import { PostComment } from '../types';

interface CommentItemProps {
  comment: PostComment;
  currentUserToken: string;
  onToggleCommentLike: (commentId: string, currentLiked: boolean) => void;
}

export const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  currentUserToken,
  onToggleCommentLike,
}) => {
  const isAuthor = comment.authorToken === currentUserToken;
  const isLiked = Array.isArray(comment.likedBy) && comment.likedBy.includes(currentUserToken);
  const likesCount = typeof comment.likesCount === 'number' ? comment.likesCount : (comment.likedBy?.length || 0);

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

  return (
    <div
      id={`comment-${comment.id}`}
      className="flex items-start justify-between gap-3 p-3 rounded-xl bg-zinc-50 border border-zinc-100 hover:border-zinc-200 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-zinc-800">
            {isAuthor ? 'You (Anonymous)' : 'Anonymous'}
          </span>
          <span className="text-[11px] text-zinc-400 flex items-center gap-1 font-mono">
            <Clock className="w-2.5 h-2.5" />
            {formatTimeAgo(comment.createdAt)}
          </span>
        </div>
        <p className="text-xs sm:text-sm text-zinc-700 whitespace-pre-wrap break-words leading-relaxed">
          {comment.content}
        </p>
      </div>

      <button
        type="button"
        id={`btn-like-comment-${comment.id}`}
        onClick={() => onToggleCommentLike(comment.id, isLiked)}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all ${
          isLiked
            ? 'text-rose-600 bg-rose-50 border border-rose-100 font-semibold'
            : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/50'
        }`}
        title={isLiked ? 'Unlike comment' : 'Like comment'}
      >
        <Heart className={`w-3 h-3 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
        <span>{likesCount > 0 ? likesCount : ''}</span>
      </button>
    </div>
  );
};
