import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Smile, ThumbsUp, Heart, PartyPopper, Angry, Plus } from 'lucide-react'

interface Reaction {
  emoji: string
  count: number
  users: string[]
}

interface EmojiReactionsProps {
  reactions: Reaction[]
  onReact: (emoji: string) => void
  currentUser: string
}

const emojiOptions = [
  { emoji: '😊', icon: Smile },
  { emoji: '👍', icon: ThumbsUp },
  { emoji: '❤️', icon: Heart },
  { emoji: '🎉', icon: PartyPopper },
  { emoji: '😠', icon: Angry },
]

export function EmojiReactions({ reactions, onReact, currentUser }: EmojiReactionsProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleReact = (emoji: string) => {
    onReact(emoji)
    setIsOpen(false)
  }

  return (
    <div className="flex space-x-2 mt-2">
      {reactions.map(({ emoji, count, users }) => {
        const EmojiIcon = emojiOptions.find(option => option.emoji === emoji)?.icon || Smile
        const hasReacted = users.includes(currentUser)
        return (
          <Button
            key={emoji}
            variant="outline"
            size="sm"
            className={`flex items-center space-x-1 ${hasReacted ? 'bg-gray-100' : ''}`}
            onClick={() => onReact(emoji)}
          >
            <EmojiIcon className="h-4 w-4" />
            <span>{count}</span>
          </Button>
        )
      })}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="flex items-center">
            <Plus className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2">
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

