'use client'

import { useState } from 'react'
import { TeamSidebar } from "@/components/team-sidebar"
import { ChannelSidebar } from "@/components/channel-sidebar"
import { ChatArea } from "@/components/chat-area"
import { SearchBar } from "@/components/search-bar"
import { ChatGeniusHeader } from "@/components/chat-genius-header"

export type ActiveChat = {
  type: 'channel' | 'directMessage'
  id: number
  name: string
  threadId?: number
}

export default function Page() {
  const [activeTeam, setActiveTeam] = useState(1)
  const [activeChat, setActiveChat] = useState<ActiveChat>({ type: 'channel', id: 1, name: 'general' })

  return (
    <div className="flex flex-col h-screen">
      <ChatGeniusHeader />
      <SearchBar activeTeam={activeTeam} setActiveChat={setActiveChat} />
      <div className="flex flex-1 overflow-hidden">
        <TeamSidebar setActiveTeam={setActiveTeam} />
        <ChannelSidebar activeTeam={activeTeam} setActiveChat={setActiveChat} />
        <ChatArea activeChat={activeChat} />
      </div>
    </div>
  )
}

