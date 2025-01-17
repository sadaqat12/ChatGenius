'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import type { Database } from '@/types/supabase'

type DbResult<T> = T extends PromiseLike<infer U> ? U : never
type DbResultOk<T> = DbResult<T> extends { data: infer U } ? U : never

interface UseDirectMessagesProps {
  teamId?: string
}

interface UserProfile {
  name: string | null | undefined
  avatar_url: string | null | undefined
  status: string | null | undefined
  team_id?: string
}

interface User {
  id: string
  email: string
  name?: string
  avatar_url?: string | null
  status?: string
  user_profiles: UserProfile[]
}

interface ChannelParticipant {
  user_id: string
  user: {
    id: string
    email: string
    user_profiles: UserProfile[]
  }
}

interface RawChannel {
  id: string
  participants: ChannelParticipant[]
}

interface DirectMessageParticipant {
  user_id: string
  user: User
}

interface DirectMessageChannel {
  id: string
  participants: DirectMessageParticipant[]
}

interface RawChannelData {
  id: string;
  participants: {
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
  }[];
}

export function useDirectMessages(props?: UseDirectMessagesProps) {
  const [channels, setChannels] = useState<DirectMessageChannel[]>([])
  const { user } = useAuth()
  const teamId = props?.teamId

  useEffect(() => {
    if (user && teamId) {
      fetchChannels()

      // Subscribe to changes in direct_message_participants
      const channel = supabase
        .channel('direct-messages')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'direct_message_participants',
            filter: `user_id=eq.${user.id}`
          },
          () => {
            fetchChannels()
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [user, teamId])

  const createChannel = async (otherUserId: string) => {
    if (!user) return null

    try {
      // First check if a DM channel already exists with this user
      const { data: existingParticipants, error: existingError } = await supabase
        .from('direct_message_participants')
        .select('channel_id')
        .eq('user_id', user.id)

      if (existingError) throw existingError

      if (existingParticipants && existingParticipants.length > 0) {
        // For each channel the current user is in, check if the other user is also in it
        for (const participant of existingParticipants) {
          const { data: otherParticipant, error: otherError } = await supabase
            .from('direct_message_participants')
            .select('channel_id')
            .eq('channel_id', participant.channel_id)
            .eq('user_id', otherUserId)
            .single()

          if (!otherError && otherParticipant) {
            // Found an existing channel with both users
            return otherParticipant.channel_id
          }
        }
      }

      // If no existing channel found, create a new one
      const { data: newChannel, error: createError } = await supabase
        .from('direct_message_channels')
        .insert({})
        .select()
        .single()

      if (createError) throw createError

      // First add ourselves to the channel
      const { error: selfParticipantError } = await supabase
        .from('direct_message_participants')
        .insert({ channel_id: newChannel.id, user_id: user.id })

      if (selfParticipantError) throw selfParticipantError

      // Then add the other user
      const { error: otherParticipantError } = await supabase
        .from('direct_message_participants')
        .insert({ channel_id: newChannel.id, user_id: otherUserId })

      if (otherParticipantError) throw otherParticipantError

      await fetchChannels()
      return newChannel.id
    } catch (err) {
      console.error('Error creating DM channel:', err)
      return null
    }
  }

  const fetchChannels = async () => {
    if (!user || !teamId) {
      return
    }

    try {
      // First get the channel IDs where the current user is a participant
      const { data: userChannelIds, error: channelError } = await supabase
        .from('direct_message_participants')
        .select('channel_id')
        .eq('user_id', user.id)

      if (channelError) {
        throw channelError
      }
      
      if (!userChannelIds || userChannelIds.length === 0) {
        setChannels([])
        return
      }

      // Then get the full channel data for those channels
      const { data: rawChannels, error } = await supabase
        .from('direct_message_channels')
        .select(`
          id,
          participants:direct_message_participants!inner (
            user_id,
            user:users!inner (
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
        .in('id', userChannelIds.map(c => c.channel_id))

      if (error) {
        throw error
      }

      if (!rawChannels || rawChannels.length === 0) {
        setChannels([])
        return
      }

      // Transform the raw channels data
      const formattedChannels = rawChannels.map(channel => ({
        id: channel.id,
        participants: channel.participants.map(p => ({
          user_id: p.user_id,
          user: {
            id: p.user.id,
            email: p.user.email,
            user_profiles: p.user.user_profiles
          }
        }))
      }))

      setChannels(formattedChannels)
    } catch (err) {
      console.error('Error fetching DM channels:', err)
      setChannels([])
    }
  }

  return {
    channels,
    createChannel
  }
} 