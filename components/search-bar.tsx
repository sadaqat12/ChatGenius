'use client'

import { useState } from 'react'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { useSearch } from '@/hooks/useSearch'
import { ActiveChat } from '@/app/teams/[teamId]/page'
import { Hash, MessageSquare, User, Loader2 } from 'lucide-react'

interface SearchBarProps {
  teamId: string
  setActiveChat: (chat: ActiveChat) => void
}

export function SearchBar({ teamId, setActiveChat }: SearchBarProps) {
  const { search, results, isSearching } = useSearch({ teamId })
  const [query, setQuery] = useState('')

  return (
    <div className="border-b bg-gray-900 relative">
      <Command className="border-0 rounded-none bg-gray-900" shouldFilter={false}>
        <div className="bg-gray-900 cmdk-input-wrapper">
          <CommandInput 
            placeholder="Search messages and channels..." 
            onValueChange={(value) => {
              setQuery(value)
              search(value)
            }}
            value={query}
            className="border-0 focus:ring-0 bg-gray-900 text-gray-300 placeholder:text-gray-500"
          />
        </div>
        {query.trim().length > 0 && (
          <CommandList className="bg-gray-900 text-gray-300 absolute w-full max-h-96 z-50 top-full border border-gray-800 shadow-lg">
            {isSearching ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">Searching...</span>
              </div>
            ) : results.length === 0 ? (
              <CommandEmpty className="py-6 text-center text-sm text-gray-500">
                No results found.
              </CommandEmpty>
            ) : (
              <CommandGroup>
                {results.map((result) => (
                  <CommandItem
                    key={result.id}
                    onSelect={() => {
                      if (result.type === 'channel') {
                        setActiveChat({
                          type: 'channel',
                          id: result.id,
                          name: result.title,
                          threadId: undefined
                        })
                      } else if (result.type === 'user' && result.user_id) {
                        setActiveChat({
                          type: 'directMessage',
                          id: result.user_id,
                          name: result.title,
                          threadId: undefined
                        })
                      } else if (result.type === 'message' && result.channel_id && result.channel_name) {
                        setActiveChat({
                          type: 'channel',
                          id: result.channel_id,
                          name: result.channel_name,
                          threadId: result.id
                        })
                      }
                      setQuery('')
                    }}
                    className="hover:bg-gray-800 text-gray-300"
                  >
                    {result.type === 'channel' ? (
                      <Hash className="mr-2 h-4 w-4 text-gray-400" />
                    ) : result.type === 'user' ? (
                      <User className="mr-2 h-4 w-4 text-gray-400" />
                    ) : (
                      <MessageSquare className="mr-2 h-4 w-4 text-gray-400" />
                    )}
                    <div>
                      <div className="font-medium text-gray-300">{result.title}</div>
                      {result.subtitle && (
                        <div className="text-xs text-gray-500">{result.subtitle}</div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        )}
      </Command>
    </div>
  )
}

