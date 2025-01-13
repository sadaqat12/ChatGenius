'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Session } from '@supabase/supabase-js'

interface Props {
  session: Session
}

export default function JoinClient({ session }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClientComponentClient()
  
  const invitationId = searchParams.get('invitation')
  
  // If no invitation ID, redirect to home
  if (!invitationId) {
    router.push('/')
    return null
  }

  const handleAcceptInvite = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get invitation details
      const { data: invitation, error: inviteError } = await supabase
        .from('team_invites')
        .select('*, team:teams(name)')
        .eq('id', invitationId)
        .single()

      if (inviteError || !invitation) {
        throw new Error('Invalid invitation')
      }

      // Verify email matches
      if (session.user.email !== invitation.email) {
        throw new Error('This invitation was sent to a different email address')
      }

      // Accept invitation
      const { error: acceptError } = await supabase
        .from('team_members')
        .insert({
          team_id: invitation.team_id,
          role: 'member'
        })

      if (acceptError) throw acceptError

      // Update invitation status
      await supabase
        .from('team_invites')
        .update({ status: 'accepted' })
        .eq('id', invitationId)

      router.push(`/teams/${invitation.team_id}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Join Team</h2>
          <p className="mt-2 text-gray-600">
            Click below to accept the team invitation
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleAcceptInvite}
          disabled={loading}
          className="group relative flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
        >
          {loading ? 'Joining...' : 'Accept Invitation'}
        </button>
      </div>
    </div>
  )
} 