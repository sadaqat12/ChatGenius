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
    const { data, error } = await this.supabase
      .from('messages')
      .select(`
        *,
        user:users!user_id (
          id,
          email,
          user_profiles!inner (
            name,
            avatar_url,
            status
          )
        ),
        reactions!message_id (
          id,
          emoji,
          user:users!user_id (
            id,
            email,
            user_profiles!inner (
              name,
              avatar_url,
              status
            )
          )
        )
      `)
      .eq('channel_id', channelId)
      .is('parent_id', null)
      .order('created_at', { ascending: true });

    if (error) throw error;
    if (!data) return [];

    return data.map(msg => ({
      id: msg.id,
      content: msg.content,
      channelId: msg.channel_id,
      userId: msg.user_id,
      parentId: msg.parent_id,
      file: msg.file,
      createdAt: new Date(msg.created_at),
      user: {
        id: msg.user.id,
        name: msg.user.user_profiles.name,
        email: msg.user.email,
        avatar_url: msg.user.user_profiles.avatar_url
      },
      reactions: msg.reactions?.map((r: any) => ({
        id: r.id,
        emoji: r.emoji,
        userId: r.user.id,
        user: {
          id: r.user.id,
          name: r.user.user_profiles.name,
          email: r.user.email,
          avatar_url: r.user.user_profiles.avatar_url
        }
      })) || [],
      thread_count: msg.thread_count || 0
    }));
  }

  async createMessage(message: Omit<Message, 'id' | 'createdAt' | 'thread_count'>): Promise<Message> {
    // Get the current user's session
    const { data: { session }, error: sessionError } = await this.supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) throw new Error('Not authenticated');

    // If there's a file, upload it first
    let fileData = message.file;
    if (fileData && 'size' in fileData) {
      const publicUrl = await this.uploadFile(fileData as unknown as File);
      fileData = {
        name: fileData.name,
        type: fileData.type,
        size: fileData.size,
        url: publicUrl,
        path: undefined
      };
    }

    const { data, error } = await this.supabase
      .from('messages')
      .insert({
        content: message.content,
        user_id: session.user.id,
        channel_id: message.channelId,
        parent_id: message.parentId,
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
        ),
        reactions (
          id,
          emoji,
          user_id
        )
      `)
      .single();

    if (error) throw error;
    if (!data) throw new Error('Failed to create message');

    return {
      id: data.id,
      content: data.content,
      channelId: data.channel_id,
      userId: data.user_id,
      parentId: data.parent_id,
      file: data.file,
      createdAt: new Date(data.created_at),
      user: {
        id: data.user.id,
        name: data.user.user_profiles[0]?.name || data.user.email,
        email: data.user.email,
        avatar_url: data.user.user_profiles[0]?.avatar_url
      },
      reactions: [],
      thread_count: 0
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
      .from('reactions')
      .delete()
      .match({
        message_id: messageId,
        user_id: session.user.id,
        emoji
      });

    if (error) throw error;
  }

  private formatMessage(msg: any): Message {
    return {
      id: msg.id,
      content: msg.content,
      channelId: msg.channel_id,
      userId: msg.user_id,
      parentId: msg.parent_id,
      createdAt: new Date(msg.created_at),
      user: {
        id: msg.user?.id,
        name: msg.user?.name || msg.user?.email?.split('@')[0] || 'Unknown',
        email: msg.user?.email || '',
        avatar_url: msg.user?.avatar_url
      },
      file: msg.file,
      thread_count: msg.thread_count || 0,
      reactions: msg.reactions || []
    }
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