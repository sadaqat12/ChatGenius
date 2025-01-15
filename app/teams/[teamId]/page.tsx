'use client'

import { useState, useEffect } from 'react'
import { TeamSidebar } from "@/components/team-sidebar"
import { ChannelSidebar } from "@/components/channel-sidebar"
import { ChatArea } from "@/components/chat-area"
import { SearchBar } from "@/components/search-bar"
import { supabase } from '@/lib/supabase'

export type ActiveChat = {
  type: 'channel' | 'dm' | 'ai'
  id: string
  name: string
  threadId?: string
}

export default function TeamPage({ params }: { params: { teamId: string } }) {
  const [activeChat, setActiveChat] = useState<ActiveChat>({
    type: 'channel',
    id: '',
    name: ''
  })

  useEffect(() => {
    async function fetchGeneralChannel() {
      try {
        const { data, error } = await supabase
          .from('channels')
          .select('id')
          .eq('team_id', params.teamId)
          .eq('name', 'general')
          .single()

        if (error) throw error

        setActiveChat({
          type: 'channel',
          id: data.id,
          name: 'general'
        })
      } catch (error) {
        console.error('Error fetching general channel:', error)
      }
    }

    fetchGeneralChannel()
  }, [params.teamId])

  if (!activeChat.id && activeChat.type !== 'ai') {
    return <div>Loading...</div>
  }

  return (
    <div className="flex flex-col h-screen">
      <SearchBar teamId={params.teamId} setActiveChat={setActiveChat} />
      <div className="flex flex-1 overflow-hidden">
        <TeamSidebar teamId={params.teamId} />
        <ChannelSidebar 
          teamId={params.teamId} 
          activeChannelId={activeChat.id} 
          onChannelSelect={async (channelId, type) => {
            if (type === 'channel') {
              const { data: channel } = await supabase
                .from('channels')
                .select('name')
                .eq('id', channelId)
                .single()
              
              setActiveChat({ 
                type: 'channel', 
                id: channelId, 
                name: channel?.name || 'Unknown Channel'
              })
            } else if (type === 'dm') {
              setActiveChat({ 
                type: 'dm', 
                id: channelId, 
                name: 'Direct Message'
              })
            } else if (type === 'ai') {
              setActiveChat({
                type: 'ai',
                id: 'ai-assistant',
                name: 'AI Assistant'
              })
            }
          }} 
        />
        <ChatArea activeChat={activeChat} />
      </div>
    </div>
  )
} 