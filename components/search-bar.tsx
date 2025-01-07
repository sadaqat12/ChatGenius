'use client'

import { useState } from 'react'
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { teamData, messages } from "@/lib/mock-data"
import { ActiveChat } from "@/app/page"
import { Search } from 'lucide-react'

interface SearchResult {
  type: 'channel' | 'directMessage'
  id: number
  name: string
  threadId?: number
  messagePreview?: string
  fileName?: string
}

interface SearchBarProps {
  activeTeam: number
  setActiveChat: (chat: ActiveChat) => void
}

export function SearchBar({ activeTeam, setActiveChat }: SearchBarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    if (query.trim() === '') {
      setSearchResults([])
      return
    }

    const currentTeamData = teamData[activeTeam]
    const results: SearchResult[] = []

    // Search channels
    currentTeamData.channels.forEach(channel => {
      if (channel.name.toLowerCase().includes(query.toLowerCase())) {
        results.push({ type: 'channel', id: channel.id, name: channel.name })
      }

      // Search messages within the channel
      const channelMessages = messages.channels[channel.id] || []
      channelMessages.forEach(message => {
        if (message.content.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            type: 'channel',
            id: channel.id,
            name: channel.name,
            threadId: message.threadId,
            messagePreview: message.content
          })
        }
        if (message.file && message.file.name.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            type: 'channel',
            id: channel.id,
            name: channel.name,
            threadId: message.threadId,
            fileName: message.file.name
          })
        }
      })
    })

    // Search direct messages
    currentTeamData.directMessages.forEach(dm => {
      if (dm.name.toLowerCase().includes(query.toLowerCase())) {
        results.push({ type: 'directMessage', id: dm.id, name: dm.name })
      }

      // Search messages within the direct message
      const dmMessages = messages.directMessages[dm.id] || []
      dmMessages.forEach(message => {
        if (message.content.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            type: 'directMessage',
            id: dm.id,
            name: dm.name,
            messagePreview: message.content
          })
        }
      })
    })

    setSearchResults(results)
  }

  return (
    <div className="w-full bg-gray-900 p-4">
      <div className="relative">
        <Input
          type="text"
          placeholder="Search channels, messages, and files..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full pl-10 bg-gray-800 text-white placeholder-gray-400 border-gray-700"
        />
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
      </div>
      {searchResults.length > 0 && (
        <ScrollArea className="mt-2 max-h-96 bg-gray-800 rounded-md shadow-md">
          {searchResults.map((result, index) => (
            <div
              key={index}
              className="p-4 hover:bg-gray-700 cursor-pointer border-b border-gray-700 last:border-b-0"
              onClick={() => {
                setActiveChat({ type: result.type, id: result.id, name: result.name })
                setSearchQuery('')
                setSearchResults([])
              }}
            >
              <div className="font-semibold text-white">
                {result.type === 'channel' ? '#' : ''}{result.name}
                {result.threadId && ` > Thread ${result.threadId}`}
              </div>
              {result.messagePreview && (
                <div className="text-sm text-gray-400 mt-1">
                  {result.messagePreview.length > 100
                    ? `${result.messagePreview.substring(0, 100)}...`
                    : result.messagePreview}
                </div>
              )}
              {result.fileName && (
                <div className="text-sm text-gray-400 mt-1">
                  File: {result.fileName}
                </div>
              )}
            </div>
          ))}
        </ScrollArea>
      )}
    </div>
  )
}

