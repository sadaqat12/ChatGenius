export interface Message {
  id: string;
  content: string;
  channelId: string;
  userId: string;
  parentId?: string;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    avatar_url?: string;
  };
  file?: {
    name: string;
    type: string;
    size: number;
    url: string;
    path?: string;
  };
  thread_count: number;
  reactions: Reaction[];
}

export interface Reaction {
  id: string;
  emoji: string;
  userId: string;
}

export interface MessageService {
  getMessages(channelId: string): Promise<Message[]>;
  createMessage(message: Omit<Message, 'id' | 'createdAt' | 'thread_count'>): Promise<Message>;
  addReaction(messageId: string, emoji: string, userId: string): Promise<void>;
  removeReaction(messageId: string, emoji: string, userId: string): Promise<void>;
} 