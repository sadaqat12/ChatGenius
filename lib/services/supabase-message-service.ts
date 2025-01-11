import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Message, MessageService } from '@/types/message';

export class SupabaseMessageService implements MessageService {
  private supabase: SupabaseClient;

  constructor() {
    // Initialize Supabase client
    // You'll need to add these environment variables
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  private async uploadFile(file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError, data } = await this.supabase.storage
      .from('message-attachments')
      .upload(filePath, file);

    if (uploadError) {
      throw uploadError;
    }

    const { data: { publicUrl } } = this.supabase.storage
      .from('message-attachments')
      .getPublicUrl(filePath);

    return publicUrl;
  }

  async getMessages(channelId: string): Promise<Message[]> {
    // Fetch messages from the messages table
    // Join with users table to get user information
    const { data, error } = await this.supabase
      .from('messages')
      .select(`
        *,
        user:user_id (
          id,
          email,
          user_profiles (
            name,
            avatar_url
          )
        ),
        reactions (
          id,
          emoji,
          user_id
        )
      `)
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    if (!data) return [];

    return data.map(msg => ({
      id: msg.id,
      content: msg.content,
      channel_id: msg.channel_id,
      user_id: msg.user_id,
      parent_id: msg.parent_id,
      file: msg.file,
      created_at: msg.created_at,
      updated_at: msg.updated_at,
      user: {
        id: msg.user.id,
        name: msg.user.user_profiles[0]?.name || msg.user.email,
        avatar: msg.user.user_profiles[0]?.avatar_url
      },
      reactions: msg.reactions?.map((r: { id: string; emoji: string; user_id: string }) => ({
        id: r.id,
        emoji: r.emoji,
        userId: r.user_id
      })) || []
    }));
  }

  async createMessage(message: Omit<Message, 'id' | 'created_at'>): Promise<Message> {
    // Get the current user's session
    const { data: { session }, error: sessionError } = await this.supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) throw new Error('Not authenticated');

    // If there's a file, upload it first
    let fileData = message.file;
    if (fileData && fileData instanceof File) {
      const publicUrl = await this.uploadFile(fileData);
      fileData = {
        name: fileData.name,
        type: fileData.type,
        url: publicUrl
      };
    }

    // Insert the message into the messages table
    const { data, error } = await this.supabase
      .from('messages')
      .insert({
        content: message.content,
        user_id: session.user.id,
        channel_id: message.channel_id,
        parent_id: message.parent_id,
        file: fileData
      })
      .select(`
        *,
        user:user_id (
          id,
          email,
          user_profiles (
            name,
            avatar_url
          )
        )
      `)
      .single();

    if (error) throw error;
    if (!data) throw new Error('Failed to create message');

    return {
      id: data.id,
      content: data.content,
      channel_id: data.channel_id,
      user_id: data.user_id,
      parent_id: data.parent_id,
      file: data.file,
      created_at: data.created_at,
      updated_at: data.updated_at,
      user: {
        id: data.user.id,
        name: data.user.user_profiles[0]?.name || data.user.email,
        avatar: data.user.user_profiles[0]?.avatar_url
      },
      reactions: []
    };
  }

  async addReaction(messageId: string, emoji: string, userId: string): Promise<void> {
    // Get the current user's session
    const { data: { session }, error: sessionError } = await this.supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) throw new Error('Not authenticated');

    // Insert a new reaction into the reactions table
    const { error } = await this.supabase
      .from('message_reactions')
      .insert({
        message_id: messageId,
        user_id: session.user.id,
        emoji
      });

    if (error) throw error;
  }

  async removeReaction(messageId: string, emoji: string, userId: string): Promise<void> {
    // Get the current user's session
    const { data: { session }, error: sessionError } = await this.supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) throw new Error('Not authenticated');

    // Delete the reaction from the reactions table
    const { error } = await this.supabase
      .from('message_reactions')
      .delete()
      .match({
        message_id: messageId,
        user_id: session.user.id,
        emoji
      });

    if (error) throw error;
  }
}

/*
Required Supabase Database Schema:

-- Messages table
create table messages (
  id uuid default uuid_generate_v4() primary key,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users not null,
  channel_id text not null,
  parent_id uuid references messages(id),
  file jsonb
);

-- Reactions table
create table reactions (
  id uuid default uuid_generate_v4() primary key,
  message_id uuid references messages(id) not null,
  emoji text not null,
  user_id uuid references auth.users not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(message_id, emoji, user_id)
);

-- Enable Supabase Storage for file uploads
-- Create a new bucket called 'message-attachments' with public access

-- Row Level Security Policies
alter table messages enable row level security;
alter table reactions enable row level security;

-- Messages policies
create policy "Messages are viewable by channel members" on messages
  for select using (
    -- Add your channel membership check here
    true
  );

create policy "Authenticated users can insert messages" on messages
  for insert with check (
    auth.role() = 'authenticated'
    -- Add your channel membership check here
  );

-- Reactions policies
create policy "Reactions are viewable by channel members" on reactions
  for select using (
    -- Add your channel membership check here
    true
  );

create policy "Authenticated users can manage their reactions" on reactions
  for all using (
    auth.uid() = user_id
  );
*/ 