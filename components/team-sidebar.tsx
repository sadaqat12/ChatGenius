import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { UserAvatar } from "./user-avatar"
import { teams, currentUser } from "@/lib/mock-data"

interface TeamSidebarProps {
  setActiveTeam: (teamId: number) => void
}

export function TeamSidebar({ setActiveTeam }: TeamSidebarProps) {
  return (
    <div className="w-16 bg-gray-900 flex flex-col items-center py-4">
      <ScrollArea className="flex-1 w-full">
        <div className="flex flex-col items-center space-y-4">
          {teams.map((team) => (
            <Avatar 
              key={team.id} 
              className="cursor-pointer transition-all hover:scale-110"
              onClick={() => setActiveTeam(team.id)}
            >
              <AvatarImage src={team.avatar} alt={team.name} />
              <AvatarFallback>{team.name.substring(0, 2)}</AvatarFallback>
            </Avatar>
          ))}
        </div>
      </ScrollArea>
      <div className="mt-auto pt-4 border-t border-gray-700 w-full flex justify-center">
        <UserAvatar user={currentUser} />
      </div>
    </div>
  )
}

