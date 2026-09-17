import React, { useState } from 'react';
import { Heart, Clock, Edit3, Trash2, Lock } from 'lucide-react';
import { PostComment } from '../types';
import { soundPlayer } from '../lib/audio';

interface CommentItemProps {
  comment: PostComment;
  currentUserToken: string;
  onToggleCommentLike: (commentId: string, currentLiked: boolean) => void;
  onEditComment: (commentId: string, newContent: string, commentAuthorToken: string, createdAt: number) => Promise<{ success: boolean; message?: string }>;
  onDeleteComment: (commentId: string, commentAuthorToken: string) => Promise<{ success: boolean; message?: string }>;
  soundEnabled: boolean;
}

export const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  currentUserToken,
  onToggleCommentLike,
  onEditComment,
  onDeleteComment,
  soundEnabled,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const isAuthor = comment.authorToken === currentUserToken;
  const isLiked = Array.isArray(comment.likedBy) && comment.likedBy.includes(currentUserToken);
  const likesCount = typeof comment.likesCount === 'number' ? comment.likesCount : (comment.likedBy?.length || 0);

  const THIRTY_MINUTES_MS = 30 * 60 * 1000;
  const elapsed = Date.now() - comment.createdAt;
  const isEditable = isAuthor && elapsed <= THIRTY_MINUTES_MS;
  const remainingMinutes = Math.max(0, Math.ceil((THIRTY_MINUTES_MS - elapsed) / (1000 * 60)));

  const handleSaveEdit = async () => {
    if (!editContent.trim() || isSaving) return;
    setIsSaving(true);
    setEditError('');
    try {
      const res = await onEditComment(comment.id, editContent, comment.authorToken, comment.createdAt);
      if (res.success) {
        setIsEditing(false);
        if (soundEnabled) soundPlayer.playPop();
      } else {
        setEditError(res.message || 'Failed to update');
      }
    } catch (err: any) {
      setEditError(err?.message || 'Failed to update');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;
    setIsDeleting(true);
    try {
      const res = await onDeleteComment(comment.id, comment.authorToken);
      if (!res.success) {
        alert(res.message || 'Failed to delete comment');
      } else {
        if (soundEnabled) soundPlayer.playPop();
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to delete comment');
    } finally {
      setIsDeleting(false);
    }
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

  return (
    <div
      id={`comment-${comment.id}`}
      className="p-3.5 rounded-2xl bg-white border border-zinc-200/90 shadow-[0_12px_24px_-6px_rgba(0,0,0,0.1)] hover:shadow-[0_16px_28px_-6px_rgba(0,0,0,0.14)] transition-all"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-zinc-800">
            {isAuthor ? 'You (Anon)' : 'Anon'}
          </span>
          <span className="text-[11px] text-zinc-400 flex items-center gap-1 font-mono">
            <Clock className="w-2.5 h-2.5" />
            {formatTimeAgo(comment.createdAt)}
          </span>

          {isAuthor && (
            <>
              {isEditable ? (
                <span className="text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">
                  Edit ({remainingMinutes}m left)
                </span>
              ) : (
                <span className="text-[10px] font-medium bg-zinc-100 text-zinc-600 border border-zinc-200 px-1.5 py-0.5 rounded flex items-center gap-1" title="Edit window expired (30 mins)">
                  <Lock className="w-2.5 h-2.5 text-zinc-500" />
                  Locked
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {/* Edit / Delete buttons for author */}
          {isAuthor && !isEditing && (
            <div className="flex items-center gap-1">
              {isEditable && (
                <button
                  type="button"
                  onClick={() => {
                    setEditContent(comment.content);
                    setIsEditing(true);
                  }}
                  className="p-1 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60 rounded transition-colors"
                  title="Edit comment (Within 30 mins)"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
              )}
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                title="Delete comment (Permanent)"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}

          <button
            type="button"
            id={`btn-like-comment-${comment.id}`}
            onClick={() => onToggleCommentLike(comment.id, isLiked)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all ${
              isLiked
                ? 'text-zinc-900 bg-zinc-100 border border-zinc-200/80 font-semibold'
                : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/50'
            }`}
            title={isLiked ? 'Unlike comment' : 'Like comment'}
          >
            <Heart className={`w-3 h-3 ${isLiked ? 'fill-zinc-900 text-zinc-900' : ''}`} />
            <span>{likesCount > 0 ? likesCount : ''}</span>
          </button>
        </div>
      </div>

      {isEditing ? (
        <div className="mt-2 space-y-2">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={2}
            className="w-full bg-white border border-zinc-200 rounded-lg p-2 text-xs sm:text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900/20"
            placeholder="Edit comment..."
          />
          {editError && <p className="text-[11px] text-rose-600 font-medium">{editError}</p>}
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setEditContent(comment.content);
                setEditError('');
              }}
              disabled={isSaving}
              className="px-2.5 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-200/60 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={!editContent.trim() || isSaving}
              className="px-3 py-1 text-[11px] font-semibold bg-zinc-900 text-white hover:bg-black rounded transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs sm:text-sm font-bold text-zinc-900 whitespace-pre-wrap break-words leading-relaxed mt-1 drop-shadow-[0_2px_3px_rgba(0,0,0,0.08)]">
          {comment.content}
        </p>
      )}
    </div>
  );
};
