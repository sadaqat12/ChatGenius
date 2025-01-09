export interface Message {
  id: string;
  content: string;
  createdAt: Date;
  userId: string;
  channelId: string;
  parentId: string | null;  // null for parent messages, message ID for replies
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  file?: {
    name: string;
    type: string;
    url: string;
  };
  reactions: Array<{
    id: string;
    emoji: string;
    userId: string;
  }>;
}

export interface MessageService {
  getMessages(channelId: string): Promise<Message[]>;
  createMessage(message: Omit<Message, 'id' | 'createdAt'>): Promise<Message>;
  addReaction(messageId: string, emoji: string, userId: string): Promise<void>;
  removeReaction(messageId: string, emoji: string, userId: string): Promise<void>;
} 