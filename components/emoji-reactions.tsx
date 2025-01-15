import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Smile, ThumbsUp, Heart, PartyPopper, Angry, Plus } from 'lucide-react'
import { Reaction as ReactionType } from '@/types/chat'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'

interface EmojiReactionsProps {
  messageId: string
  reactions: ReactionType[]
  show?: boolean
  onReactionClick: (emoji: string) => Promise<void>
  currentUserId?: string
}

const emojiOptions = [
  { emoji: '😊', icon: Smile },
  { emoji: '👍', icon: ThumbsUp },
  { emoji: '❤️', icon: Heart },
  { emoji: '🎉', icon: PartyPopper },
  { emoji: '😠', icon: Angry },
]

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

  if (!show) return null

  return (
    <div className="flex space-x-2 mt-2">
      {reactions.map((reaction) => {
        const EmojiIcon = emojiOptions.find(option => option.emoji === reaction.emoji)?.icon || Smile
        const hasReacted = currentUserId && reaction.users.some(u => u.id === currentUserId)
        return (
          <Button
            key={reaction.emoji}
            variant="outline"
            size="sm"
            className={`flex items-center space-x-1 ${hasReacted ? 'bg-gray-700/50' : ''}`}
            onClick={() => handleReact(reaction.emoji)}
          >
            <EmojiIcon className="h-4 w-4" />
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
        <PopoverContent className="w-auto p-2 bg-gray-800 border-gray-700">
          <div className="flex space-x-2">
            {emojiOptions.map(({ emoji, icon: Icon }) => (
              <Button
                key={emoji}
                variant="ghost"
                size="sm"
                className="flex items-center justify-center w-8 h-8 p-0"
                onClick={() => handleReact(emoji)}
              >
                <Icon className="h-5 w-5" />
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

