'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from '@/lib/supabase'
import { ChatGeniusHeader } from '@/components/chat-genius-header'
import { UserPlus, X, Shield, ShieldOff, UserX } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

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

interface TeamMember {
  team_id: string
  user_id: string
  role: string
  users: {
    email: string
    user_profiles: {
      name: string
      avatar_url: string | null
    }
  }
}

export default function TeamSettingsPage({ params }: { params: { teamId: string } }) {
  const [settings, setSettings] = useState<TeamSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [currentUserRole, setCurrentUserRole] = useState<string>('')
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    fetchTeamSettings()
    checkAdminAccess()
    fetchPendingInvites()
    fetchTeamMembers()
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

      if (error || !membership) {
        router.push(`/teams/${params.teamId}`)
        toast({
          title: "Access denied",
          description: "You must be an admin to access team settings.",
          variant: "destructive",
        })
        return false
      }

      if (membership.role !== 'admin' && membership.role !== 'owner') {
        router.push(`/teams/${params.teamId}`)
        toast({
          title: "Access denied",
          description: "You must be an admin to access team settings.",
          variant: "destructive",
        })
        return false
      }

      setCurrentUserRole(membership.role)
      return true
    } catch (error) {
      console.error('Error checking admin access:', error)
      router.push(`/teams/${params.teamId}`)
      return false
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
      const isAdmin = await checkAdminAccess()
      if (!isAdmin) {
        throw new Error('Not authorized to invite to this team')
      }

      // Create an invitation using the API route
      const response = await fetch(`/api/teams/${params.teamId}/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: inviteEmail.toLowerCase() })
      });

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: "Failed to invite user",
          description: data.error || 'Failed to send invitation',
          variant: "destructive",
        })
        setInviting(false)
        return
      }
      
      // Handle both new invitations and existing ones
      const message = data.message || 'An invitation has been sent';
      toast({
        title: "Success!",
        description: message,
      })
      
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
        .from('team_invites')
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

  const fetchTeamMembers = async () => {
    try {
      const { data: members, error } = await supabase
        .from('team_members')
        .select(`
          team_id,
          user_id,
          role,
          users (
            email,
            user_profiles (
              name,
              avatar_url
            )
          )
        `)
        .eq('team_id', params.teamId)
        .order('role', { ascending: false })

      if (error) throw error
      setTeamMembers(members)
    } catch (error) {
      console.error('Error fetching team members:', error)
      toast({
        title: "Error",
        description: "Failed to load team members",
        variant: "destructive",
      })
    }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ role: newRole })
        .eq('team_id', params.teamId)
        .eq('user_id', userId)

      if (error) throw error

      setTeamMembers(prev => prev.map(member => 
        member.user_id === userId ? { ...member, role: newRole } : member
      ))

      toast({
        title: "Success",
        description: "Member role updated successfully",
      })
    } catch (error) {
      console.error('Error updating member role:', error)
      toast({
        title: "Error",
        description: "Failed to update member role",
        variant: "destructive",
      })
    }
  }

  const handleRemoveMember = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', params.teamId)
        .eq('user_id', userId)

      if (error) throw error

      setTeamMembers(prev => prev.filter(member => member.user_id !== userId))
      toast({
        title: "Success",
        description: "Member removed successfully",
      })
    } catch (error) {
      console.error('Error removing member:', error)
      toast({
        title: "Error",
        description: "Failed to remove member",
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
                  <DialogDescription className="space-y-2">
                    <p>Invite users to join your team.</p>
                    <div className="text-red-500 space-y-1">
                      <p className="font-medium">Note: Users must already have an account on the app to receive invites.</p>
                      <p className="text-sm">Once they sign up, you can invite them and they will see the invitation on their dashboard.</p>
                    </div>
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
            <Button variant="outline" onClick={() => router.push('/teams')}>
              Dashboard
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
            <h2 className="text-lg font-semibold mb-4">Team Members</h2>
            <div className="space-y-4">
              {teamMembers.map((member) => {
                const userProfile = member.users.user_profiles;
                const initials = userProfile.name
                  ? userProfile.name.split(' ').map(n => n[0]).join('').toUpperCase()
                  : 'U';
                
                return (
                  <div key={`${member.team_id}-${member.user_id}`} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={userProfile.avatar_url || undefined} />
                        <AvatarFallback>
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{userProfile.name}</p>
                        <p className="text-sm text-gray-500">{member.users.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {member.role !== 'owner' && currentUserRole === 'owner' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRoleChange(member.user_id, member.role === 'admin' ? 'member' : 'admin')}
                        >
                          {member.role === 'admin' ? (
                            <ShieldOff className="h-4 w-4 mr-2" />
                          ) : (
                            <Shield className="h-4 w-4 mr-2" />
                          )}
                          {member.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                        </Button>
                      )}
                      {member.role !== 'owner' && (currentUserRole === 'owner' || (currentUserRole === 'admin' && member.role === 'member')) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(member.user_id)}
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        >
                          <UserX className="h-4 w-4 mr-2" />
                          Remove
                        </Button>
                      )}
                      {member.role === 'owner' && (
                        <span className="text-sm text-gray-500 italic">Owner</span>
                      )}
                    </div>
                  </div>
                );
              })}
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