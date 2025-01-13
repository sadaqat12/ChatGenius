'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { supabase } from '@/lib/supabase'
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

  // Check auth state
  useEffect(() => {
    async function checkAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setUser(session?.user || null)
      } catch (error) {
        console.error('Error checking auth:', error)
      } finally {
        setAuthChecked(true)
      }
    }
    checkAuth()
  }, [])

  // Handle redirection
  useEffect(() => {
    if (authChecked && !user) {
      router.push('/login')
    }
  }, [authChecked, user, router])

  useEffect(() => {
    if (user) {
      fetchTeams()
    }
  }, [user])

  const fetchTeams = async () => {
    try {
      console.log('Fetching teams for user:', user?.id)
      
      if (!user) {
        console.error('No user found')
        return
      }

      // First get the user's team memberships with role
      const { data: memberships, error: membershipError } = await supabase
        .from('team_members')
        .select('team_id, role')
        .eq('user_id', user.id)

      if (membershipError) {
        console.error('Membership error:', membershipError)
        throw membershipError
      }

      console.log('Team memberships:', memberships)

      if (!memberships || memberships.length === 0) {
        console.log('No team memberships found')
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

      if (teamsError) {
        console.error('Teams error:', teamsError)
        throw teamsError
      }

      console.log('Raw teams data:', teams)

      // Combine team data with admin status
      const teamsWithAdminStatus = teams?.map(team => {
        const membership = memberships.find(m => m.team_id === team.id)
        console.log(`Team ${team.id} membership:`, membership)
        const teamWithAdmin = {
          ...team,
          is_admin: membership?.role === 'admin' || membership?.role === 'owner'
        }
        return teamWithAdmin
      })

      console.log('Teams with admin status:', teamsWithAdminStatus)
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
          <h1 className="text-2xl font-bold">Your Teams</h1>
          <div className="flex gap-4">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>Create New Team</Button>
              </DialogTrigger>
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
  )
} 