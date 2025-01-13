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

export interface Message {
  id: string
  content: string
  channel_id: string
  user_id: string
  parent_id?: string
  file?: {
    name: string
    type: string
    size: number
    url: string
    path?: string
  } | null
  created_at: string
  updated_at: string
  user: {
    id: string
    name: string
    avatar?: string
  }
  reactions: {
    id: string
    emoji: string
    user_id: string
  }[]
  reply_count?: number
} 