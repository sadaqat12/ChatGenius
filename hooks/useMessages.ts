'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Message, User } from '@/types/chat'
import { useAuth } from '@/contexts/auth-context'

interface UseMessagesOptions {
  channelId: string
  parentId?: string
}

interface MessageRow {
  id: string
  content: string
  channel_id: string
  user_id: string
  parent_id: string | null
  file: {
    name: string
    type: string
    size: number
    url: string
    path?: string
  } | null
  created_at: string
  updated_at: string
  user: {
    id: string
    email: string
    user_profiles: {
      name: string
      avatar_url: string | null
      status: 'online' | 'away' | 'busy' | 'offline'
    }[]
  }
  reactions: ReactionRow[] | null
}

interface ReactionRow {
  id: string
  message_id: string
  user_id: string
  emoji: string
  user: {
    id: string
    email: string
    user_profiles: {
      name: string
      avatar_url: string | null
      status: 'online' | 'away' | 'busy' | 'offline'
    }[]
  }
}

interface Reaction {
  id: string
  emoji: string
  users: User[]
  count: number
}

export function useMessages({ channelId, parentId }: UseMessagesOptions) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const { user } = useAuth()

  useEffect(() => {
    fetchMessages()
    subscribeToMessages()
    subscribeToReactions()
  }, [channelId, parentId])

  const fetchMessages = async () => {
    try {
      const query = supabase
        .from('messages')
        .select(`
          *,
          user:users (
            id,
            email,
            user_profiles (
              name,
              avatar_url,
              status
            )
          ),
          reactions:message_reactions (
            id,
            emoji,
            user:users (
              id,
              email,
              user_profiles (
                name,
                avatar_url,
                status
              )
            )
          )
        `)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })

      if (parentId) {
        query.eq('parent_id', parentId)
      } else {
        query.is('parent_id', null)
      }

      const { data: messageRows, error } = await query

      if (error) throw error

      // Get thread counts for all messages
      const threadCounts = await Promise.all(
        messageRows.map(async (message) => {
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('parent_id', message.id)
          return { id: message.id, count: count || 0 }
        })
      )

      const threadCountMap = new Map(
        threadCounts.map(({ id, count }) => [id, count])
      )

      const formattedMessages = await Promise.all(
        (messageRows as MessageRow[]).map(row => 
          formatMessage(row, threadCountMap.get(row.id) || 0)
        )
      )
      setMessages(formattedMessages)
    } catch (err) {
      console.error('Error fetching messages:', err)
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatMessage = async (row: MessageRow, threadCount: number): Promise<Message> => {
    let userProfile = row.user?.user_profiles?.[0]
    
    if (!userProfile) {
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', row.user_id)
        .single()
      
      if (data) {
        userProfile = data
      }
    }

    const reactions = row.reactions?.reduce((acc: Reaction[], r: ReactionRow) => {
      if (!r.user?.user_profiles?.[0]) {
        return acc
      }

      const reactionUserProfile = r.user.user_profiles[0]
      const user: User = {
        id: r.user.id,
        name: reactionUserProfile.name,
        email: r.user.email,
        avatar_url: reactionUserProfile.avatar_url || undefined,
        status: reactionUserProfile.status
      }

      const existing = acc.find((a: Reaction) => a.emoji === r.emoji)
      if (existing) {
        existing.users.push(user)
        existing.count++
      } else {
        acc.push({
          id: r.id,
          emoji: r.emoji,
          users: [user],
          count: 1
        })
      }
      return acc
    }, [] as Reaction[]) || []

    if (!userProfile) {
      console.warn('Missing user profile for message:', row.id)
      return {
        id: row.id,
        content: row.content,
        channel_id: row.channel_id,
        parent_id: row.parent_id || undefined,
        created_at: row.created_at,
        updated_at: row.updated_at,
        file: row.file || undefined,
        user: {
          id: row.user_id,
          name: 'Unknown User',
          email: row.user?.email || '',
          avatar_url: undefined,
          status: 'offline'
        },
        thread_count: threadCount,
        reactions: []
      }
    }

    return {
      id: row.id,
      content: row.content,
      channel_id: row.channel_id,
      parent_id: row.parent_id || undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
      file: row.file || undefined,
      user: {
        id: row.user_id,
        name: userProfile.name,
        email: row.user?.email || '',
        avatar_url: userProfile.avatar_url || undefined,
        status: userProfile.status
      },
      thread_count: threadCount,
      reactions
    }
  }

  const subscribeToMessages = () => {
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
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const { data: messageRow } = await supabase
              .from('messages')
              .select(`
                *,
                user:users (
                  id,
                  email,
                  user_profiles (
                    name,
                    avatar_url,
                    status
                  )
                )
              `)
              .eq('id', payload.new.id)
              .single()

            if (messageRow) {
              // For new messages, thread count starts at 0
              const newMessage = await formatMessage(messageRow as MessageRow, 0)
              setMessages(prev => [...prev, newMessage])
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const subscribeToReactions = () => {
    const channel = supabase
      .channel(`reactions:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
          filter: `message_id=in.(${messages.map(m => m.id).join(',')})`
        },
        async () => {
          // Refetch messages to get updated reactions
          fetchMessages()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const sendMessage = async (content: string, file?: File) => {
    if (!user) throw new Error('Not authenticated')

    try {
      let fileData
      if (file) {
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(`${channelId}/${file.name}`, file)

        if (uploadError) throw uploadError

        const { data } = await supabase.storage
          .from('attachments')
          .createSignedUrl(uploadData.path, 60 * 60) // 1 hour expiration

        if (!data) throw new Error('Failed to create signed URL')

        fileData = {
          name: file.name,
          type: file.type,
          size: file.size,
          url: data.signedUrl,
          path: uploadData.path
        }
      }

      const { error } = await supabase
        .from('messages')
        .insert({
          content,
          channel_id: channelId,
          parent_id: parentId || null,
          user_id: user.id,
          file: fileData
        })

      if (error) throw error
    } catch (err) {
      console.error('Error sending message:', err)
      throw err
    }
  }

  const addReaction = async (messageId: string, emoji: string) => {
    if (!user) throw new Error('Not authenticated')

    try {
      const { error } = await supabase
        .from('message_reactions')
        .insert({
          message_id: messageId,
          user_id: user.id,
          emoji
        })

      if (error) throw error
    } catch (err) {
      console.error('Error adding reaction:', err)
      throw err
    }
  }

  const removeReaction = async (messageId: string, emoji: string) => {
    if (!user) throw new Error('Not authenticated')

    try {
      const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji)

      if (error) throw error
    } catch (err) {
      console.error('Error removing reaction:', err)
      throw err
    }
  }

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    addReaction,
    removeReaction
  }
} 