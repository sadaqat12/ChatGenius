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
import { Settings, LogOut, Circle, Moon, Sun } from 'lucide-react'

type UserStatus = 'online' | 'idle' | 'dnd' | 'offline'

interface StatusOption {
  value: UserStatus
  label: string
  icon: JSX.Element
}

const statusOptions: StatusOption[] = [
  { value: 'online', label: 'Online', icon: <Circle className="h-3 w-3 fill-green-500 text-green-500" /> },
  { value: 'idle', label: 'Idle', icon: <Moon className="h-3 w-3 fill-yellow-500 text-yellow-500" /> },
  { value: 'dnd', label: 'Do not disturb', icon: <Circle className="h-3 w-3 fill-red-500 text-red-500" /> },
  { value: 'offline', label: 'Offline', icon: <Circle className="h-3 w-3 fill-gray-500 text-gray-500" /> },
]

interface TeamSidebarProps {
  teamId: string
}

export function TeamSidebar({ teamId }: TeamSidebarProps) {
  const [teams, setTeams] = useState<Team[]>([])
  const router = useRouter()
  const { user } = useAuth()
  const [userProfile, setUserProfile] = useState<{ name?: string; avatar_url?: string } | null>(null)
  const [status, setStatus] = useState<UserStatus>('online')

  useEffect(() => {
    fetchTeams()
    if (user) {
      fetchUserProfile()
    }
  }, [user])

  const fetchTeams = async () => {
    try {
      const { data: teams, error } = await supabase
        .from('teams')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setTeams(teams || [])
    } catch (error) {
      console.error('Error fetching teams:', error)
    }
  }

  const fetchUserProfile = async () => {
    try {
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('name, avatar_url')
        .eq('user_id', user?.id)
        .single()

      if (error) throw error
      setUserProfile(profile)
    } catch (error) {
      console.error('Error fetching user profile:', error)
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
      case 'idle': return 'bg-yellow-500'
      case 'dnd': return 'bg-red-500'
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
      <Popover>
        <PopoverTrigger asChild>
          <div className="relative cursor-pointer">
            <Avatar className="hover:opacity-80">
              {userProfile?.avatar_url ? (
                <AvatarImage src={userProfile.avatar_url} alt="User avatar" />
              ) : (
                <AvatarFallback>
                  {user?.email?.substring(0, 2).toUpperCase() || 'U'}
                </AvatarFallback>
              )}
            </Avatar>
            <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-900 ${getStatusColor(status)}`} />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2 bg-gray-900 border-gray-800 text-gray-300" side="right">
          <div className="space-y-2">
            <div className="font-medium text-sm px-2 py-1.5">
              {userProfile?.name || user?.email}
            </div>
            <Separator className="bg-gray-800" />
            <div className="space-y-1">
              {statusOptions.map((option) => (
                <Button
                  key={option.value}
                  variant="ghost"
                  className={`w-full justify-start gap-2 ${status === option.value ? 'bg-gray-800' : ''}`}
                  onClick={() => setStatus(option.value)}
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
    </div>
  )
}

