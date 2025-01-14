'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { ChatGeniusHeader } from '@/components/chat-genius-header'
import { Settings } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from '@/lib/supabase'
import { useTeamInvites } from '@/hooks/useTeamInvites'

interface Team {
  id: string
  name: string
  description: string | null
  is_admin?: boolean
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [newTeamName, setNewTeamName] = useState('')
  const [creating, setCreating] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const { invites, loading: invitesLoading, acceptInvite, declineInvite } = useTeamInvites()

  // Check auth state and fetch pending team name
  useEffect(() => {
    async function checkAuth() {
      console.log('Teams page mounted, checking auth...')
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        console.log('Auth check result:', { hasSession: !!session, error })
        
        if (error) {
          console.error('Auth check error:', error)
          setAuthChecked(true)
          setLoading(false)
          return
        }
        
        if (!session?.user) {
          console.log('No session found')
          setUser(null)
          setAuthChecked(true)
          setLoading(false)
          return
        }
        
        console.log('Session found for user:', session.user.email)
        setUser(session.user)
        
        // Check for pending team name
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('pending_team_name')
          .eq('user_id', session.user.id)
          .single()
        
        if (profileError) {
          console.error('Error fetching profile:', profileError)
        }
        
        console.log('Profile data:', profile)
        
        if (profile?.pending_team_name) {
          console.log('Creating team with pending name:', profile.pending_team_name)
          try {
            // First try to create the team
            const response = await fetch('/api/teams', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: profile.pending_team_name })
            })

            if (response.ok) {
              const { teamId } = await response.json()
              console.log('Team created successfully:', teamId)
              
              // Only clear pending name after successful team creation
              const { error: clearError } = await supabase
                .from('user_profiles')
                .update({ pending_team_name: null })
                .eq('user_id', session.user.id)

              if (clearError) {
                console.error('Error clearing pending team name:', clearError)
                // Don't return here - we still want to redirect since team was created
              }
              
              router.push(`/teams/${teamId}`)
            } else {
              console.error('Failed to create team:', await response.text())
            }
          } catch (err) {
            console.error('Error creating team:', err)
          }
        }
        
        setAuthChecked(true)
        setLoading(false)
      } catch (error) {
        console.error('Error in checkAuth:', error)
        setAuthChecked(true)
        setLoading(false)
      }
    }
    checkAuth()
  }, [router])

  // Handle redirection
  useEffect(() => {
    if (authChecked && !user && !loading) {
      console.log('No authenticated user found, redirecting to login')
      router.push('/login')
    }
  }, [authChecked, user, loading, router])

  useEffect(() => {
    if (user && !loading) {
      console.log('User authenticated, fetching teams')
      fetchTeams()
    }
  }, [user, loading])

  const fetchTeams = async () => {
    try {
      if (!user) return
      
      // First get the user's team memberships with role
      const { data: memberships, error: membershipError } = await supabase
        .from('team_members')
        .select('team_id, role')
        .eq('user_id', user.id)

      if (membershipError) throw membershipError

      if (!memberships || memberships.length === 0) {
        setTeams([])
        return
      }

      // Then fetch the teams using the team IDs
      const teamIds = memberships.map(m => m.team_id)
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .in('id', teamIds)
        .order('created_at', { ascending: false })

      if (teamsError) throw teamsError

      // Combine team data with admin status
      const teamsWithAdminStatus = teams?.map(team => ({
        ...team,
        is_admin: memberships.find(m => m.team_id === team.id)?.role === 'admin' || 
                 memberships.find(m => m.team_id === team.id)?.role === 'owner'
      }))

      setTeams(teamsWithAdminStatus || [])
    } catch (error) {
      console.error('Error fetching teams:', error)
      toast({
        title: "Error fetching teams",
        description: error instanceof Error ? error.message : "Please try again later",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTeamName.trim()) return

    setCreating(true)
    try {
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTeamName })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create team')
      }

      const { teamId } = await response.json()
      
      toast({
        title: "Team created!",
        description: `${newTeamName} has been created successfully.`,
      })
      
      setNewTeamName('')
      setDialogOpen(false)
      router.push(`/teams/${teamId}`)
    } catch (error) {
      toast({
        title: "Failed to create team",
        description: error instanceof Error ? error.message : 'Please try again',
        variant: "destructive",
      })
    } finally {
      setCreating(false)
    }
  }

  if (!authChecked || !user) {
    return (
      <div className="min-h-screen flex flex-col">
        <ChatGeniusHeader />
        <div className="flex-1 flex items-center justify-center">
          <div>Loading...</div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <ChatGeniusHeader />
        <div className="flex-1 flex items-center justify-center">
          <div>Loading teams...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ChatGeniusHeader />
      <div className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <Button 
            variant="outline" 
            onClick={async () => {
              try {
                await supabase.auth.signOut()
                router.push('/login')
              } catch (error) {
                console.error('Error signing out:', error)
                toast({
                  title: "Error signing out",
                  description: "Please try again",
                  variant: "destructive",
                })
              }
            }}
          >
            Sign Out
          </Button>
        </div>

        {/* Create Team Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a new team</DialogTitle>
              <DialogDescription>
                Create a team to start collaborating with your colleagues.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateTeam}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="teamName" className="block text-sm font-medium mb-2">
                    Team Name
                  </label>
                  <Input
                    id="teamName"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="Enter team name"
                    required
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creating}>
                    {creating ? 'Creating...' : 'Create Team'}
                  </Button>
                </DialogFooter>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Pending Invitations Section */}
        {invites.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Pending Team Invitations</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex flex-col gap-4 p-6 bg-white rounded-lg shadow-sm"
                >
                  <div>
                    {invite.team ? (
                      <>
                        <h3 className="text-lg font-semibold">{invite.team.name}</h3>
                        {invite.team.description && (
                          <p className="text-sm text-gray-500">{invite.team.description}</p>
                        )}
                      </>
                    ) : (
                      <h3 className="text-lg font-semibold text-gray-500">Team no longer exists</h3>
                    )}
                  </div>
                  <div className="flex gap-2 mt-auto">
                    {invite.team ? (
                      <Button
                        onClick={() => acceptInvite(invite.id)}
                        className="flex-1"
                      >
                        Accept
                      </Button>
                    ) : null}
                    <Button
                      onClick={() => declineInvite(invite.id)}
                      variant={invite.team ? "outline" : "default"}
                      className="flex-1"
                    >
                      {invite.team ? "Decline" : "Remove"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Your Teams Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Your Teams</h2>
            <Button onClick={() => setDialogOpen(true)}>
              Create Team
            </Button>
          </div>
          {teams.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-lg font-semibold">No teams yet</h3>
              <p className="text-gray-600 mt-2">Create your first team to get started</p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {teams.map((team) => (
                <div
                  key={team.id}
                  className="relative bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold">{team.name}</h3>
                      {team.description && (
                        <p className="text-gray-600 mt-1">{team.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {team.is_admin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/teams/${team.id}/settings`)
                          }}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        onClick={() => router.push(`/teams/${team.id}`)}
                      >
                        Open
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 