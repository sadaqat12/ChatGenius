'use client'

import { useState, useEffect, useRef } from 'react'
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Paperclip, X, Reply, ArrowLeft } from 'lucide-react'
import { messages as initialMessages } from "@/lib/mock-data"
import { ActiveChat } from "@/app/page"
import { FileAttachment } from "@/components/file-attachment"
import { EmojiReactions } from "@/components/emoji-reactions"
import Image from 'next/image'

interface ChatAreaProps {
  activeChat: ActiveChat
}

interface AttachedFile {
  file: File
  preview: string
}

interface Reaction {
  emoji: string
  count: number
  users: string[]
}

interface Message {
  id: number
  user: string
  content: string
  timestamp: string
  threadId: number
  parentId?: number
  file?: {
    name: string
    type: string
    url: string
  }
  reactions: Reaction[]
}

export function ChatArea({ activeChat }: ChatAreaProps) {
  const [messages, setMessages] = useState<{ [key: string]: { [key: number]: Message[] } }>(
    Object.entries(initialMessages).reduce((acc, [key, value]) => {
      acc[key] = Object.entries(value).reduce((innerAcc, [innerKey, innerValue]) => {
        innerAcc[Number(innerKey)] = innerValue.map(message => ({
          ...message,
          reactions: [],
          parentId: message.parentId || undefined
        }))
        return innerAcc
      }, {} as { [key: number]: Message[] })
      return acc
    }, {} as { [key: string]: { [key: number]: Message[] } })
  )
  const [newMessage, setNewMessage] = useState('')
  const [activeThread, setActiveThread] = useState<number | null>(null)
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentUser = 'You' // This should be replaced with the actual current user's name or ID

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

  const chatMessages = activeChat.type === 'channel' 
    ? messages.channels[activeChat.id] 
    : messages.directMessages[activeChat.id]

  const filteredMessages = activeThread
    ? chatMessages.filter(message => message.threadId === activeThread)
    : chatMessages.filter(message => !message.parentId)

  const sendMessage = () => {
    if (newMessage.trim() === '' && !attachedFile) return

    const newMessageObj: Message = {
      id: Date.now(), // Use a unique ID
      user: currentUser,
      content: newMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      threadId: activeThread || chatMessages[chatMessages.length - 1].threadId + 1,
      parentId: activeThread ? chatMessages.find(m => m.threadId === activeThread)?.id : undefined,
      file: attachedFile ? {
        name: attachedFile.file.name,
        type: attachedFile.file.type,
        url: attachedFile.preview
      } : undefined,
      reactions: []
    }

    setMessages(prevMessages => {
      const updatedMessages = { ...prevMessages }
      const messageList = activeChat.type === 'channel' 
        ? updatedMessages.channels[activeChat.id] 
        : updatedMessages.directMessages[activeChat.id]
      
      messageList.push(newMessageObj)
      
      return updatedMessages
    })

    setNewMessage('')
    setAttachedFile(null)
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

  const handleReaction = (messageId: number, emoji: string) => {
    setMessages(prevMessages => {
      const updatedMessages = { ...prevMessages }
      const messageList = activeChat.type === 'channel' 
        ? updatedMessages.channels[activeChat.id] 
        : updatedMessages.directMessages[activeChat.id]
      
      const messageIndex = messageList.findIndex(m => m.id === messageId)
      if (messageIndex !== -1) {
        const message = { ...messageList[messageIndex] }
        const existingReactionIndex = message.reactions.findIndex(r => r.emoji === emoji)
        
        if (existingReactionIndex !== -1) {
          const reaction = message.reactions[existingReactionIndex]
          if (reaction.users.includes(currentUser)) {
            // Remove user's reaction
            reaction.count -= 1
            reaction.users = reaction.users.filter(user => user !== currentUser)
            if (reaction.count === 0) {
              message.reactions.splice(existingReactionIndex, 1)
            }
          } else {
            // Add user's reaction
            reaction.count += 1
            reaction.users.push(currentUser)
          }
        } else {
          // Add new reaction
          message.reactions.push({ emoji, count: 1, users: [currentUser] })
        }
        
        messageList[messageIndex] = message
      }

      return updatedMessages
    })
  }

  const handleReply = (messageId: number) => {
    const parentMessage = chatMessages.find(m => m.id === messageId)
    if (parentMessage) {
      setActiveThread(parentMessage.threadId)
    }
  }

  const getReplyCount = (messageId: number) => {
    return chatMessages.filter(m => m.parentId === messageId).length
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="text-xl font-bold">
          {activeChat.type === 'channel' ? `#${activeChat.name}` : activeChat.name}
          {activeThread && ` > Thread`}
        </h2>
        {activeThread && (
          <Button variant="outline" onClick={() => setActiveThread(null)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to All Messages
          </Button>
        )}
      </div>
      <ScrollArea className="flex-1 p-4">
        {filteredMessages.map((message) => (
          <div key={message.id} className="mb-4">
            <div className="font-bold">{message.user}</div>
            <div>{message.content}</div>
            {message.file && (
              <FileAttachment file={message.file} />
            )}
            <div className="text-sm text-gray-500">{message.timestamp}</div>
            <div className="flex items-center mt-2">
              <EmojiReactions 
                reactions={message.reactions} 
                onReact={(emoji) => handleReaction(message.id, emoji)}
                currentUser={currentUser}
              />
              {!activeThread && (
                <Button variant="ghost" size="sm" onClick={() => handleReply(message.id)}>
                  <Reply className="h-4 w-4 mr-1" />
                  Reply
                </Button>
              )}
            </div>
            {!activeThread && getReplyCount(message.id) > 0 && (
              <Button 
                variant="link" 
                size="sm" 
                className="mt-1 p-0 h-auto" 
                onClick={() => setActiveThread(message.threadId)}
              >
                View {getReplyCount(message.id)} replies
              </Button>
            )}
          </div>
        ))}
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
        <div className="flex items-center">
          <Input 
            className="flex-1 mr-2" 
            placeholder="Type a message..." 
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
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
            className="mr-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button onClick={sendMessage}>Send</Button>
        </div>
      </div>
    </div>
  )
}

