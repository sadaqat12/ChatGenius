export interface Team {
  id: string;
  name: string;
  channels: Channel[];
  members: User[];
}

export interface Channel {
  id: string;
  name: string;
  teamId: string;
  isPrivate: boolean;
  allowedUserIds?: string[];  // For private channels
}

export interface Message {
  id: string;
  content: string;
  createdAt: Date;
  userId: string;
  channelId: string;
  parentId: string | null;    // null for main messages, message ID for replies
  replyCount: number;
  reactions: Reaction[];
}

export interface Reaction {
  id: string;
  emoji: string;
  userId: string;
  messageId: string;
}

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'user';
} 