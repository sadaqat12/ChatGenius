export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      messages: {
        Row: {
          id: string
          content: string
          channel_id: string
          user_id: string
          parent_id: string | null
          file: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          content: string
          channel_id: string
          user_id: string
          parent_id?: string | null
          file?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          content?: string
          channel_id?: string
          user_id?: string
          parent_id?: string | null
          file?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      message_reactions: {
        Row: {
          id: string
          message_id: string
          user_id: string
          emoji: string
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          user_id: string
          emoji: string
          created_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          user_id?: string
          emoji?: string
          created_at?: string
        }
      }
      direct_message_channels: {
        Row: {
          id: string
          created_at: string
        }
        Insert: {
          id?: string
          created_at?: string
        }
        Update: {
          id?: string
          created_at?: string
        }
      }
      direct_message_participants: {
        Row: {
          channel_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          channel_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          channel_id?: string
          user_id?: string
          created_at?: string
        }
      }
      direct_messages: {
        Row: {
          id: string
          content: string
          channel_id: string
          sender_id: string
          file: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          content: string
          channel_id: string
          sender_id: string
          file?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          content?: string
          channel_id?: string
          sender_id?: string
          file?: Json | null
          created_at?: string
        }
      }
      direct_message_reactions: {
        Row: {
          id: string
          message_id: string
          user_id: string
          emoji: string
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          user_id: string
          emoji: string
          created_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          user_id?: string
          emoji?: string
          created_at?: string
        }
      }
      user_profiles: {
        Row: {
          id: string
          user_id: string
          name: string
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      users: {
        Row: {
          id: string
          email: string
          name: string | null
          avatar_url: string | null
        }
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
} 