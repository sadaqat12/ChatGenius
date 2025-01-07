import { useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { BellOff, BellRing, LogOut, Settings, User } from 'lucide-react'

type Status = 'online' | 'away' | 'busy' | 'offline';

interface UserAvatarProps {
  user: {
    name: string;
    avatar: string;
    status: Status;
  };
}

export function UserAvatar({ user }: UserAvatarProps) {
  const [status, setStatus] = useState<Status>(user.status)
  const [isMuted, setIsMuted] = useState(false)

  const statusColors = {
    online: 'bg-green-500',
    away: 'bg-yellow-500',
    busy: 'bg-red-500',
    offline: 'bg-gray-500'
  };

  const handleStatusChange = (newStatus: Status) => {
    setStatus(newStatus)
    // Here you would typically update the status on the server
  }

  const handleMuteToggle = () => {
    setIsMuted(!isMuted)
    // Here you would typically update the mute setting on the server
  }

  const handleSettings = () => {
    // Implement navigation to settings page
    console.log('Navigate to settings')
  }

  const handleLogout = () => {
    // Implement logout functionality
    console.log('Logout')
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div className="relative cursor-pointer">
          <Avatar>
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback>{user.name.substring(0, 2)}</AvatarFallback>
          </Avatar>
          <span className={`absolute bottom-0 right-0 block h-3 w-3 rounded-full ring-2 ring-white ${statusColors[status]}`} />
        </div>
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
          <hr className="border-gray-700" />
          <Button 
            variant="ghost" 
            className="w-full justify-start text-left font-normal" 
            onClick={handleMuteToggle}
          >
            {isMuted ? <BellOff className="mr-2 h-4 w-4" /> : <BellRing className="mr-2 h-4 w-4" />}
            {isMuted ? 'Unmute notifications' : 'Mute notifications'}
          </Button>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-left font-normal" 
            onClick={handleSettings}
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
          <hr className="border-gray-700" />
          <Button 
            variant="ghost" 
            className="w-full justify-start text-left font-normal text-red-400" 
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

