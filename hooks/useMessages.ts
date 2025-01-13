'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import { RealtimePostgresChangesPayload, RealtimePostgresInsertPayload, RealtimePostgresUpdatePayload, RealtimePostgresDeletePayload } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { User, UserProfile } from '@/types'
import type { Message } from '@/types/chat'

type MessageRow = Database['public']['Tables']['messages']['Row']
type ReactionRow = Database['public']['Tables']['message_reactions']['Row']

interface UseMessagesOptions {
  channelId: string
  parentId?: string
}

interface UseMessagesReturn {
  messages: Message[]
  isLoading: boolean
  error: Error | null
  sendMessage: (content: string, file?: File) => Promise<void>
  addReaction: (messageId: string, emoji: string) => Promise<void>
  removeReaction: (messageId: string, emoji: string) => Promise<void>
}

interface RawUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  user_profiles: UserProfile[];
}

interface DirectMessageParticipant {
  user_id: string;
  user: User;
}

interface RawParticipant {
  user_id: string;
  user: RawUser;
}

interface MessageResponse {
  id: string;
  content: string;
  channel_id: string;
  sender_id?: string;
  user_id?: string;
  parent_id: string | null;
  file: {
    name: string;
    type: string;
    url: string;
  } | null;
  created_at: string;
  updated_at: string;
  sender: {
    id: string;
    email: string;
    name: string;
    avatar_url: string | null;
  };
  reactions?: Array<{
    id: string;
    emoji: string;
    user_id: string;
  }>;
  replies?: Array<{
    id: string;
  }>;
}

