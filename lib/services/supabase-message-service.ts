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
        user:users (
          id,
          name,
          avatar
        ),
        reactions (
          id,
          emoji,
          userId
        )
      `)
      .eq('channelId', channelId)
      .order('createdAt', { ascending: true });

    if (error) throw error;
    if (!data) return [];

    return data.map(msg => ({
      id: msg.id,
      content: msg.content,
      createdAt: new Date(msg.createdAt),
      userId: msg.userId,
      channelId: msg.channelId,
      parentId: msg.parentId,
      user: msg.user,
      file: msg.file,
      reactions: msg.reactions
    }));
  }

  async createMessage(message: Omit<Message, 'id' | 'createdAt'>): Promise<Message> {
    // Get the current user's session
    const { data: { session }, error: sessionError } = await this.supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) throw new Error('Not authenticated');

    // If there's a file with an empty URL, it means we need to upload it
    let fileData = message.file;
    if (fileData && !fileData.url && fileData.name) {
      const file = await fetch(fileData.url).then(res => res.blob());
      const publicUrl = await this.uploadFile(new File([file], fileData.name, { type: fileData.type }));
      fileData = { ...fileData, url: publicUrl };
    }

    // Insert the message into the messages table
    const { data, error } = await this.supabase
      .from('messages')
      .insert({
        content: message.content,
        userId: session.user.id,
        channelId: message.channelId,
        parentId: message.parentId,
        file: fileData
      })
      .select(`
        *,
        user:users (
          id,
          name,
          avatar
        )
      `)
      .single();

    if (error) throw error;
    if (!data) throw new Error('Failed to create message');

    return {
      ...data,
      createdAt: new Date(data.createdAt),
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
      .from('reactions')
      .insert({
        messageId,
        emoji,
        userId: session.user.id
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
      .from('reactions')
      .delete()
      .match({
        messageId,
        emoji,
        userId: session.user.id
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