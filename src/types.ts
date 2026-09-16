export interface MessageReaction {
  emoji: string;
  count: number;
}

export interface ChatMessage {
  id: string;
  serialNumber: number;
  text: string;
  createdAt: number;
  // Optional anonymous client signature (hashed or tokenized so local client knows it's theirs)
  authorToken?: string;
  reactions?: Record<string, number>;
  replyTo?: {
    serialNumber: number;
    text: string;
  } | null;
}

export interface ServerStats {
  totalMessages: number;
  onlineCount: number;
}

export interface WsMessageEvent {
  type: 'init' | 'message:created' | 'message:reaction' | 'presence:update' | 'pong';
  payload?: any;
}
