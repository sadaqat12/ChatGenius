'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Message } from '@/types/chat'
import { useAuth } from '@/contexts/auth-context'
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

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
    // Initial fetch of messages
    fetchMessages()

    // Subscribe to new messages and reactions
    const channel = supabase
      .channel(`channel:${channelId}:${parentId || 'main'}`)
      .on<{ [key: string]: any }>(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: parentId 
            ? `channel_id=eq.${channelId} and (id=eq.${parentId} or parent_id=eq.${parentId})`
            : `channel_id=eq.${channelId} and parent_id=is.null`
        },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
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
              .eq('id', payload.new.id)
              .single()

            if (messageError) {
              console.error('Error fetching message:', messageError)
              return
            }

            if (!messageData) return

            const transformedMessage: Message = {
              id: messageData.id,
              content: messageData.content,
              channel_id: messageData.channel_id,
              user_id: messageData.user_id,
              parent_id: messageData.parent_id,
              file: messageData.file,
              created_at: messageData.created_at,
              updated_at: messageData.updated_at,
              user: {
                id: messageData.sender.id,
                name: messageData.sender.name || messageData.sender.email,
                avatar: messageData.sender.avatar_url
              },
              reactions: messageData.reactions?.map((r: { id: string; emoji: string; user_id: string }) => ({
                id: r.id,
                emoji: r.emoji,
                user_id: r.user_id
              })) || [],
              reply_count: messageData.replies?.length || 0
            }

            if (payload.eventType === 'INSERT') {
              // If this is a reply, update the parent message's reply count
              if (transformedMessage.parent_id && !parentId) {
                const { data: parentMessage } = await supabase
                  .from('messages')
                  .select('*, replies:messages!parent_id(id)')
                  .eq('id', transformedMessage.parent_id)
                  .single()

                if (parentMessage) {
                  setMessages(prev => prev.map(msg => 
                    msg.id === transformedMessage.parent_id 
                      ? { ...msg, reply_count: parentMessage.replies.length }
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
            const deletedMessage = payload.old as Message
            setMessages(prev => prev.filter(msg => msg.id !== deletedMessage.id))
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
        async (payload: { 
          new: { message_id: string } | null;
          old: { message_id: string } | null;
        }) => {
          // When reactions change, refetch the affected message
          const messageId = payload.new?.message_id || payload.old?.message_id
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
            channel_id: messageData.channel_id,
            user_id: messageData.user_id,
            parent_id: messageData.parent_id,
            file: messageData.file,
            created_at: messageData.created_at,
            updated_at: messageData.updated_at,
            user: {
              id: messageData.sender.id,
              name: messageData.sender.name || messageData.sender.email,
              avatar: messageData.sender.avatar_url
            },
            reactions: messageData.reactions?.map((r: { id: string; emoji: string; user_id: string }) => ({
              id: r.id,
              emoji: r.emoji,
              user_id: r.user_id
            })) || []
          }

          setMessages(prev => prev.map(msg => 
            msg.id === messageId ? transformedMessage : msg
          ))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [channelId, parentId])

  const fetchMessages = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const query = supabase
        .from('messages')
        .select(`
          *,
          sender:users!user_id(
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
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })

      if (parentId) {
        // In thread view, get both the parent message and its replies
        query.or(`id.eq.${parentId},parent_id.eq.${parentId}`)
      } else {
        // In main view, only get messages without a parent
        query.is('parent_id', null)
      }

      const { data, error: fetchError } = await query

      if (fetchError) throw fetchError

      // Transform the data to match our Message type
      const transformedMessages = data.map(msg => ({
        id: msg.id,
        content: msg.content,
        channel_id: msg.channel_id,
        user_id: msg.user_id,
        parent_id: msg.parent_id,
        file: msg.file,
        created_at: msg.created_at,
        updated_at: msg.updated_at,
        user: {
          id: msg.sender.id,
          name: msg.sender.name || msg.sender.email,
          avatar: msg.sender.avatar_url
        },
        reactions: msg.reactions?.map((r: { id: string; emoji: string; user_id: string }) => ({
          id: r.id,
          emoji: r.emoji,
          user_id: r.user_id
        })) || [],
        reply_count: msg.replies?.length || 0
      }))

      // Sort messages so parent appears first in thread view
      if (parentId) {
        transformedMessages.sort((a, b) => {
          if (a.id === parentId) return -1
          if (b.id === parentId) return 1
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        })
      }

      setMessages(transformedMessages)
    } catch (err) {
      console.error('Error fetching messages:', err)
      setError(err instanceof Error ? err : new Error('Failed to fetch messages'))
    } finally {
      setIsLoading(false)
    }
  }

  const sendMessage = async (content: string, file?: File) => {
    if (!user) return

    try {
      let fileData = null

      if (file) {
        // Upload file to Supabase storage
        const fileExt = file.name.split('.').pop()
        const userId = user.id
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `${userId}/${fileName}` // Include user ID in path for better organization

        const { data: uploadData, error: uploadError } = await supabase
          .storage
          .from('message-attachments')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          })

        if (uploadError) throw uploadError

        // Get signed URL with longer expiration
        const { data: signedData } = await supabase
          .storage
          .from('message-attachments')
          .createSignedUrl(filePath, 365 * 24 * 60 * 60) // 1 year expiration

        if (!signedData) throw new Error('Failed to generate signed URL')

        fileData = {
          name: file.name,
          type: file.type,
          size: file.size,
          url: signedData.signedUrl,
          path: filePath // Store the path for future URL regeneration
        }
      }

      const { error } = await supabase
        .from('messages')
        .insert({
          content,
          channel_id: channelId,
          user_id: user.id,
          parent_id: parentId,
          file: fileData
        })

      if (error) throw error
    } catch (error) {
      console.error('Error sending message:', error)
      throw error
    }
  }

  const addReaction = async (messageId: string, emoji: string) => {
    if (!user) return

    try {
      // First check if the reaction already exists
      const { data: existingReactions, error: checkError } = await supabase
        .from('message_reactions')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji)

      if (checkError) {
        throw checkError
      }

      if (existingReactions && existingReactions.length > 0) {
        // If reaction exists, remove it
        const { error } = await supabase
          .from('message_reactions')
          .delete()
          .eq('id', existingReactions[0].id)

        if (error) throw error

        // Update local state immediately
        setMessages(prev => prev.map(msg => {
          if (msg.id === messageId) {
            return {
              ...msg,
              reactions: (msg.reactions || []).filter(r => 
                !(r.emoji === emoji && r.user_id === user.id)
              )
            }
          }
          return msg
        }))
      } else {
        // Add the new reaction
        const { data: newReaction, error } = await supabase
          .from('message_reactions')
          .insert({
            message_id: messageId,
            user_id: user.id,
            emoji
          })
          .select('id')
          .single()

        if (error) throw error

        // Update local state immediately
        setMessages(prev => prev.map(msg => {
          if (msg.id === messageId) {
            return {
              ...msg,
              reactions: [...(msg.reactions || []), {
                id: newReaction.id,
                emoji,
                user_id: user.id
              }]
            }
          }
          return msg
        }))
      }
    } catch (error) {
      console.error('Error toggling reaction:', error)
    }
  }

  const removeReaction = async (messageId: string, emoji: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('message_reactions')
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
    messages,
    isLoading,
    error,
    sendMessage,
    addReaction,
    removeReaction
  }
} 