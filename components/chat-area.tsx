'use client'

import { useState, useEffect, useRef } from 'react'
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Paperclip, X, Reply, ArrowLeft } from 'lucide-react'
import { ActiveChat } from "@/app/teams/[teamId]/page"
import { FileAttachment } from "@/components/file-attachment"
import { EmojiReactions } from "@/components/emoji-reactions"
import { useMessages } from "@/hooks/useMessages"
import { useDirectMessages } from "@/hooks/useDirectMessages"
import { Message } from "@/types/chat"
import { useAuth } from "@/contexts/auth-context"
import Image from 'next/image'
import { supabase } from "@/lib/supabase"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { AIChatArea } from "@/components/ai-chat-area"
import { cn } from "@/lib/utils"

interface DirectMessageParticipant {
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

interface ParticipantResponse {
  data: DirectMessageParticipant[];
  error: Error | null;
}

interface RawParticipantResponse {
  userId: string;
  user: {
    id: string;
    email: string;
    userProfiles: Array<{
      name: string;
    }>;
  };
}

interface ChatAreaProps {
  activeChat: {
    id: string;
    name?: string;
    type: 'channel' | 'dm' | 'ai';
  }
}

interface FileAttachmentType {
  name: string
  type: string
  size: number
  url: string
  path?: string
}

interface AttachedFile {
  file: File
  preview: string
}

interface Reaction {
  id: string;
  emoji: string;
  users: {
    id: string;
    email: string;
    name: string;
    avatar_url?: string;
    status: string;
  }[];
  count: number;
}

interface EmojiReactionsProps {
  reactions: Reaction[];
  onReactionClick: (emoji: string) => Promise<void>;
  currentUserId?: string;
}

export function ChatArea({ activeChat }: ChatAreaProps) {
  // If it's an AI chat, render the AI chat component
  if (activeChat.type === 'ai') {
    return <AIChatArea />
  }

  const [newMessage, setNewMessage] = useState('')
  const [activeThread, setActiveThread] = useState<string | null>(null)
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { user } = useAuth()
  const [recipientName, setRecipientName] = useState<string>('Direct Message')
  const [recipientEmail, setRecipientEmail] = useState<string>('')

  const {
    messages,
    isLoading,
    error,
    sendMessage,
    addReaction,
    removeReaction
  } = useMessages({
    channelId: activeChat.id,
    parentId: activeThread || undefined,
    messageType: activeChat.type === 'dm' ? 'direct' : 'channel'
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
      if (activeChat.type === 'dm') {
        const { data: participants, error } = await supabase
          .from('direct_message_participants')
          .select(`
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
          `)
          .eq('channel_id', activeChat.id)

        if (!error && participants) {
          const otherParticipant = participants.find(
            p => p.user_id !== user?.id
          )
          
          if (otherParticipant) {
            const userData = otherParticipant.user as unknown as { 
              id: string; 
              email: string; 
              user_profiles: { 
                name: string | null; 
                avatar_url: string | null; 
                status: string | null; 
              }[] 
            }
            const profileName = userData.user_profiles[0]?.name
            setRecipientName(profileName || userData.email)
            setRecipientEmail(userData.email)
          }
        }
      }
    }

    fetchRecipientName()
  }, [activeChat.id, activeChat.type, user?.id])

  const filteredMessages = activeThread
    ? messages.filter(message => 
        message.id === activeThread || // Show the parent message
        message.parent_id === activeThread // Show direct replies to this message
      )
    : messages.filter(message => !message.parent_id) // Only show parent messages in main view

  const handleSendMessage = async () => {
    if (newMessage.trim() === '' && !attachedFile) return

    try {
      await sendMessage(newMessage, attachedFile?.file)
      setNewMessage('')
      setAttachedFile(null)
      scrollToBottom()
    } catch (err) {
      console.error('Failed to send message:', err)
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
    const message = messages.find(m => m.id === messageId)
    if (!message || !user) return

    try {
      const userReacted = message.reactions?.some(r => 
        r.emoji === emoji && r.users.some(u => u.id === user.id)
      )

      if (userReacted) {
        await removeReaction(messageId, emoji)
      } else {
        await addReaction(messageId, emoji)
      }
    } catch (error) {
      console.error('Error handling reaction:', error)
    }
  }

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

  return (
    <div className="flex-1 flex flex-col max-h-full overflow-hidden">
      <div className="border-b px-6 py-3 flex items-center flex-shrink-0">
        <h1 className="text-xl font-semibold">
          {activeChat.type === 'dm' ? recipientName : activeChat.name}
        </h1>
        {activeThread && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-4"
            onClick={() => setActiveThread(null)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to channel
          </Button>
        )}
      </div>

      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4 min-h-0">
        <div className="space-y-4">
          {filteredMessages.map(message => (
            <div key={message.id} className="flex items-start gap-3">
              <Avatar>
                <AvatarImage src={message.user?.avatar_url || undefined} />
                <AvatarFallback>{message.user?.name?.[0] || '?'}</AvatarFallback>
                <div 
                  className={cn(
                    "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background",
                    message.user?.status === 'online' && "bg-green-500",
                    message.user?.status === 'away' && "bg-yellow-500",
                    message.user?.status === 'busy' && "bg-red-500",
                    message.user?.status === 'offline' && "bg-gray-500"
                  )}
                />
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{message.user?.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(message.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1">{message.content}</p>
                {message.file && (
                  <FileAttachment
                    file={{
                      name: message.file.name,
                      type: message.file.type,
                      url: message.file.url,
                      size: message.file.size || 0,
                    }}
                  />
                )}
                <div className="flex items-center gap-2 mt-2">
                  <EmojiReactions
                    messageId={message.id}
                    reactions={message.reactions}
                    onReactionClick={(emoji: string) => handleReaction(message.id, emoji)}
                    currentUserId={user?.id}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => setActiveThread(message.id)}
                  >
                    <Reply className="h-4 w-4 mr-1" />
                    {message.thread_count || 0} {message.thread_count === 1 ? 'reply' : 'replies'}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-4 border-t flex-shrink-0">
        {attachedFile && (
          <div className="mb-4 p-2 bg-muted rounded-lg flex items-center gap-2">
            <span className="text-sm">{attachedFile.file.name}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={removeAttachedFile}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Input
            ref={inputRef}
            placeholder="Type a message"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
          />
          <Button onClick={handleSendMessage}>Send</Button>
        </div>
      </div>
    </div>
  )
}

