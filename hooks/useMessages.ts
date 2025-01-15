'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'

interface UseMessagesOptions {
  channelId: string
  parentId?: string
  messageType?: 'channel' | 'direct'
}

interface Message {
  id: string
  content: string
  channel_id: string
  parent_id: string | null
  file: {
    name: string
    type: string
    size: number
    url: string
    path?: string
  } | null
  created_at: string
  user: User
  reactions: Reaction[]
}

interface User {
  id: string
  email: string
  name: string
  avatar_url?: string
  status: 'online' | 'away' | 'busy' | 'offline'
}

interface Reaction {
  id: string
  emoji: string
  users: User[]
  count: number
}

export function useMessages({ channelId, parentId, messageType }: UseMessagesOptions) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const { user } = useAuth()

  useEffect(() => {
    fetchMessages()
    const unsubMessages = subscribeToMessages()
    const unsubReactions = subscribeToReactions()
    return () => {
      unsubMessages()
      unsubReactions()
    }
  }, [channelId, parentId])

  const fetchMessages = async () => {
    try {
      const table = messageType === 'direct' ? 'direct_messages' : 'messages'
      const userField = messageType === 'direct' ? 'sender:users' : 'user:users'
      const reactionsTable = messageType === 'direct' ? 'direct_message_reactions' : 'reactions'

      let query = supabase
        .from(table)
        .select(`
          *,
          ${userField} (
            id,
            email,
            user_profiles (
              name,
              avatar_url,
              status
            )
          ),
          reactions:${reactionsTable}!message_id (
            id,
            emoji,
            user_id,
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

      // Only add parent_id filter for channel messages
      if (messageType !== 'direct') {
        if (parentId) {
          query = query.eq('parent_id', parentId)
        } else {
          query = query.is('parent_id', null)
        }
      }

      const { data, error } = await query.order('created_at', { ascending: true })

      if (error) throw error

      console.log('Raw message data:', data) // Debug log

      const formattedMessages = data.map(message => formatMessage(message, messageType))
      console.log('Formatted messages:', formattedMessages) // Debug log
      
      setMessages(formattedMessages)
      setIsLoading(false)
    } catch (err) {
      console.error('Error fetching messages:', err)
      setError(err as Error)
      setIsLoading(false)
    }
  }

  const formatMessage = (message: any, type: 'channel' | 'direct' = 'channel'): Message => {
    const userField = type === 'direct' ? 'sender' : 'user'
    const user = message[userField]
    
    if (!user) {
      console.error('No user data found for message:', message)
      return {
        id: message.id,
        content: message.content,
        channel_id: message.channel_id,
        parent_id: type === 'direct' ? null : message.parent_id,
        file: message.file,
        created_at: message.created_at,
        user: {
          id: 'unknown',
          email: 'unknown',
          name: 'Unknown User',
          status: 'offline'
        },
        reactions: []
      }
    }

    // Get profile data - it's an object, not an array
    const profile = user.user_profiles
    const name = profile?.name || user.email.split('@')[0]

    return {
      id: message.id,
      content: message.content,
      channel_id: message.channel_id,
      parent_id: type === 'direct' ? null : message.parent_id,
      file: message.file,
      created_at: message.created_at,
      user: {
        id: user.id,
        email: user.email,
        name: name,
        avatar_url: profile?.avatar_url,
        status: profile?.status || 'offline'
      },
      reactions: formatReactions(message.reactions)
    }
  }

  const subscribeToMessages = () => {
    const table = messageType === 'direct' ? 'direct_messages' : 'messages'
    const channel = supabase
      .channel(`messages:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `channel_id=eq.${channelId}`
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const { data: messageRow } = await supabase
              .from(table)
              .select(`
                *,
                ${messageType === 'direct' ? 'sender:users' : 'user:users'} (
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
              const newMessage = formatMessage(messageRow, messageType)
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
    const reactionsTable = messageType === 'direct' ? 'direct_message_reactions' : 'reactions'
    const table = messageType === 'direct' ? 'direct_messages' : 'messages'
    const userField = messageType === 'direct' ? 'sender:users' : 'user:users'

    const fetchAndUpdateMessage = async (messageId: string) => {
      const { data: messageData } = await supabase
        .from(table)
        .select(`
          *,
          ${userField} (
            id,
            email,
            user_profiles (
              name,
              avatar_url,
              status
            )
          ),
          reactions:${reactionsTable}!message_id (
            id,
            emoji,
            user_id,
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
        .eq('id', messageId)
        .single()

      if (messageData) {
        const updatedMessage = formatMessage(messageData, messageType)
        setMessages(prev => prev.map(msg => 
          msg.id === messageId ? updatedMessage : msg
        ))
      }
    }

    const channel = supabase
      .channel(`reactions:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: reactionsTable
        },
        async (payload: { 
          new: { message_id?: string } | null; 
        }) => {
          if (!payload.new?.message_id) return
          await fetchAndUpdateMessage(payload.new.message_id)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: reactionsTable
        },
        async (payload: { 
          old: { message_id?: string } | null;
        }) => {
          if (!payload.old?.message_id) return
          await fetchAndUpdateMessage(payload.old.message_id)
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

      const table = messageType === 'direct' ? 'direct_messages' : 'messages'
      const userIdField = messageType === 'direct' ? 'sender_id' : 'user_id'
      const messageData: any = {
        content,
        channel_id: channelId,
        [userIdField]: user.id,
        file: fileData
      }

      // Only add parent_id for channel messages
      if (messageType !== 'direct' && parentId) {
        messageData.parent_id = parentId
      }

      const { error } = await supabase
        .from(table)
        .insert(messageData)

      if (error) throw error
    } catch (err) {
      console.error('Error sending message:', err)
      throw err
    }
  }

  const addReaction = async (messageId: string, emoji: string) => {
    if (!user) throw new Error('Not authenticated')

    try {
      const table = messageType === 'direct' ? 'direct_message_reactions' : 'reactions'
      
      // First check if the reaction already exists
      const { data: existingReaction } = await supabase
        .from(table)
        .select()
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji)
        .maybeSingle()

      // If reaction exists, we'll remove it instead
      if (existingReaction) {
        return await removeReaction(messageId, emoji)
      }

      // Otherwise, add the new reaction
      const { error } = await supabase
        .from(table)
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
      const table = messageType === 'direct' ? 'direct_message_reactions' : 'reactions'
      console.log('Removing reaction from table:', table) // Debug log
      const { error } = await supabase
        .from(table)
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

  const formatReactions = (reactions: any[] | null): Reaction[] => {
    if (!reactions) return []

    console.log('Raw reactions:', reactions) // Debug log

    const formattedReactions: { [key: string]: Reaction } = {}

    reactions.forEach(r => {
      console.log('Processing reaction:', r) // Debug log
      
      // Get user profile data - handle both array and single object cases
      const userProfile = Array.isArray(r.user.user_profiles) 
        ? r.user.user_profiles[0] 
        : r.user.user_profiles

      if (!userProfile) {
        console.log('No user profile found for reaction:', r)
        return
      }

      const user: User = {
        id: r.user.id,
        name: userProfile.name || r.user.email,
        email: r.user.email,
        avatar_url: userProfile.avatar_url || undefined,
        status: userProfile.status || 'offline'
      }

      console.log('Formatted user:', user) // Debug log

      if (!formattedReactions[r.emoji]) {
        formattedReactions[r.emoji] = {
          id: r.id,
          emoji: r.emoji,
          users: [user],
          count: 1
        }
      } else {
        formattedReactions[r.emoji].users.push(user)
        formattedReactions[r.emoji].count++
      }
    })

    const result = Object.values(formattedReactions)
    console.log('Formatted reactions:', result) // Debug log
    return result
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