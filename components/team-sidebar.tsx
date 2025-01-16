'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { supabase } from '@/lib/supabase'
import { Team } from '@/types/chat'
import { useAuth } from '@/contexts/auth-context'
import { Settings, LogOut, Circle, Moon } from 'lucide-react'
import { useToast } from "@/components/ui/use-toast"

type UserStatus = 'online' | 'away' | 'busy' | 'offline'

interface StatusOption {
  value: UserStatus
  label: string
  icon: JSX.Element
}

const statusOptions: StatusOption[] = [
  { value: 'online', label: 'Online', icon: <Circle className="h-3 w-3 fill-green-500 text-green-500" /> },
  { value: 'away', label: 'Away', icon: <Moon className="h-3 w-3 fill-yellow-500 text-yellow-500" /> },
  { value: 'busy', label: 'Do not disturb', icon: <Circle className="h-3 w-3 fill-red-500 text-red-500" /> },
  { value: 'offline', label: 'Offline', icon: <Circle className="h-3 w-3 fill-gray-500 text-gray-500" /> },
]

interface TeamSidebarProps {
  teamId?: string
}

export function TeamSidebar({ teamId }: TeamSidebarProps) {
  const [teams, setTeams] = useState<Team[]>([])
  const router = useRouter()
  const { user, profile } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    if (user) {
      fetchTeams()
    }
  }, [user])

  const fetchTeams = async () => {
    if (!user) return
    
    try {
      // First get the user's team memberships
      const { data: memberships, error: membershipError } = await supabase
        .from('team_members')
        .select('team_id')
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
      setTeams(teams || [])
    } catch (error) {
      console.error('Error fetching teams:', error)
      toast({
        title: "Error fetching teams",
        description: "Please try again later",
        variant: "destructive",
      })
    }
  }

  const handleStatusChange = async (newStatus: UserStatus) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ 
          status: newStatus,
          status_updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)

      if (error) throw error
    } catch (error) {
      console.error('Error updating status:', error)
      toast({
        title: "Error updating status",
        description: "Please try again later",
        variant: "destructive",
      })
    }
  }

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      router.push('/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const getStatusColor = (status: UserStatus) => {
    switch (status) {
      case 'online': return 'bg-green-500'
      case 'away': return 'bg-yellow-500'
      case 'busy': return 'bg-red-500'
      case 'offline': return 'bg-gray-500'
    }
  }

  return (
    <div className="w-16 bg-gray-900 flex flex-col items-center py-4">
      <ScrollArea className="flex-1 w-full">
        <div className="flex flex-col items-center space-y-4">
          {teams.map((team) => (
            <Avatar 
              key={team.id} 
              className={`cursor-pointer transition-all hover:scale-110 ${team.id === teamId ? 'ring-2 ring-blue-500' : ''}`}
              onClick={() => router.push(`/teams/${team.id}`)}
            >
              <AvatarFallback>{team.name.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          ))}
        </div>
      </ScrollArea>
      <Separator className="my-4 bg-gray-800" />
      {profile && (
        <Popover>
          <PopoverTrigger asChild>
            <div className="relative cursor-pointer">
              <Avatar className="hover:opacity-80">
                {profile.avatar_url ? (
                  <AvatarImage src={profile.avatar_url} alt="User avatar" />
                ) : (
                  <AvatarFallback>
                    {profile.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-900 ${getStatusColor(profile.status)}`} />
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2 bg-gray-900 border-gray-800 text-gray-300" side="right">
            <div className="space-y-2">
              <div className="font-medium text-sm px-2 py-1.5">
                {profile.name}
              </div>
              <Separator className="bg-gray-800" />
              <div className="space-y-1">
                {statusOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant="ghost"
                    className={`w-full justify-start gap-2 ${
                      profile.status === option.value 
                        ? 'bg-gray-800 text-white font-medium ring-1 ring-gray-700'
                        : 'hover:bg-gray-800/50'
                    }`}
                    onClick={() => handleStatusChange(option.value)}
                  >
                    {option.icon}
                    {option.label}
                  </Button>
                ))}
              </div>
              <Separator className="bg-gray-800" />
              <Button
                variant="ghost"
                className="w-full justify-start gap-2"
                onClick={() => router.push('/teams')}
              >
                <Settings className="h-4 w-4" />
                Settings
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-red-400 hover:text-red-400 hover:bg-red-400/10"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}

