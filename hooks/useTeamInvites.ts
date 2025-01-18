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
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const { data: invites, error } = await supabase
        .from('team_invites')
        .select(`
          id,
          team_id,
          email,
          status,
          team:teams (
            id,
            name,
            description
          )
        `)
        .eq('email', session.user.email)
        .eq('status', 'pending')

      if (error) throw error

      if (invites && invites.length > 0) {
        setInvites(invites)
      } else {
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