'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from '@/lib/auth'
import { ChatGeniusHeader } from '@/components/chat-genius-header'
import { UserPlus, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface TeamSettings {
  name: string
  description: string | null
}

interface PendingInvite {
  id: string
  email: string
  created_at: string
  status: string
}

export default function TeamSettingsPage({ params }: { params: { teamId: string } }) {
  const [settings, setSettings] = useState<TeamSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    fetchTeamSettings()
    checkAdminAccess()
    fetchPendingInvites()
  }, [params.teamId])

  const checkAdminAccess = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push('/login')
        return
      }

      const { data: membership, error } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', params.teamId)
        .eq('user_id', session.user.id)
        .single()

      if (error || (membership?.role !== 'admin' && membership?.role !== 'owner')) {
        router.push(`/teams/${params.teamId}`)
        toast({
          title: "Access denied",
          description: "You must be an admin to access team settings.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error checking admin access:', error)
      router.push(`/teams/${params.teamId}`)
    }
  }

  const fetchTeamSettings = async () => {
    try {
      const { data: team, error } = await supabase
        .from('teams')
        .select('name, description')
        .eq('id', params.teamId)
        .single()

      if (error) throw error
      setSettings(team)
    } catch (error) {
      console.error('Error fetching team settings:', error)
      toast({
        title: "Error",
        description: "Failed to load team settings",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!settings) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('teams')
        .update({
          name: settings.name,
          description: settings.description
        })
        .eq('id', params.teamId)

      if (error) throw error

      toast({
        title: "Success",
        description: "Team settings updated successfully",
      })
    } catch (error) {
      console.error('Error updating team settings:', error)
      toast({
        title: "Error",
        description: "Failed to update team settings",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return

    setInviting(true)
    try {
      // First check if the user exists by checking user_profiles
      const { data: existingProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('email', inviteEmail.toLowerCase())
        .single()

      if (existingProfile) {
        // User exists, add them directly to the team
        const { error: memberError } = await supabase
          .from('team_members')
          .insert({
            team_id: params.teamId,
            user_id: existingProfile.user_id,
            role: 'member'
          })

        if (memberError) throw memberError

        toast({
          title: "User added!",
          description: `${inviteEmail} has been added to the team.`,
        })
      } else {
        // User doesn't exist, create an invitation using the API route
        const response = await fetch(`/api/teams/${params.teamId}/invitations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: inviteEmail.toLowerCase() })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to send invitation');
        }

        toast({
          title: "Invitation sent!",
          description: `An invitation has been sent to ${inviteEmail}`,
        })
      }
      
      setInviteEmail('')
      setInviteDialogOpen(false)
      // Refresh the pending invites list
      fetchPendingInvites()
    } catch (error) {
      console.error('Error inviting user:', error)
      toast({
        title: "Failed to invite user",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      })
    } finally {
      setInviting(false)
    }
  }

  const fetchPendingInvites = async () => {
    try {
      const { data: invites, error } = await supabase
        .from('team_invitations')
        .select('*')
        .eq('team_id', params.teamId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) throw error
      setPendingInvites(invites || [])
    } catch (error) {
      console.error('Error fetching pending invites:', error)
    }
  }

  const handleCancelInvite = async (inviteId: string) => {
    try {
      const { error } = await supabase
        .from('team_invites')
        .delete()
        .eq('id', inviteId)

      if (error) throw error

      setPendingInvites(prev => prev.filter(invite => invite.id !== inviteId))
      toast({
        title: "Invitation cancelled",
        description: "The invitation has been cancelled successfully.",
      })
    } catch (error) {
      console.error('Error cancelling invite:', error)
      toast({
        title: "Error",
        description: "Failed to cancel invitation",
        variant: "destructive",
      })
    }
  }

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
      <div className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Team Settings</h1>
          <div className="flex gap-2">
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Users
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Users</DialogTitle>
                  <DialogDescription>
                    Invite users to join your team. They will receive an email invitation.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleInviteUser}>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium mb-2">
                        Email Address
                      </label>
                      <Input
                        id="email"
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="Enter email address"
                        required
                      />
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setInviteDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={inviting}>
                        {inviting ? 'Sending...' : 'Send Invitation'}
                      </Button>
                    </DialogFooter>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={() => router.push(`/teams/${params.teamId}`)}>
              Back to Team
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white shadow-sm rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Team Information</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-2">
                  Team Name
                </label>
                <Input
                  id="name"
                  value={settings?.name || ''}
                  onChange={(e) => setSettings(prev => prev ? { ...prev, name: e.target.value } : null)}
                  placeholder="Enter team name"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium mb-2">
                  Description
                </label>
                <Input
                  id="description"
                  value={settings?.description || ''}
                  onChange={(e) => setSettings(prev => prev ? { ...prev, description: e.target.value } : null)}
                  placeholder="Enter team description"
                />
              </div>

              <div className="flex justify-end gap-4">
                <Button
                  variant="outline"
                  onClick={() => router.push(`/teams/${params.teamId}`)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-white shadow-sm rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Pending Invitations</h2>
            {pendingInvites.length === 0 ? (
              <p className="text-gray-500 text-sm">No pending invitations</p>
            ) : (
              <div className="space-y-3">
                {pendingInvites.map((invite) => (
                  <div key={invite.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium">{invite.email}</p>
                      <p className="text-sm text-gray-500">
                        Invited {new Date(invite.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCancelInvite(invite.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 