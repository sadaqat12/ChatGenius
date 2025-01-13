'use client'

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import debounce from 'lodash/debounce'

interface SearchResult {
  type: 'message' | 'channel' | 'user'
  id: string
  title: string
  subtitle?: string
  channel_id?: string
  channel_name?: string
  user_id?: string
  email?: string
}

interface UseSearchProps {
  teamId: string
}

interface MessageWithRelations {
  id: string
  content: string
  channel_id: string
  channels: {
    id: string
    name: string
    team_id: string
  }
  users: {
    id: string
    email: string
    user_profiles: Array<{
      name: string
    }>
  } | null
}

interface TeamMemberWithUser {
  user_id: string
  users: {
    id: string
    email: string
    name: string | null
  }
}

interface SupabaseTeamMemberResponse {
  user_id: string
  users: {
    id: string
    email: string
    user_profiles: Array<{
      name: string | null
    }>
  }
}

interface MessageResult extends SearchResult {
  type: 'message'
  channel_id: string
  channel_name: string
}

interface UserResult extends SearchResult {
  type: 'user'
  user_id: string
  email: string
}

interface ChannelResult extends SearchResult {
  type: 'channel'
}

export function useSearch({ teamId }: UseSearchProps) {
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setResults([])
      setIsSearching(false)
      return
    }

    try {
      console.log('Starting search with query:', query, 'teamId:', teamId)

      // Search users in the team by email
      const { data: users, error: usersError } = await supabase
        .from('team_members')
        .select(`
          user_id,
          users!team_members_user_id_fkey (
            id,
            email,
            user_profiles (
              name
            )
          )
        `)
        .eq('team_id', teamId)
        .filter('users.email', 'ilike', `%${query}%`)
        .limit(5)
        .returns<SupabaseTeamMemberResponse[]>()

      if (usersError) {
        console.error('Error searching users:', usersError)
        throw usersError
      }

      console.log('Users search results:', users)

      // Search messages within team's channels
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          channel_id,
          channels!messages_channel_id_fkey!inner (
            id,
            name,
            team_id
          ),
          users!messages_user_id_fkey (
            id,
            email,
            user_profiles (
              name
            )
          )
        `)
        .eq('channels.team_id', teamId)
        .ilike('content', `%${query}%`)
        .limit(5)
        .returns<MessageWithRelations[]>()

      if (messagesError) {
        console.error('Error searching messages:', messagesError)
        throw messagesError
      }

      console.log('Messages search results:', messages)

      // Search channels within the team
      const { data: channels, error: channelsError } = await supabase
        .from('channels')
        .select('id, name, description')
        .eq('team_id', teamId)
        .ilike('name', `%${query}%`)
        .limit(5)

      if (channelsError) {
        console.error('Error searching channels:', channelsError)
        throw channelsError
      }

      console.log('Channel search results:', channels)

      // Combine and format results
      const userResults = (users || [])
        .map(user => {
          if (!user.users) {
            return null
          }
          const result: UserResult = {
            type: 'user',
            id: user.user_id,
            title: user.users.user_profiles?.[0]?.name || user.users.email,
            subtitle: user.users.user_profiles?.[0]?.name ? user.users.email : undefined,
            user_id: user.user_id,
            email: user.users.email
          }
          return result
        })
        .filter((user): user is UserResult => user !== null)

      const messageResults = (messages || [])
        .map(msg => {
          console.log('Processing message with full data:', JSON.stringify(msg, null, 2))
          if (!msg.channels || !msg.users) {
            console.log('Message has no channel or user data:', msg.id)
            return null
          }
          const userName = msg.users.user_profiles?.[0]?.name || msg.users.email || 'Unknown user'
          const result: MessageResult = {
            type: 'message',
            id: msg.id,
            title: msg.content,
            subtitle: `in #${msg.channels.name} by ${userName}`,
            channel_id: msg.channel_id,
            channel_name: msg.channels.name
          }
          return result
        })
        .filter((msg): msg is MessageResult => msg !== null)

      const channelResults = (channels || []).map(channel => {
        const result: ChannelResult = {
          type: 'channel',
          id: channel.id,
          title: channel.name,
          subtitle: channel.description
        }
        return result
      })

      const finalResults: SearchResult[] = [...userResults, ...channelResults, ...messageResults]
      console.log('Final search results:', finalResults)
      setResults(finalResults)
    } catch (error) {
      console.error('Error searching:', error)
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }

  // Debounce the search to avoid too many requests
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      performSearch(query)
    }, 300),
    [teamId]
  )

  const search = (query: string) => {
    setIsSearching(true)
    if (!query.trim()) {
      setResults([])
      setIsSearching(false)
      return
    }
    debouncedSearch(query)
  }

  return {
    search,
    results,
    isSearching
  }
} 