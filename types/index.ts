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
  email: string;
  name: string;
  avatar_url?: string;
  user_profiles: UserProfile[];
}

export interface Reaction {
  id: string;
  emoji: string;
  userId: string;
  messageId: string;
}

export interface UserProfile {
  name: string;
} 