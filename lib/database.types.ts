export interface Database {
  public: {
    Tables: {
      messages: {
        Row: {
          id: string;
          content: string;
          team_id: string;
          created_at: string;
          updated_at: string;
          user_id: string;
          metadata?: Record<string, any>;
        };
        Insert: {
          id?: string;
          content: string;
          team_id: string;
          created_at?: string;
          updated_at?: string;
          user_id: string;
          metadata?: Record<string, any>;
        };
        Update: {
          id?: string;
          content?: string;
          team_id?: string;
          created_at?: string;
          updated_at?: string;
          user_id?: string;
          metadata?: Record<string, any>;
        };
      };
      message_embeddings: {
        Row: {
          id: string;
          message_id: string;
          team_id: string;
          content: string;
          embedding: number[];
          metadata?: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          message_id: string;
          team_id: string;
          content: string;
          embedding: number[];
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          message_id?: string;
          team_id?: string;
          content?: string;
          embedding?: number[];
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
} 