'use client'

import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { ChatGeniusHeader } from '@/components/chat-genius-header'

export default function ExpiredLinkPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex flex-col">
      <ChatGeniusHeader />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <h2 className="text-2xl font-bold mb-4">Invitation Link Expired</h2>
          <p className="text-gray-600 mb-6">
            This invitation link has expired or is no longer valid. Please contact the team admin to send you a new invitation.
          </p>
          <Button onClick={() => router.push('/login')}>
            Go to Login
          </Button>
        </div>
      </div>
    </div>
  )
} 