export function useMessages({ channelId, parentId }: UseMessagesOptions): UseMessagesReturn {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const { user } = useAuth()

  // Clear messages when channel or thread changes
  useEffect(() => {
    setMessages([])
    setIsLoading(true)
    setError(null)
  }, [channelId, parentId])

  useEffect(() => {
    setIsLoading(true)
    setError(null)

    // Fetch initial messages
    fetchMessages()

    // Subscribe to new messages
    const channel = supabase
      .channel(`messages:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`
        },
        async (payload: RealtimePostgresChangesPayload<MessageRow>) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newMessage = (payload as RealtimePostgresInsertPayload<MessageRow> | RealtimePostgresUpdatePayload<MessageRow>).new
            // Fetch the complete message data including user and reactions
            const { data: messageData, error: messageError } = await supabase
              .from('messages')
              .select(`
                *,
                sender:users!user_id (
                  id,
                  email,
                  name,
                  avatar_url
                ),
                reactions (
                  id,
                  emoji,
                  user_id
                ),
                replies:messages!parent_id (
                  id
                )
              `)
              .eq('id', newMessage.id)
              .single()

            if (messageError) {
              console.error('Error fetching message:', messageError)
              return
            }

            if (!messageData) return

            const transformedMessage: Message = {
              id: messageData.id,
              content: messageData.content,
              channelId: messageData.channel_id,
              userId: messageData.user_id,
              parentId: messageData.parent_id || null,
              file: messageData.file,
              createdAt: messageData.created_at,
              updatedAt: messageData.updated_at,
              user: {
                id: messageData.sender.id,
                name: messageData.sender.name || messageData.sender.email,
                avatar: messageData.sender.avatar_url
              },
              reactions: messageData.reactions?.map((r: { id: string; emoji: string; user_id: string }) => ({
                id: r.id,
                emoji: r.emoji,
                userId: r.user_id
              })) || [],
              replyCount: messageData.replies?.length || 0
            }

            if (payload.eventType === 'INSERT') {
              // If this is a reply, update the parent message's reply count
              if (transformedMessage.parentId && !parentId) {
                const { data: parentMessage } = await supabase
                  .from('messages')
                  .select('*, replies:messages!parent_id(id)')
                  .eq('id', transformedMessage.parentId)
                  .single()

                if (parentMessage) {
                  setMessages(prev => prev.map(msg => 
                    msg.id === transformedMessage.parentId 
                      ? { ...msg, replyCount: parentMessage.replies.length }
                      : msg
                  ))
                }
              } else {
                setMessages(prev => [...prev, transformedMessage])
              }
            } else {
              setMessages(prev => prev.map(msg => 
                msg.id === transformedMessage.id ? transformedMessage : msg
              ))
            }
          } else if (payload.eventType === 'DELETE') {
            const oldMessage = (payload as RealtimePostgresDeletePayload<MessageRow>).old
            setMessages(prev => prev.filter(msg => msg.id !== oldMessage.id))
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions'
        },
        async (payload: RealtimePostgresChangesPayload<ReactionRow>) => {
          if (!payload.eventType) return
          
          let messageId: string | undefined
          if (payload.eventType === 'DELETE') {
            messageId = (payload as RealtimePostgresDeletePayload<ReactionRow>).old.message_id
          } else {
            messageId = (payload as RealtimePostgresInsertPayload<ReactionRow> | RealtimePostgresUpdatePayload<ReactionRow>).new.message_id
          }

          if (!messageId) return

          const { data: messageData, error: messageError } = await supabase
            .from('messages')
            .select(`
              *,
              sender:users!user_id (
                id,
                email,
                name,
                avatar_url
              ),
              reactions (
                id,
                emoji,
                user_id
              )
            `)
            .eq('id', messageId)
            .single()

          if (messageError || !messageData) {
            console.error('Error fetching message after reaction change:', messageError)
            return
          }

          const transformedMessage: Message = {
            id: messageData.id,
            content: messageData.content,
            channelId: messageData.channel_id,
            userId: messageData.user_id,
            parentId: messageData.parent_id || null,
            file: messageData.file,
            createdAt: messageData.created_at,
            updatedAt: messageData.updated_at,
            user: {
              id: messageData.sender.id,
              name: messageData.sender.name || messageData.sender.email,
              avatar: messageData.sender.avatar_url
            },
            reactions: messageData.reactions?.map((r: { id: string; emoji: string; user_id: string }) => ({
              id: r.id,
              emoji: r.emoji,
              userId: r.user_id
            })) || [],
            replyCount: 0
          }

          setMessages(prev => prev.map(msg => 
            msg.id === messageId ? transformedMessage : msg
          ))
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [channelId, parentId])

  const fetchMessages = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Check if this is a direct message channel
      const { data: dmChannel, error: dmError } = await supabase
        .from('direct_message_channels')
        .select('id')
        .eq('id', channelId)
        .single();

      const isDM = !dmError && dmChannel;

      const baseQuery = `
        *,
        sender:${isDM ? 'users!sender_id' : 'users!user_id'}(
          id,
          email,
          name,
          avatar_url
        ),
        ${isDM ? 'reactions:direct_message_reactions' : 'reactions:message_reactions'}(
          id,
          emoji,
          user_id
        )${!isDM ? ', replies:messages!parent_id(id)' : ''}`;

      const query = supabase
        .from(isDM ? 'direct_messages' : 'messages')
        .select(baseQuery)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true });

      if (!isDM) {
        if (parentId) {
          // In thread view, get both the parent message and its replies
          query.or(`id.eq.${parentId},parent_id.eq.${parentId}`);
        } else {
          // In main view, only get messages without a parent
          query.is('parent_id', null);
        }
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      if (!data) return;

      // Type assertion for the database response
      const messages = data as unknown as Array<{
        id: string;
        content: string;
        channel_id: string;
        sender_id?: string;
        user_id?: string;
        parent_id: string | null;
        file: {
          name: string;
          type: string;
          size: number;
          url: string;
          path?: string;
        } | null;
        created_at: string;
        updated_at: string;
        sender: {
          id: string;
          email: string;
          name: string;
          avatar_url: string | null;
        };
        reactions?: Array<{
          id: string;
          emoji: string;
          user_id: string;
        }>;
        replies?: Array<{
          id: string;
        }>;
      }>;

      const transformedMessages: Message[] = messages.map(msg => {
        const userId = isDM ? msg.sender_id : msg.user_id;
        if (!userId) throw new Error('Message is missing user ID');

        return {
          id: msg.id,
          content: msg.content,
          channelId: msg.channel_id,
          userId,
          parentId: msg.parent_id || null,
          file: msg.file,
          createdAt: msg.created_at,
          updatedAt: msg.updated_at,
          user: {
            id: msg.sender.id,
            name: msg.sender.name || msg.sender.email,
            avatar: msg.sender.avatar_url || undefined
          },
          reactions: msg.reactions?.map((r) => ({
            id: r.id,
            emoji: r.emoji,
            userId: r.user_id
          })) || [],
          replyCount: msg.replies?.length || 0
        };
      });

      // Sort messages so parent appears first in thread view
      if (parentId) {
        transformedMessages.sort((a, b) => {
          if (a.id === parentId) return -1;
          if (b.id === parentId) return 1;
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });
      }

      setMessages(transformedMessages);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch messages'));
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (content: string, file?: File) => {
    if (!user) throw new Error('User not authenticated')

    try {
      let fileUrl: string | null = null
      let fileData: { name: string; type: string; size: number; url: string; path: string } | null = null
      
      if (file) {
        const fileExt = file.name.split('.').pop() || ''
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `${channelId}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('message-attachments')
          .upload(filePath, file)

        if (uploadError) throw uploadError

        const { data } = supabase.storage
          .from('message-attachments')
          .getPublicUrl(filePath)

        fileUrl = data.publicUrl

        // Create a proper file object with all required properties
        fileData = {
          name: file.name,
          type: file.type,
          size: file.size,
          url: fileUrl,
          path: filePath
        }
      }

      // Check if this is a direct message channel
      const { data: dmChannel, error: dmError } = await supabase
        .from('direct_message_channels')
        .select('id')
        .eq('id', channelId)
        .single();

      const isDM = !dmError && dmChannel;

      const messageData = isDM ? {
        channel_id: channelId,
        content,
        sender_id: user.id,
        file: fileData
      } : {
        channel_id: channelId,
        content,
        user_id: user.id,
        parent_id: parentId || null,
        file: fileData
      };

      const { data, error } = await supabase
        .from(isDM ? 'direct_messages' : 'messages')
        .insert(messageData)
        .select(`
          *,
          sender:${isDM ? 'users!sender_id' : 'users!user_id'}(
            id,
            email,
            name,
            avatar_url
          )
        `)
        .single();

      if (error) throw error;

      // Optimistically add the message to the UI immediately
      const optimisticMessage: Message = {
        id: data.id,
        content: data.content,
        channelId: data.channel_id,
        userId: isDM ? data.sender_id : data.user_id,
        parentId: data.parent_id || null,
        file: data.file,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        user: {
          id: data.sender.id,
          name: data.sender.name || data.sender.email,
          avatar: data.sender.avatar_url
        },
        reactions: [],
        replyCount: 0
      };

      setMessages(prev => [...prev, optimisticMessage])

    } catch (err) {
      console.error('Error sending message:', err)
      throw err
    }
  }

  const addReaction = async (messageId: string, emoji: string) => {
    if (!user) return;

    try {
      // Check if this is a direct message channel
      const { data: dmChannel, error: dmError } = await supabase
        .from('direct_message_channels')
        .select('id')
        .eq('id', channelId)
        .single();

      const isDM = !dmError && dmChannel;
      const reactionsTable = isDM ? 'direct_message_reactions' : 'message_reactions';

      // First check if the reaction already exists
      const { data: existingReactions, error: checkError } = await supabase
        .from(reactionsTable)
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji);

      if (checkError) {
        throw checkError;
      }

      if (existingReactions && existingReactions.length > 0) {
        // If reaction exists, remove it
        const { error } = await supabase
          .from(reactionsTable)
          .delete()
          .eq('id', existingReactions[0].id);

        if (error) throw error;

        // Update local state immediately
        setMessages(prev => prev.map(msg => {
          if (msg.id === messageId) {
            return {
              ...msg,
              reactions: (msg.reactions || []).filter(r => 
                !(r.emoji === emoji && r.userId === user.id)
              )
            };
          }
          return msg;
        }));
      } else {
        // Add the new reaction
        const { data: newReaction, error } = await supabase
          .from(reactionsTable)
          .insert({
            message_id: messageId,
            user_id: user.id,
            emoji
          })
          .select('id')
          .single();

        if (error) throw error;

        // Update local state immediately
        setMessages(prev => prev.map(msg => {
          if (msg.id === messageId) {
            return {
              ...msg,
              reactions: [...(msg.reactions || []), {
                id: newReaction.id,
                emoji,
                userId: user.id
              }]
            };
          }
          return msg;
        }));
      }
    } catch (err) {
      console.error('Error handling reaction:', err);
    }
  };

  const removeReaction = async (messageId: string, emoji: string) => {
    if (!user) return;

    try {
      // Check if this is a direct message channel
      const { data: dmChannel, error: dmError } = await supabase
        .from('direct_message_channels')
        .select('id')
        .eq('id', channelId)
        .single();

      const isDM = !dmError && dmChannel;
      const reactionsTable = isDM ? 'direct_message_reactions' : 'message_reactions';

      const { error } = await supabase
        .from(reactionsTable)
        .delete()
        .match({
          message_id: messageId,
          user_id: user.id,
          emoji
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error removing reaction:', error);
    }
  };

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    addReaction,
    removeReaction
  }
} 