export interface Message {
  id: string;
  content: string;
  channelId: string;
  userId: string;
  parentId?: string | null;  // null for parent messages, message ID for replies
  file?: {
    name: string;
    type: string;
    url: string;
  };
  createdAt: Date;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  reactions: Array<{
    id: string;
    emoji: string;
    userId: string;
  }>;
  reply_count: number;
}

export interface MessageService {
  getMessages(channelId: string): Promise<Message[]>;
  createMessage(message: Omit<Message, 'id' | 'createdAt' | 'reply_count'>): Promise<Message>;
  addReaction(messageId: string, emoji: string, userId: string): Promise<void>;
  removeReaction(messageId: string, emoji: string, userId: string): Promise<void>;
} 