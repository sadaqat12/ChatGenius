'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from '@/lib/supabase'
import { ChatGeniusHeader } from '@/components/chat-genius-header'

interface TeamInvite {
  team_id: string
  team_name: string
  email: string
  status: string
}

interface InviteResponse {
  team_id: string
  email: string
  status: string
  team: {
    name: string
  }
}

export default function InvitePage() {
  const [loading, setLoading] = useState(true)
  const [invite, setInvite] = useState<TeamInvite | null>(null)
  const [accepting, setAccepting] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  useEffect(() => {
    checkInvitation()
  }, [])

  const checkInvitation = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push('/login')
        return
      }

      const inviteData = session.user.user_metadata?.invite_data
      if (!inviteData?.team_id || inviteData?.invite_type !== 'team') {
        toast({
          title: "Invalid invitation",
          description: "This invitation link is invalid or has expired.",
          variant: "destructive",
        })
        router.push('/teams')
        return
      }

      // Check if invitation exists and is still pending
      const { data: invite, error } = await supabase
        .from('team_invites')
        .select(`
          team_id,
          email,
          status,
          team:teams!inner (
            name
          )
        `)
        .eq('team_id', inviteData.team_id)
        .eq('email', session.user.email)
        .eq('status', 'pending')
        .single()

      if (error || !invite) {
        toast({
          title: "Invalid invitation",
          description: "This invitation has expired or already been used.",
          variant: "destructive",
        })
        router.push('/teams')
        return
      }

      const typedInvite = invite as unknown as InviteResponse
      setInvite({
        team_id: typedInvite.team_id,
        team_name: typedInvite.team.name,
        email: typedInvite.email,
        status: typedInvite.status
      })
    } catch (error) {
      console.error('Error checking invitation:', error)
      toast({
        title: "Error",
        description: "Failed to load invitation",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptInvite = async () => {
    if (!invite) return

    setAccepting(true)
    try {
      // Add user to team
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('No user session')

      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          team_id: invite.team_id,
          user_id: session.user.id,
          role: 'member'
        })

      if (memberError) throw memberError

      // Update invitation status
      const { error: inviteError } = await supabase
        .from('team_invites')
        .update({ status: 'accepted' })
        .eq('team_id', invite.team_id)
        .eq('email', invite.email)

      if (inviteError) throw inviteError

      toast({
        title: "Welcome to the team!",
        description: `You've successfully joined ${invite.team_name}`,
      })

      router.push(`/teams/${invite.team_id}`)
    } catch (error) {
      console.error('Error accepting invitation:', error)
      toast({
        title: "Error",
        description: "Failed to accept invitation",
        variant: "destructive",
      })
    } finally {
      setAccepting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <ChatGeniusHeader />
        <div className="flex-1 flex items-center justify-center">
          <div>Loading invitation...</div>
        </div>
      </div>
    )
  }

  if (!invite) {
    return (
      <div className="min-h-screen flex flex-col">
        <ChatGeniusHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Invalid Invitation</h1>
            <p className="text-gray-600 mb-4">This invitation link is invalid or has expired.</p>
            <Button onClick={() => router.push('/teams')}>
              Go to Teams
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ChatGeniusHeader />
      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-md w-full mx-auto p-6">
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <h1 className="text-2xl font-bold mb-2">Team Invitation</h1>
            <p className="text-gray-600 mb-6">
              You've been invited to join {invite.team_name}
            </p>
            <div className="space-y-4">
              <Button
                className="w-full"
                onClick={handleAcceptInvite}
                disabled={accepting}
              >
                {accepting ? 'Joining...' : 'Accept Invitation'}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push('/teams')}
              >
                Decline
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 