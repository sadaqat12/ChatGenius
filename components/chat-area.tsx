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
import { useDirectMessages } from "@/hooks/useDirectMessages"
import { Message } from "@/types/chat"
import { useAuth } from "@/contexts/auth-context"
import Image from 'next/image'
import { supabase } from "@/lib/supabase"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"

interface DirectMessageParticipant {
  user_id: string;
  user: {
    id: string;
    email: string;
    user_profiles: Array<{
      name: string | null;
    }>;
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
    type: 'channel' | 'directMessage';
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

export function ChatArea({ activeChat }: ChatAreaProps) {
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
    channelId: String(activeChat.id),
    parentId: activeThread || undefined,
    messageType: activeChat.type === 'directMessage' ? 'direct' : 'channel'
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
          .eq('channel_id', activeChat.id) as unknown as ParticipantResponse;

        if (!error && participants) {
          const otherParticipant = participants.find(
            p => p.user_id !== user?.id
          );
          
          if (otherParticipant?.user) {
            const profileName = otherParticipant.user.user_profiles[0]?.name;
            setRecipientName(profileName || otherParticipant.user.email);
            setRecipientEmail(otherParticipant.user.email);
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
    return message?.thread_count || 0
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

      const existingReaction = message.reactions?.find(r => 
        r.emoji === emoji && r.users.some(u => u.id === user.id)
      )
      if (existingReaction) {
        await removeReaction(messageId, emoji)
      } else {
        await addReaction(messageId, emoji)
      }
    } catch (err) {
      console.error('Error handling reaction:', err)
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
        <div>
          {activeChat.type === 'channel' ? (
            <h2 className="text-xl font-bold">#{activeChat.name}</h2>
          ) : (
            <div>
              <h2 className="text-xl font-bold">{recipientName}</h2>
              {activeChat.type === 'directMessage' && (
                <p className="text-sm text-gray-500">{recipientEmail}</p>
              )}
            </div>
          )}
          {activeThread && ' > Thread'}
        </div>
        {activeThread && (
          <Button variant="outline" onClick={() => setActiveThread(null)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Channel
          </Button>
        )}
      </div>
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        {filteredMessages.map((message) => (
          <div 
            key={message.id} 
            className="group relative flex items-start space-x-3 py-2 px-4 hover:bg-gray-50"
          >
            <div className="relative">
              <Avatar>
                <AvatarImage src={message.user.avatar_url} alt={message.user.name} />
                <AvatarFallback>{message.user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              {message.user.status && (
                <div 
                  className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                    message.user.status === 'online' ? 'bg-green-500' :
                    message.user.status === 'away' ? 'bg-yellow-500' :
                    message.user.status === 'busy' ? 'bg-red-500' :
                    'bg-gray-500'
                  }`} 
                />
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="flex items-center space-x-2">
                <span className="font-medium text-gray-900">{message.user.name}</span>
                <span className="text-xs text-gray-500">
                  {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="mt-0.5 text-sm text-gray-800">
                {message.content}
                {message.file && (
                  <FileAttachment file={message.file} />
                )}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <EmojiReactions 
                  messageId={message.id} 
                  reactions={message.reactions} 
                  show={true}
                />
                {!activeThread && !message.parent_id && (
                  <div className="flex items-center gap-2">
                    {message.thread_count > 0 && (
                      <span className="text-xs text-gray-500">
                        {message.thread_count} {message.thread_count === 1 ? 'reply' : 'replies'}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleReply(message.id)}
                    >
                      <Reply className="h-4 w-4 mr-1" />
                      Reply
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </ScrollArea>
      <div className="p-4 border-t">
        {attachedFile && (
          <div className="mb-2 flex items-center gap-2 bg-gray-800 p-2 rounded">
            <div className="flex-1 truncate">{attachedFile.file.name}</div>
            <Button variant="ghost" size="sm" onClick={removeAttachedFile}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
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
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button onClick={handleSendMessage}>Send</Button>
        </div>
      </div>
    </div>
  )
}

