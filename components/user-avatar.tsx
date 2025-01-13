import { useEffect, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { BellOff, BellRing, LogOut, Settings, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from "@/components/ui/use-toast"

type Status = 'online' | 'away' | 'busy' | 'offline';

interface UserAvatarProps {
  user: {
    id: string;
    name: string;
    avatar_url?: string;
    status?: Status;
    showStatus?: boolean;
  };
  size?: 'sm' | 'md' | 'lg';
}

export function UserAvatar({ user, size = 'md' }: UserAvatarProps) {
  const [status, setStatus] = useState<Status>(user.status || 'online')
  const { user: currentUser } = useAuth()
  const { toast } = useToast()
  const isCurrentUser = currentUser?.id === user.id

  useEffect(() => {
    if (user.status) {
      setStatus(user.status)
    }
  }, [user.status])

  const statusColors = {
    online: 'bg-green-500',
    away: 'bg-yellow-500',
    busy: 'bg-red-500',
    offline: 'bg-gray-500'
  };

  const handleStatusChange = async (newStatus: Status) => {
    if (!isCurrentUser) return

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ 
          status: newStatus,
          status_updated_at: new Date().toISOString()
        })
        .eq('user_id', currentUser.id)

      if (error) throw error
      
      setStatus(newStatus)
    } catch (error) {
      console.error('Error updating status:', error)
      toast({
        title: "Error updating status",
        description: "Please try again later",
        variant: "destructive",
      })
    }
  }

  const avatarSizes = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10'
  }

  const statusSizes = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-3.5 w-3.5'
  }

  const content = (
    <div className="relative cursor-pointer">
      <Avatar className={avatarSizes[size]}>
        <AvatarImage src={user.avatar_url} alt={user.name} />
        <AvatarFallback>{user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      {user.showStatus !== false && (
        <span 
          className={`absolute bottom-0 right-0 block ${statusSizes[size]} rounded-full ring-2 ring-white ${statusColors[status]}`} 
        />
      )}
    </div>
  )

  if (!isCurrentUser) {
    return content
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        {content}
      </PopoverTrigger>
      <PopoverContent className="w-56 bg-gray-800 text-white border-gray-700">
        <div className="space-y-2">
          <h3 className="font-semibold text-sm">{user.name}</h3>
          <hr className="border-gray-700" />
          <div className="space-y-1">
            <Button 
              variant="ghost" 
              className="w-full justify-start text-left font-normal" 
              onClick={() => handleStatusChange('online')}
            >
              <div className="w-2 h-2 rounded-full bg-green-500 mr-2" />
              Online
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start text-left font-normal" 
              onClick={() => handleStatusChange('away')}
            >
              <div className="w-2 h-2 rounded-full bg-yellow-500 mr-2" />
              Away
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start text-left font-normal" 
              onClick={() => handleStatusChange('busy')}
            >
              <div className="w-2 h-2 rounded-full bg-red-500 mr-2" />
              Busy
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start text-left font-normal" 
              onClick={() => handleStatusChange('offline')}
            >
              <div className="w-2 h-2 rounded-full bg-gray-500 mr-2" />
              Offline
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

