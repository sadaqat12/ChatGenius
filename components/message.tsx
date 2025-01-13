import { useState } from 'react'
import { UserAvatar } from './user-avatar'
import { EmojiReactions } from './emoji-reactions'
import { formatDistanceToNow } from 'date-fns'
import { useThread } from '@/hooks/useThread'
import { Message as MessageType } from '@/types/chat'

interface MessageProps {
  message: MessageType
  showThread?: boolean
  isThreadMessage?: boolean
}

export function Message({ message, showThread = true, isThreadMessage = false }: MessageProps) {
  const { openThread } = useThread()
  const [showReactions, setShowReactions] = useState(false)

  const handleThreadClick = () => {
    if (!isThreadMessage && showThread) {
      openThread(message)
    }
  }

  return (
    <div 
      className="group relative flex items-start space-x-3 py-2 px-4 hover:bg-gray-800/50"
      onMouseEnter={() => setShowReactions(true)}
      onMouseLeave={() => setShowReactions(false)}
    >
      <UserAvatar 
        user={{
          id: message.user.id,
          name: message.user.name,
          avatar_url: message.user.avatar_url,
          status: message.user.status,
          showStatus: true
        }} 
      />
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center space-x-2">
          <span className="font-medium text-gray-100">{message.user.name}</span>
          <span className="text-xs text-gray-400">
            {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
          </span>
        </div>
        <div className="mt-0.5 text-sm text-gray-300">
          {message.content}
          {message.file && (
            <div className="mt-2">
              <a 
                href={message.file.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                {message.file.name}
              </a>
            </div>
          )}
        </div>
        {!isThreadMessage && message.thread_count > 0 && (
          <button
            onClick={handleThreadClick}
            className="mt-1 text-xs text-gray-400 hover:text-gray-300"
          >
            {message.thread_count} {message.thread_count === 1 ? 'reply' : 'replies'}
          </button>
        )}
        <EmojiReactions 
          messageId={message.id} 
          reactions={message.reactions} 
          show={showReactions}
        />
      </div>
    </div>
  )
} 