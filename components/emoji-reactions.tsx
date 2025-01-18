import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Plus } from 'lucide-react'
import { Reaction as ReactionType } from '@/types/chat'
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react'

interface EmojiReactionsProps {
  messageId: string
  reactions: ReactionType[]
  show?: boolean
  onReactionClick: (emoji: string) => Promise<void>
  currentUserId?: string
}

export function EmojiReactions({ messageId, reactions = [], show = true, onReactionClick, currentUserId }: EmojiReactionsProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleReact = async (emoji: string) => {
    try {
      await onReactionClick(emoji)
    } catch (error) {
      console.error('Error handling reaction:', error)
    }
    setIsOpen(false)
  }

  const onEmojiClick = (emojiData: EmojiClickData) => {
    handleReact(emojiData.emoji)
  }

  if (!show) return null

  return (
    <div className="flex space-x-2 mt-2">
      {reactions.map((reaction) => {
        const hasReacted = currentUserId && reaction.users.some(u => u.id === currentUserId)
        return (
          <Button
            key={reaction.emoji}
            variant="outline"
            size="sm"
            className={`flex items-center space-x-1 ${hasReacted ? 'bg-gray-700/50' : ''}`}
            onClick={() => handleReact(reaction.emoji)}
          >
            <span className="text-lg leading-none">{reaction.emoji}</span>
            <span>{reaction.count}</span>
          </Button>
        )
      })}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="flex items-center">
            <Plus className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-gray-800 border-gray-700">
          <EmojiPicker
            onEmojiClick={onEmojiClick}
            theme="dark"
            lazyLoadEmojis={true}
            searchPlaceHolder="Search emoji..."
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

