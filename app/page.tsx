'use client'

import { useState } from 'react'
import Link from 'next/link'
import { TeamSidebar } from "@/components/team-sidebar"
import { ChannelSidebar } from "@/components/channel-sidebar"
import { ChatArea } from "@/components/chat-area"
import { SearchBar } from "@/components/search-bar"
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ChatGeniusHeader } from '@/components/chat-genius-header'

export type ActiveChat = {
  type: 'channel' | 'directMessage'
  id: string
  name: string
  threadId?: string
}

export default function LandingPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      // If user is logged in, redirect to their teams
      router.push('/teams')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <ChatGeniusHeader />
        <div className="flex-1 flex items-center justify-center">
          <div>Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ChatGeniusHeader />
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Team Chat Made Simple
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Connect with your team, organize discussions, and get work done in one place.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link href="/signup">
                <Button size="lg">
                  Get Started
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" size="lg">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

