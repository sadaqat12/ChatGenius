'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import type { Database } from '@/types/supabase'

type DbResult<T> = T extends PromiseLike<infer U> ? U : never
type DbResultOk<T> = DbResult<T> extends { data: infer U } ? U : never

interface UserProfile {
  name: string | null;
  avatar_url: string | null;
  status: string | null;
}

interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  status: string | null;
  user_profiles: UserProfile[];
}

interface RawUser {
  id: string;
  email: string;
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
  channel_id: string;
  sender_id: string;
  sender: {
    id: string;
    email: string;
    name: string;
    avatar_url: string | null;
    user_profiles: { name: string; }[];
  };
  file: {
    name: string;
    type: string;
    url: string;
  } | null;
  created_at: string;
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

interface SupabaseParticipant {
  user_id: string;
  user: {
    id: string;
    email: string;
    user_profiles: {
      name: string | null;
      avatar_url: string | null;
      status: string | null;
    }[];
  };
}

interface SupabaseChannel {
  id: string;
  created_at: string;
  participants: SupabaseParticipant[];
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

  const fetchChannels = async () => {
    try {
      const { data: channelsData, error: channelsError } = await supabase
        .from('direct_message_channels')
        .select(`
          id,
          created_at,
          participants:direct_message_participants!inner (
            user_id,
            user:users!inner (
              id,
              email,
              profile:user_profiles!inner (
                name,
                avatar_url,
                status
              )
            )
          )
        `)
        .order('created_at', { ascending: false })

      if (channelsError) throw channelsError

      // Transform the data
      const transformedChannels: DirectMessageChannel[] = (channelsData || []).map(channel => ({
        id: channel.id,
        participants: channel.participants.map(p => {
          const userData = p.user as unknown as { 
            id: string; 
            email: string; 
            profile: { 
              name: string | null; 
              avatar_url: string | null; 
              status: string | null; 
            }
          }
          return {
            user_id: p.user_id,
            user: {
              id: userData.id,
              email: userData.email,
              name: userData.profile?.name || null,
              avatar_url: userData.profile?.avatar_url || null,
              status: userData.profile?.status || null,
              user_profiles: [userData.profile]
            }
          }
        })
      }))

      setChannels(transformedChannels)
    } catch (error) {
      console.error('Error fetching DM channels:', error)
    }
  }

  const createChannel = async (otherUserId: string) => {
    if (!user) return null

    try {
      // First get all channels where the other user is a participant
      const { data: otherUserChannels, error: otherUserError } = await supabase
        .from('direct_message_participants')
        .select('channel_id')
        .eq('user_id', otherUserId)

      if (otherUserError) throw otherUserError

      // Then check if current user is also a participant in any of those channels
      if (otherUserChannels && otherUserChannels.length > 0) {
        const channelIds = otherUserChannels.map(c => c.channel_id)
        const { data: existingChannels, error: existingError } = await supabase
          .from('direct_message_participants')
          .select('channel_id')
          .eq('user_id', user.id)
          .in('channel_id', channelIds)

        if (existingError) throw existingError

        if (existingChannels && existingChannels.length > 0) {
          return existingChannels[0].channel_id
        }
      }

      // Create a new channel if no existing one found
      const { data: newChannel, error: createError } = await supabase
        .from('direct_message_channels')
        .insert({})
        .select()
        .single()

      if (createError) throw createError

      // Add both participants
      const { error: participantsError } = await supabase
        .from('direct_message_participants')
        .insert([
          { channel_id: newChannel.id, user_id: user.id },
          { channel_id: newChannel.id, user_id: otherUserId }
        ])

      if (participantsError) throw participantsError

      await fetchChannels()
      return newChannel.id
    } catch (error) {
      console.error('Error creating DM channel:', error)
      return null
    }
  }

  return {
    channels,
    createChannel
  }
} 