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
      channel_members: {
        Row: {
          channel_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          user_id?: string
        }
      }
      channels: {
        Row: {
          id: string
          name: string
          description: string | null
          team_id: string
          is_private: boolean
          created_by: string
          updated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          team_id: string
          is_private?: boolean
          created_by: string
          updated_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          team_id?: string
          is_private?: boolean
          created_by?: string
          updated_at?: string
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
      direct_messages: {
        Row: {
          id: string
          content: string
          channel_id: string
          sender_id: string
          file: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          content: string
          channel_id: string
          sender_id: string
          file?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          content?: string
          channel_id?: string
          sender_id?: string
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
      team_invites: {
        Row: {
          id: string
          team_id: string
          email: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_id: string
          email: string
          status: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          email?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      team_members: {
        Row: {
          team_id: string
          user_id: string
          role: string
          created_at: string
        }
        Insert: {
          team_id: string
          user_id: string
          role?: string
          created_at?: string
        }
        Update: {
          team_id?: string
          user_id?: string
          role?: string
          created_at?: string
        }
      }
      teams: {
        Row: {
          id: string
          name: string
          description: string | null
          created_by: string
          updated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_by: string
          updated_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_by?: string
          updated_at?: string
          created_at?: string
        }
      }
      user_profiles: {
        Row: {
          id: string
          user_id: string
          name: string
          avatar_url: string | null
          status: 'online' | 'away' | 'busy' | 'offline'
          status_updated_at: string
          created_at: string
          updated_at: string
          pending_team_name: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          avatar_url?: string | null
          status?: 'online' | 'away' | 'busy' | 'offline'
          status_updated_at?: string
          created_at?: string
          updated_at?: string
          pending_team_name?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          avatar_url?: string | null
          status?: 'online' | 'away' | 'busy' | 'offline'
          status_updated_at?: string
          created_at?: string
          updated_at?: string
          pending_team_name?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
} 