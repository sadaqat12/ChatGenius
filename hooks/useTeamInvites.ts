import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/use-toast'

interface TeamInvite {
  id: string
  team_id: string
  email: string
  status: string
  created_at: string
  team: {
    id: string
    name: string
    description: string | null
  }
}

export function useTeamInvites() {
  const [invites, setInvites] = useState<TeamInvite[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const fetchInvites = async () => {
    try {
      console.log('Fetching invites...')
      const { data: { session } } = await supabase.auth.getSession()
      console.log('Current session:', session?.user?.email)
      if (!session?.user?.email) {
        console.log('No session or email found')
        return
      }

      // First try to get just the invites without the join
      const { data: rawInvites, error: inviteError } = await supabase
        .from('team_invites')
        .select('*')
        .eq('email', session.user.email)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (inviteError) {
        console.error('Error fetching raw invites:', inviteError)
        throw inviteError
      }

      console.log('Raw invites found:', rawInvites)

      if (rawInvites && rawInvites.length > 0) {
        // If we found invites, check if their teams exist
        const teamIds = rawInvites.map(invite => invite.team_id)
        console.log('Checking for teams with IDs:', teamIds)

        // First try to get the team directly without any RLS policies
        const { data: publicTeams, error: publicTeamError } = await supabase
          .from('teams')
          .select('*')
          .eq('id', teamIds[0])

        console.log('Direct team query result:', publicTeams)
        
        if (publicTeamError) {
          console.error('Error in direct team query:', publicTeamError)
        }

        // Now try with the normal query
        const { data: teams, error: teamError } = await supabase
          .from('teams')
          .select('id, name, description')
          .in('id', teamIds)

        if (teamError) {
          console.error('Error fetching teams:', teamError)
          throw teamError
        }

        console.log('Teams found through normal query:', teams)

        // Now get the full invites with team data
        const { data, error } = await supabase
          .from('team_invites')
          .select(`
            *,
            team:teams!left (
              id,
              name,
              description
            )
          `)
          .eq('email', session.user.email)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })

        if (error) throw error
        console.log('Full invites with team data:', data)
        setInvites(data || [])
      } else {
        console.log('No pending invites found')
        setInvites([])
      }
    } catch (error) {
      console.error('Error fetching invites:', error)
      toast({
        title: "Error fetching invites",
        description: error instanceof Error ? error.message : "Please try again later",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const acceptInvite = async (inviteId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Not authenticated')

      const invite = invites.find(i => i.id === inviteId)
      if (!invite) throw new Error('Invitation not found')

      // Add user to team
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
        .eq('id', inviteId)

      if (inviteError) throw inviteError

      toast({
        title: "Welcome to the team!",
        description: `You've successfully joined ${invite.team.name}`,
      })

      // Refresh invites list
      fetchInvites()
    } catch (error) {
      console.error('Error accepting invite:', error)
      toast({
        title: "Error accepting invite",
        description: error instanceof Error ? error.message : "Please try again later",
        variant: "destructive",
      })
    }
  }

  const declineInvite = async (inviteId: string) => {
    try {
      const { error } = await supabase
        .from('team_invites')
        .update({ status: 'declined' })
        .eq('id', inviteId)

      if (error) throw error

      toast({
        title: "Invitation declined",
        description: "The team invitation has been declined.",
      })

      // Refresh invites list
      fetchInvites()
    } catch (error) {
      console.error('Error declining invite:', error)
      toast({
        title: "Error declining invite",
        description: error instanceof Error ? error.message : "Please try again later",
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    fetchInvites()
  }, [])

  return {
    invites,
    loading,
    acceptInvite,
    declineInvite,
    refreshInvites: fetchInvites
  }
} 