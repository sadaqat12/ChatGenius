'use client'

import { useEffect, useState } from 'react'
import { Button } from "@/components/ui/button"
import { InviteMembersDialog } from '@/components/invite-members-dialog'
import { formatDistanceToNow } from 'date-fns'

interface Invitation {
  id: string
  email: string
  status: string
  created_at: string
  expires_at: string
  invited_by: {
    id: string
    email: string
    user_profiles: {
      name: string
    }[]
  }
}

export default function InvitationsPage({ params }: { params: { teamId: string } }) {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)

  const fetchInvitations = async () => {
    try {
      const response = await fetch(`/api/teams/${params.teamId}/invitations`)
      if (!response.ok) throw new Error('Failed to fetch invitations')
      const data = await response.json()
      setInvitations(data)
    } catch (error) {
      console.error('Error fetching invitations:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInvitations()
  }, [params.teamId])

  if (loading) {
    return <div className="p-4">Loading...</div>
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Pending Invitations</h1>
        <InviteMembersDialog teamId={params.teamId} onInviteSent={fetchInvitations} />
      </div>

      {invitations.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No pending invitations
        </div>
      ) : (
        <div className="space-y-4">
          {invitations.map((invitation) => (
            <div
              key={invitation.id}
              className="border rounded-lg p-4 flex items-center justify-between"
            >
              <div>
                <div className="font-medium">{invitation.email}</div>
                <div className="text-sm text-gray-500">
                  Invited by {invitation.invited_by.user_profiles[0]?.name || invitation.invited_by.email}
                  {' • '}
                  {formatDistanceToNow(new Date(invitation.created_at))} ago
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    // Copy invitation link
                    navigator.clipboard.writeText(
                      `${window.location.origin}/join?invitation=${invitation.id}`
                    )
                  }}
                >
                  Copy Link
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 