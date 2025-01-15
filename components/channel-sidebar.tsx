'use client'

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { Hash, Plus, Lock, MessageSquare, Bot } from "lucide-react"
import { useRouter } from "next/navigation"
import { supabase } from '@/lib/supabase'
import { Channel } from '@/types/chat'
import { useAuth } from '@/contexts/auth-context'
import { useDirectMessages } from '@/hooks/useDirectMessages'
import { useToast } from "@/components/ui/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface ChannelSidebarProps {
  teamId: string
  activeChannelId?: string
  onChannelSelect: (channelId: string, type: 'channel' | 'dm' | 'ai') => void
}

interface UserProfile {
  name: string | null;
  avatar_url: string | null;
  status: string | null;
}

interface User {
  id: string;
  email: string;
  user_profiles: UserProfile[];
}

interface TeamMemberResponse {
  user_id: string;
  role: string;
  users: User;
}

interface DirectMessageUser {
  id: string;
  email: string;
  user_profiles: UserProfile[];
}

interface DirectMessageParticipant {
  user_id: string;
  user: DirectMessageUser;
}

interface RawTeamMember {
  user_id: string;
  role: string;
  users: {
    id: string;
    email: string;
    user_profiles: {
      name: string | null;
    };
  };
}

export function ChannelSidebar({ teamId, activeChannelId, onChannelSelect }: ChannelSidebarProps) {
  const [channels, setChannels] = useState<Channel[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [teamMembers, setTeamMembers] = useState<TeamMemberResponse[]>([])
  const { user } = useAuth()
  const router = useRouter()
  const { channels: dmChannels, createChannel: createDMChannel } = useDirectMessages()
  const { toast } = useToast()

  useEffect(() => {
    if (teamId) {
      fetchChannels()
      fetchTeamMembers()
    }
  }, [teamId])

  const fetchTeamMembers = async () => {
    try {
      const { data: members, error } = await supabase
        .from('team_members')
        .select(`
          user_id,
          role,
          users:users!inner (
            id,
            email,
            profile:user_profiles!inner (
              name,
              avatar_url,
              status
            )
          )
        `)
        .eq('team_id', teamId)
        .neq('user_id', user?.id)

      if (error) throw error
      
      const transformedMembers = members?.map(member => {
        const userData = member.users as unknown as { 
          id: string; 
          email: string; 
          profile: { 
            name: string | null; 
            avatar_url: string | null; 
            status: string | null; 
          }
        }
        return {
          user_id: member.user_id,
          role: member.role,
          users: {
            id: userData.id,
            email: userData.email,
            user_profiles: [userData.profile]
          }
        }
      }) || []

      setTeamMembers(transformedMembers as TeamMemberResponse[])
    } catch (err) {
      console.error('Error fetching team members:', err)
    }
  }

  const fetchChannels = async () => {
    try {
      // First get all public channels
      const { data: publicChannels, error: publicError } = await supabase
        .from('channels')
        .select('*')
        .eq('team_id', teamId)
        .eq('is_private', false)

      if (publicError) throw publicError

      // Then get private channels where user is a member
      const { data: privateChannels, error: privateError } = await supabase
        .from('channels')
        .select('*, channel_members!inner(*)')
        .eq('team_id', teamId)
        .eq('is_private', true)
        .eq('channel_members.user_id', user?.id)

      if (privateError) throw privateError

      setChannels([...publicChannels, ...privateChannels])
    } catch (err) {
      console.error('Error fetching channels:', err)
    }
  }

  const getOtherParticipant = (channel: typeof dmChannels[0]) => {
    const otherParticipant = channel.participants.find(p => p.user_id !== user?.id)
    if (!otherParticipant) return null

    const userProfile = otherParticipant.user.user_profiles[0]
    return {
      ...otherParticipant,
      user: {
        ...otherParticipant.user,
        name: userProfile?.name || otherParticipant.user.email
      }
    }
  }

  return (
    <div className="w-64 bg-muted h-screen flex flex-col">
      <ScrollArea className="flex-1">
        {/* Channels Section */}
        <div className="px-3 py-2">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Channels</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDialogOpen(true)}
              className="h-5 w-5"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-[2px]">
            {channels.map(channel => (
              <button
                key={channel.id}
                onClick={() => onChannelSelect(channel.id, 'channel')}
                className={cn(
                  "w-full flex items-center gap-x-2 px-2 py-1.5 text-sm rounded-md hover:bg-accent",
                  activeChannelId === channel.id && "bg-accent"
                )}
              >
                {channel.is_private ? <Lock className="h-4 w-4" /> : <Hash className="h-4 w-4" />}
                <span>{channel.name}</span>
              </button>
            ))}
          </div>
        </div>

        <Separator className="my-2" />

        {/* AI Assistant Section */}
        <div className="px-3 py-2">
          <h2 className="text-lg font-semibold mb-2">AI Assistant</h2>
          <button
            onClick={() => onChannelSelect('ai', 'ai')}
            className={cn(
              "w-full flex items-center gap-x-2 px-2 py-1.5 text-sm rounded-md hover:bg-accent",
              activeChannelId === 'ai' && "bg-accent"
            )}
          >
            <Bot className="h-4 w-4" />
            <span>AI Chat</span>
          </button>
        </div>

        <Separator className="my-2" />

        {/* Direct Messages Section */}
        <div className="px-3 py-2">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Direct Messages</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDialogOpen(true)}
              className="h-5 w-5"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-[2px]">
            {dmChannels.map(channel => {
              const otherParticipant = getOtherParticipant(channel)
              if (!otherParticipant) return null

              const userProfile = otherParticipant.user.user_profiles[0]
              return (
                <button
                  key={channel.id}
                  onClick={() => onChannelSelect(channel.id, 'dm')}
                  className={cn(
                    "w-full flex items-center gap-x-2 px-2 py-1.5 text-sm rounded-md hover:bg-accent",
                    activeChannelId === channel.id && "bg-accent"
                  )}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>{userProfile?.name || otherParticipant.user.email}</span>
                  <div 
                    className={cn(
                      "w-2 h-2 rounded-full ml-auto",
                      otherParticipant.user.status === 'online' && "bg-green-500",
                      otherParticipant.user.status === 'away' && "bg-yellow-500",
                      otherParticipant.user.status === 'busy' && "bg-red-500",
                      otherParticipant.user.status === 'offline' && "bg-gray-500"
                    )}
                  />
                </button>
              )
            })}
          </div>
        </div>
      </ScrollArea>

      {/* New Channel/DM Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a conversation</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {teamMembers.map(member => {
              const userProfile = member.users.user_profiles[0]
              return (
                <Button
                  key={member.user_id}
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={async () => {
                    try {
                      const channelId = await createDMChannel(member.user_id)
                      if (channelId) {
                        onChannelSelect(channelId, 'dm')
                        setIsDialogOpen(false)
                      } else {
                        toast({
                          title: "Error",
                          description: "Could not create conversation",
                          variant: "destructive"
                        })
                      }
                    } catch (error) {
                      console.error('Error creating DM:', error)
                      toast({
                        title: "Error",
                        description: "Could not create conversation",
                        variant: "destructive"
                      })
                    }
                  }}
                >
                  {userProfile?.name || member.users.email}
                </Button>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

