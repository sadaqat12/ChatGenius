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
  thread_count: number
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
  const { user, profile } = useAuth()

  // Move fetchAndUpdateMessage to main scope
  const fetchAndUpdateMessage = async (messageId: string) => {
    const table = messageType === 'direct' ? 'direct_messages' : 'messages'
    const userField = messageType === 'direct' ? 'sender:users' : 'user:users'
    const reactionsTable = messageType === 'direct' ? 'direct_message_reactions' : 'reactions'

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
        `, { count: 'exact' })
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

      // Fetch thread counts separately for each message
      const threadCounts = await Promise.all(
        data.map(async (message) => {
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('parent_id', message.id)
          
          return count || 0
        })
      )

      const formattedMessages = data.map((message, index) => ({
        ...formatMessage(message, messageType),
        thread_count: threadCounts[index]
      }))
      
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
        reactions: [],
        thread_count: 0
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
      reactions: formatReactions(message.reactions),
      thread_count: message.thread_count?.[0]?.count || 0
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
            // Fetch the complete message data with user and reactions
            await fetchAndUpdateMessage(payload.new.id)
          } else if (payload.eventType === 'UPDATE') {
            await fetchAndUpdateMessage(payload.new.id)
          } else if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(msg => msg.id !== payload.old.id))
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
    try {
      let fileData = null
      if (file) {
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('files')
          .upload(`messages/${Date.now()}-${file.name}`, file)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('files')
          .getPublicUrl(uploadData.path)

        fileData = {
          name: file.name,
          type: file.type,
          size: file.size,
          url: publicUrl,
          path: uploadData.path
        }
      }

      const table = messageType === 'direct' ? 'direct_messages' : 'messages'
      const userIdField = messageType === 'direct' ? 'sender_id' : 'user_id'
      const messageData = {
        content,
        channel_id: channelId,
        file: fileData,
        [userIdField]: user?.id,
        topic: 'chat',
        extension: 'text',
        ...(messageType !== 'direct' ? { parent_id: parentId || null } : {})
      }

      // Optimistically add the message to the UI
      const optimisticMessage: Message = {
        id: Date.now().toString(), // Temporary ID
        content,
        channel_id: channelId,
        parent_id: messageType === 'direct' ? null : (parentId || null),
        file: fileData,
        created_at: new Date().toISOString(),
        user: {
          id: user?.id || '',
          email: user?.email || '',
          name: profile?.name || user?.email?.split('@')[0] || 'Unknown',
          avatar_url: profile?.avatar_url,
          status: profile?.status || 'online'
        },
        reactions: [] as Reaction[],
        thread_count: 0
      }
      setMessages(prev => [...prev, optimisticMessage])

      const { error } = await supabase
        .from(table)
        .insert(messageData)

      if (error) throw error

    } catch (err) {
      console.error('Error sending message:', err)
      // Remove the optimistic message if there was an error
      setMessages(prev => prev.filter(msg => msg.id !== Date.now().toString()))
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

      // Optimistically update the UI
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          const existingReactionIndex = msg.reactions.findIndex(r => r.emoji === emoji)
          if (existingReactionIndex >= 0) {
            // Update existing reaction
            const updatedReactions = [...msg.reactions]
            updatedReactions[existingReactionIndex] = {
              ...updatedReactions[existingReactionIndex],
              users: [...updatedReactions[existingReactionIndex].users, {
                id: user.id,
                email: user.email || '',
                name: profile?.name || user.email?.split('@')[0] || 'Unknown',
                avatar_url: profile?.avatar_url,
                status: profile?.status || 'online'
              }],
              count: updatedReactions[existingReactionIndex].count + 1
            }
            return { ...msg, reactions: updatedReactions }
          } else {
            // Add new reaction
            return {
              ...msg,
              reactions: [...msg.reactions, {
                id: `temp-${Date.now()}`,
                emoji,
                users: [{
                  id: user.id,
                  email: user.email || '',
                  name: profile?.name || user.email?.split('@')[0] || 'Unknown',
                  avatar_url: profile?.avatar_url,
                  status: profile?.status || 'online'
                }],
                count: 1
              }]
            }
          }
        }
        return msg
      }))

      // Add the new reaction to the database
      const { error } = await supabase
        .from(table)
        .insert({
          message_id: messageId,
          user_id: user.id,
          emoji,
          message_type: messageType || 'channel',
          created_by: user.id
        })

      if (error) {
        // Revert optimistic update on error
        await fetchAndUpdateMessage(messageId)
        throw error
      }
    } catch (err) {
      console.error('Error adding reaction:', err)
      throw err
    }
  }

  const removeReaction = async (messageId: string, emoji: string) => {
    if (!user) throw new Error('Not authenticated')
    
    const table = messageType === 'direct' ? 'direct_message_reactions' : 'reactions'
    try {
      // Optimistically update the UI
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          return {
            ...msg,
            reactions: msg.reactions.map(reaction => {
              if (reaction.emoji === emoji) {
                const filteredUsers = reaction.users.filter(u => u.id !== user.id)
                return {
                  ...reaction,
                  users: filteredUsers,
                  count: reaction.count - 1
                }
              }
              return reaction
            }).filter(reaction => reaction.count > 0) // Remove reactions with no users
          }
        }
        return msg
      }))

      const { error } = await supabase
        .from(table)
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji)

      if (error) {
        // Revert optimistic update on error
        await fetchAndUpdateMessage(messageId)
        throw error
      }
    } catch (err) {
      throw err
    }
  }

  const formatReactions = (reactions: any[] | null): Reaction[] => {
    if (!reactions) return []

    const reactionsByEmoji = reactions.reduce((acc, r) => {
      if (!r.user?.user_profiles) return acc

      const user = {
        id: r.user.id,
        email: r.user.email,
        name: r.user.user_profiles.name || r.user.email.split('@')[0],
        avatar_url: r.user.user_profiles.avatar_url,
        status: r.user.user_profiles.status || 'offline'
      }

      const emoji = r.emoji
      if (!acc[emoji]) {
        acc[emoji] = {
          id: r.id,
          emoji: emoji,
          users: [user],
          count: 1
        }
      } else {
        acc[emoji].users.push(user)
        acc[emoji].count++
      }
      return acc
    }, {} as Record<string, Reaction>)

    return Object.values(reactionsByEmoji) as Reaction[]
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