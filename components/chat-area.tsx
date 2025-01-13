'use client'

import { useState, useEffect, useRef } from 'react'
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Paperclip, X, Reply, ArrowLeft } from 'lucide-react'
import { ActiveChat } from "@/app/page"
import { FileAttachment } from "@/components/file-attachment"
import { EmojiReactions } from "@/components/emoji-reactions"
import { useMessages } from "@/hooks/useMessages"
import { Message } from "@/types/chat"
import { useAuth } from "@/contexts/auth-context"
import Image from 'next/image'
import { supabase } from "@/lib/supabase"

interface DirectMessageParticipant {
  user_id: string;
  user: {
    id: string;
    email: string;
    user_profiles: Array<{
      name: string;
    }>;
  };
}

interface ParticipantResponse {
  user_id: string;
  user: {
    id: string;
    email: string;
    user_profiles: Array<{
      name: string;
    }>;
  };
}

interface ChatAreaProps {
  activeChat: {
    id: string;
    name?: string;
    type: 'channel' | 'directMessage';
  }
}

interface AttachedFile {
  file: File
  preview: string
}

export function ChatArea({ activeChat }: ChatAreaProps) {
  const [newMessage, setNewMessage] = useState('')
  const [activeThread, setActiveThread] = useState<string | null>(null)
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { user } = useAuth()
  const [recipientName, setRecipientName] = useState<string>('Direct Message')

  const {
    messages,
    isLoading,
    error,
    sendMessage,
    addReaction,
    removeReaction
  } = useMessages({
    channelId: String(activeChat.id),
    parentId: activeThread || undefined
  })

  useEffect(() => {
    setActiveThread(null)
  }, [activeChat])

  useEffect(() => {
    return () => {
      if (attachedFile) {
        URL.revokeObjectURL(attachedFile.preview)
      }
    }
  }, [attachedFile])

  useEffect(() => {
    const fetchRecipientName = async () => {
      if (activeChat.type === 'directMessage') {
        const { data: participants, error } = await supabase
          .from('direct_message_participants')
          .select(`
            user_id,
            user:users!inner (
              id,
              email,
              user_profiles!inner (
                name
              )
            )
          `)
          .eq('channel_id', activeChat.id);

        if (!error && participants) {
          const otherParticipant = (participants as ParticipantResponse[]).find(
            p => p.user_id !== user?.id
          );
          if (otherParticipant?.user) {
            const name = otherParticipant.user.user_profiles[0]?.name || 
                        otherParticipant.user.email || 
                        'Unknown User';
            setRecipientName(name);
          }
        }
      }
    };

    fetchRecipientName();
  }, [activeChat.id, activeChat.type, user?.id]);

  // Filter messages based on whether we're in thread view or main view
  const filteredMessages = activeThread
    ? messages.filter(message => 
        message.id === activeThread || // Show the parent message
        message.parent_id === activeThread // Show direct replies to this message
      )
    : messages.filter(message => !message.parent_id) // Only show parent messages in main view

  const getReplyCount = (messageId: string) => {
    const message = messages.find(m => m.id === messageId)
    return message?.reply_count || 0
  }

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollAreaRef.current) {
        const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight
        }
      }
    }, 100)
  }

  const handleSendMessage = async () => {
    if (newMessage.trim() === '' && !attachedFile) return

    try {
      await sendMessage(newMessage, attachedFile?.file)
      setNewMessage('')
      setAttachedFile(null)
      scrollToBottom()
    } catch (err) {
      console.error('Failed to send message:', err)
      // TODO: Show error toast
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setAttachedFile({
        file,
        preview: URL.createObjectURL(file)
      })
    }
  }

  const removeAttachedFile = () => {
    if (attachedFile) {
      URL.revokeObjectURL(attachedFile.preview)
    }
    setAttachedFile(null)
  }

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!user) return

    try {
      const message = messages.find(m => m.id === messageId)
      if (!message) return

      const existingReaction = message.reactions?.find(r => r.emoji === emoji && r.user_id === user.id)
      if (existingReaction) {
        await removeReaction(messageId, emoji)
      } else {
        await addReaction(messageId, emoji)
      }
    } catch (err) {
      console.error('Failed to handle reaction:', err)
      // TODO: Show error toast
    }
  }

  const handleReply = (messageId: string) => {
    setActiveThread(messageId)
  }

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center">Loading messages...</div>
  }

  if (error) {
    return <div className="flex-1 flex items-center justify-center text-red-500">Error: {error.message}</div>
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="text-xl font-bold">
          {activeChat.type === 'channel' ? `#${activeChat.name}` : recipientName}
          {activeThread && ' > Thread'}
        </h2>
        {activeThread && (
          <Button variant="outline" onClick={() => setActiveThread(null)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Channel
          </Button>
        )}
      </div>
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        {filteredMessages.map((message) => (
          <div key={message.id} className="mb-4 group">
            <div className="flex items-start gap-x-3">
              <div className="flex-1">
                <div className="flex items-center">
                  <span className="font-bold">{message.user.name}</span>
                  <span className="ml-2 text-sm text-gray-500">
                    {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="mt-1">{message.content}</div>
                {message.file && (
                  <FileAttachment file={message.file} />
                )}
                <div className="mt-2 flex items-center gap-2">
                  <EmojiReactions 
                    reactions={(message.reactions || []).reduce((acc, r) => {
                      const existing = acc.find(a => a.emoji === r.emoji)
                      if (existing) {
                        existing.count++
                        existing.users.push(r.user_id)
                      } else {
                        acc.push({ emoji: r.emoji, count: 1, users: [r.user_id] })
                      }
                      return acc
                    }, [] as Array<{ emoji: string, count: number, users: string[] }>)} 
                    onReact={(emoji) => handleReaction(message.id, emoji)}
                    currentUser={user?.id || ''}
                  />
                  {!activeThread && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleReply(message.id)}
                      className="opacity-0 group-hover:opacity-100"
                    >
                      <Reply className="h-4 w-4 mr-1" />
                      Reply
                    </Button>
                  )}
                </div>
                {!activeThread && getReplyCount(message.id) > 0 && (
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="mt-1 p-0 h-auto text-blue-500" 
                    onClick={() => setActiveThread(message.id)}
                  >
                    View {getReplyCount(message.id)} {getReplyCount(message.id) === 1 ? 'reply' : 'replies'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </ScrollArea>
      <div className="p-4 border-t">
        {attachedFile && (
          <div className="mb-2 p-2 bg-gray-100 rounded-md flex items-center justify-between">
            {attachedFile.file.type.startsWith('image/') ? (
              <Image
                src={attachedFile.preview}
                alt="Attached image"
                width={50}
                height={50}
                className="rounded-md object-cover"
              />
            ) : (
              <div className="text-sm">{attachedFile.file.name}</div>
            )}
            <Button variant="ghost" size="sm" onClick={removeAttachedFile}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Input 
            ref={inputRef}
            className="flex-1" 
            placeholder={activeThread ? "Reply in thread..." : "Type a message..."} 
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
          />
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button type="button" onClick={handleSendMessage}>Send</Button>
        </div>
      </div>
    </div>
  )
}

