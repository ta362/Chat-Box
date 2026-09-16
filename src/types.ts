export interface MessageReaction {
  emoji: string;
  count: number;
}

export interface PostComment {
  id: string;
  postId: string;
  content: string;
  createdAt: number;
  authorToken: string;
  likesCount?: number;
  likedBy?: string[];
}

export interface SerialPost {
  id: string;
  serialNumber: number;
  content: string;
  createdAt: number;
  authorToken: string;
  likesCount: number;
  targetLikes?: number;
  commentsCount: number;
  targetComments?: number;
  likedBy?: string[];
  reactions?: Record<string, number>;
  tag?: string;
}

// Backward compatibility alias for any older references
export type ChatMessage = SerialPost;

export type PostSortOption = 'serial-asc' | 'serial-desc' | 'popular' | 'latest';

export interface ServerStats {
  totalPosts: number;
  onlineCount: number;
}

export interface WsMessageEvent {
  type: 'init' | 'post:created' | 'post:liked' | 'comment:created' | 'presence:update' | 'pong';
  payload?: any;
}

