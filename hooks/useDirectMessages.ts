'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import type { Database } from '@/types/supabase'

type DbResult<T> = T extends PromiseLike<infer U> ? U : never
type DbResultOk<T> = DbResult<T> extends { data: infer U } ? U : never

interface UserProfile {
  name: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  user_profiles: UserProfile[];
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

interface RawMessage {
  id: string;
  content: string;
  sender_id: string;
  file: {
    name: string;
    type: string;
    url: string;
  } | null;
  created_at: string;
  sender: RawUser;
  reactions: {
    id: string;
    emoji: string;
    user_id: string;
  }[] | null;
}

interface DirectMessageChannel {
  id: string;
  participants: DirectMessageParticipant[];
}

interface DirectMessage {
  id: string;
  content: string;
  sender_id: string;
  file?: {
    name: string;
    type: string;
    url: string;
  };
  created_at: string;
  sender: User;
  reactions: {
    id: string;
    emoji: string;
    user_id: string;
  }[];
}

export function useDirectMessages() {
  const [channels, setChannels] = useState<DirectMessageChannel[]>([])
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null)
  const { user } = useAuth()

  useEffect(() => {
    if (user) {
      fetchChannels()
    }
  }, [user])

  useEffect(() => {
    if (activeChannelId) {
      fetchMessages(activeChannelId)
      
      // Subscribe to new messages
      const channel = supabase
        .channel(`dm:${activeChannelId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'direct_messages',
            filter: `channel_id=eq.${activeChannelId}`
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const newMessage = payload.new as DirectMessage
              setMessages(prev => [...prev, newMessage])
            } else if (payload.eventType === 'UPDATE') {
              const updatedMessage = payload.new as DirectMessage
              setMessages(prev => prev.map(msg => 
                msg.id === updatedMessage.id ? updatedMessage : msg
              ))
            }
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [activeChannelId])

  const fetchChannels = async () => {
    try {
      type RawChannel = {
        id: string;
        participants: RawParticipant[];
      };

      const { data: channelsData, error: channelsError } = await supabase
        .from('direct_message_channels')
        .select(`
          id,
          created_at,
          participants:direct_message_participants!inner(
            user_id,
            user:users!inner(
              id,
              email,
              name,
              avatar_url,
              user_profiles (
                name
              )
            )
          )
        `)
        .order('created_at', { ascending: false })

      if (channelsError) throw channelsError

      const transformedChannels: DirectMessageChannel[] = (channelsData as RawChannel[] ?? []).map(channel => ({
        id: channel.id,
        participants: channel.participants.map(p => ({
          user_id: p.user_id,
          user: {
            id: p.user.id,
            email: p.user.email,
            name: p.user.name,
            avatar_url: p.user.avatar_url ?? undefined,
            user_profiles: p.user.user_profiles
          }
        }))
      }))

      setChannels(transformedChannels)
    } catch (error) {
      console.error('Error fetching DM channels:', error)
    }
  }

  const fetchMessages = async (channelId: string) => {
    try {
      const { data: messagesData, error: messagesError } = await supabase
        .from('direct_messages')
        .select(`
          id,
          content,
          channel_id,
          sender_id,
          sender:users!inner(
            id,
            email,
            name,
            avatar_url,
            user_profiles (
              name
            )
          ),
          file,
          created_at,
          reactions:direct_message_reactions(
            id,
            emoji,
            user_id
          )
        `)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })

      if (messagesError) throw messagesError

      const transformedMessages: DirectMessage[] = (messagesData as RawMessage[] ?? []).map(msg => ({
        id: msg.id,
        content: msg.content,
        sender_id: msg.sender_id,
        file: msg.file ?? undefined,
        created_at: msg.created_at,
        sender: {
          id: msg.sender.id,
          email: msg.sender.email,
          name: msg.sender.name,
          avatar_url: msg.sender.avatar_url ?? undefined,
          user_profiles: msg.sender.user_profiles
        },
        reactions: msg.reactions ?? []
      }))

      setMessages(transformedMessages)
    } catch (error) {
      console.error('Error fetching messages:', error)
    }
  }

  const createChannel = async (otherUserId: string) => {
    if (!user) return null

    try {
      // Create a new channel first
      const { data: newChannel, error: createError } = await supabase
        .from('direct_message_channels')
        .insert({})
        .select()
        .single()

      if (createError) throw createError

      // Add the current user first
      const { error: currentUserError } = await supabase
        .from('direct_message_participants')
        .insert({ channel_id: newChannel.id, user_id: user.id })

      if (currentUserError) throw currentUserError

      // Then add the other user
      const { error: otherUserError } = await supabase
        .from('direct_message_participants')
        .insert({ channel_id: newChannel.id, user_id: otherUserId })

      if (otherUserError) throw otherUserError

      await fetchChannels()
      return newChannel.id
    } catch (error) {
      console.error('Error creating DM channel:', error)
      return null
    }
  }

  const sendMessage = async (content: string, file?: File) => {
    if (!user || !activeChannelId) return

    try {
      let fileData
      if (file) {
        const { data: uploadData, error: uploadError } = await supabase
          .storage
          .from('dm-attachments')
          .upload(`${activeChannelId}/${Date.now()}-${file.name}`, file)

        if (uploadError) throw uploadError
        
        const { data: { publicUrl } } = supabase
          .storage
          .from('dm-attachments')
          .getPublicUrl(uploadData.path)

        fileData = {
          name: file.name,
          type: file.type,
          url: publicUrl
        }
      }

      const { error } = await supabase
        .from('direct_messages')
        .insert({
          content,
          channel_id: activeChannelId,
          sender_id: user.id,
          file: fileData
        })

      if (error) throw error
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  const addReaction = async (messageId: string, emoji: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('direct_message_reactions')
        .insert({
          message_id: messageId,
          user_id: user.id,
          emoji
        })

      if (error) throw error
    } catch (error) {
      console.error('Error adding reaction:', error)
    }
  }

  const removeReaction = async (messageId: string, emoji: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('direct_message_reactions')
        .delete()
        .match({
          message_id: messageId,
          user_id: user.id,
          emoji
        })

      if (error) throw error
    } catch (error) {
      console.error('Error removing reaction:', error)
    }
  }

  return {
    channels,
    messages,
    activeChannelId,
    setActiveChannelId,
    createChannel,
    sendMessage,
    addReaction,
    removeReaction
  }
} 