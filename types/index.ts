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

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'user';
}

export interface Reaction {
  id: string;
  emoji: string;
  userId: string;
  messageId: string;
} 