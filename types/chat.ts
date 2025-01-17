export type ActiveChat = {
  type: 'channel' | 'directMessage'
  id: string
  name: string
  threadId?: string
}

export interface Channel {
  id: string
  name: string
  description?: string
  team_id: string
  is_private: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface DirectMessage {
  id: string
  user_id: string
  name: string
  avatar?: string
}

export interface Team {
  id: string
  name: string
  description?: string
  created_at: string
  updated_at: string
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  status?: 'online' | 'away' | 'busy' | 'offline';
}

export interface Message {
  id: string;
  content: string;
  user: User;
  channel_id: string;
  parent_id?: string;
  created_at: string;
  updated_at: string;
  type?: 'channel' | 'direct';
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
  users: User[];
  count: number;
}

export interface DirectMessageChannel {
  id: string;
  participants: User[];
  created_at: string;
}

export interface DirectMessage extends Omit<Message, 'channel_id'> {
  channel_id: string;
} 