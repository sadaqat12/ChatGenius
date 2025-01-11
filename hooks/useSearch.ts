'use client'

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Message, Channel } from '@/types/chat'
import debounce from 'lodash/debounce'

interface SearchResult {
  type: 'message' | 'channel'
  id: string
  title: string
  subtitle?: string
}

export function useSearch() {
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setResults([])
      setIsSearching(false)
      return
    }

    try {
      // Search messages
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          channel_id,
          sender:users!user_id (
            id,
            email,
            user_profiles (
              name
            )
          )
        `)
        .ilike('content', `%${query}%`)
        .limit(5)

      if (messagesError) throw messagesError

      // Search channels
      const { data: channels, error: channelsError } = await supabase
        .from('channels')
        .select('id, name, description')
        .ilike('name', `%${query}%`)
        .limit(5)

      if (channelsError) throw channelsError

      // Combine and format results
      const messageResults: SearchResult[] = (messages || []).map(msg => ({
        type: 'message',
        id: msg.id,
        title: msg.content,
        subtitle: `by ${msg.sender?.user_profiles?.[0]?.name || msg.sender?.email || 'Unknown user'}`
      }))

      const channelResults: SearchResult[] = (channels || []).map(channel => ({
        type: 'channel',
        id: channel.id,
        title: channel.name,
        subtitle: channel.description
      }))

      setResults([...channelResults, ...messageResults])
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
    []
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