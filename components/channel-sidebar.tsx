import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { teamData, teams } from "@/lib/mock-data"
import { ActiveChat } from "@/app/page"

interface ChannelSidebarProps {
  activeTeam: number
  setActiveChat: (chat: ActiveChat) => void
}

export function ChannelSidebar({ activeTeam, setActiveChat }: ChannelSidebarProps) {
  const activeTeamData = teamData[activeTeam]
  const activeTeamName = teams.find(team => team.id === activeTeam)?.name || 'Team'

  return (
    <div className="w-64 bg-gray-800 flex flex-col">
      <div className="p-4 text-white font-bold text-xl">{activeTeamName}</div>
      <ScrollArea className="flex-1">
        <div className="p-4">
          <Accordion type="multiple" className="w-full" defaultValue={["channels", "direct-messages"]}>
            <AccordionItem value="channels">
              <AccordionTrigger className="text-gray-300">Channels</AccordionTrigger>
              <AccordionContent>
                <ul>
                  {activeTeamData.channels.map((channel) => (
                    <li 
                      key={channel.id} 
                      className="text-gray-400 py-1 hover:text-white cursor-pointer"
                      onClick={() => setActiveChat({ type: 'channel', id: channel.id, name: channel.name })}
                    >
                      # {channel.name}
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="direct-messages">
              <AccordionTrigger className="text-gray-300">Direct Messages</AccordionTrigger>
              <AccordionContent>
                <ul>
                  {activeTeamData.directMessages.map((dm) => (
                    <li 
                      key={dm.id} 
                      className="text-gray-400 py-1 hover:text-white cursor-pointer"
                      onClick={() => setActiveChat({ type: 'directMessage', id: dm.id, name: dm.name })}
                    >
                      {dm.name}
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </ScrollArea>
    </div>
  )
}

