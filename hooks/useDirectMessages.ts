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
      console.log('Missing user or teamId:', { userId: user?.id, teamId })
      return
    }

    try {
      console.log('Fetching DM channels for user:', user.id, 'team:', teamId)

      // First get the channel IDs where the current user is a participant
      const { data: userChannelIds, error: channelError } = await supabase
        .from('direct_message_participants')
        .select('channel_id')
        .eq('user_id', user.id)

      if (channelError) {
        console.error('Error fetching channel IDs:', channelError)
        throw channelError
      }
      
      if (!userChannelIds || userChannelIds.length === 0) {
        console.log('No DM channels found for user')
        setChannels([])
        return
      }

      console.log('Found DM channel IDs:', userChannelIds)

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
        console.error('Error fetching DM channel data:', error)
        throw error
      }

      if (!rawChannels || rawChannels.length === 0) {
        console.log('No DM channel data found')
        setChannels([])
        return
      }

      // Get user profiles in a separate query
      const userIds = rawChannels.flatMap(channel => 
        channel.participants.map(p => p.user_id)
      )

      const { data: teamMembers, error: profilesError } = await supabase
        .from('team_members')
        .select(`
          user_id,
          team_id,
          users:users!inner (
            id,
            email,
            user_profiles!inner (
              name,
              avatar_url,
              status
            )
          )
        `)
        .in('user_id', userIds)
        .eq('team_id', teamId)

      if (profilesError) {
        console.error('Error fetching team members:', profilesError)
        throw profilesError
      }

      type TeamMember = {
        user_id: string
        team_id: string
        users: {
          id: string
          email: string
          user_profiles: {
            name: string | null
            avatar_url: string | null
            status: string | null
          }[]
        }
      }

      const userProfilesMap = new Map(
        ((teamMembers as unknown as TeamMember[]) || []).map(member => {
          console.log('Creating profile map for user:', {
            userId: member.user_id,
            teamId: member.team_id,
            profileName: member.users.user_profiles[0]?.name,
            email: member.users.email
          })
          return [
            member.user_id,
            {
              name: member.users.user_profiles[0]?.name,
              avatar_url: member.users.user_profiles[0]?.avatar_url,
              status: member.users.user_profiles[0]?.status || 'offline',
              team_id: member.team_id,
              email: member.users.email
            }
          ]
        })
      )

      // Filter to only include channels where at least one other participant is in the current team
      const filteredChannels = ((rawChannels as unknown as RawChannel[]) || []).filter(channel => {
        // Get all participants except the current user
        const otherParticipants = channel.participants.filter(p => p.user_id !== user.id)
        
        // Check if any of them are in the current team
        const hasTeamMember = otherParticipants.some(p => {
          const userProfile = userProfilesMap.get(p.user_id)
          const isInTeam = userProfile?.team_id === teamId
          return isInTeam
        })
        return hasTeamMember
      })

      const formattedChannels = filteredChannels.map(channel => ({
        id: channel.id,
        participants: channel.participants.map(p => {
          const participant = p as unknown as {
            user_id: string
            user: {
              id: string
              email: string
              user_profiles: {
                name: string | null
                avatar_url: string | null
                status: string | null
              }[]
            }
          }
          const userProfile = userProfilesMap.get(participant.user_id)

          // Get name from user profile in team
          const name = userProfile?.name || participant.user.user_profiles[0]?.name || participant.user.email.split('@')[0]
          
          console.log('Resolving name for participant:', {
            userId: participant.user_id,
            teamProfileName: userProfile?.name,
            globalProfileName: participant.user.user_profiles[0]?.name,
            email: participant.user.email,
            resolvedName: name
          })

          const avatarUrl = userProfile?.avatar_url || undefined
          const status = userProfile?.status || 'offline'

          return {
            user_id: participant.user_id,
            user: {
              id: participant.user.id,
              email: participant.user.email,
              name,
              avatar_url: avatarUrl,
              status,
              user_profiles: [{
                name: userProfile?.name || undefined,
                avatar_url: userProfile?.avatar_url || undefined,
                status: userProfile?.status || 'offline',
                team_id: userProfile?.team_id
              }]
            }
          }
        })
      }))

      console.log('Final DM channels:', formattedChannels.map(channel => ({
        id: channel.id,
        participants: channel.participants.map(p => ({
          userId: p.user_id,
          name: p.user.name,
          email: p.user.email
        }))
      })))
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