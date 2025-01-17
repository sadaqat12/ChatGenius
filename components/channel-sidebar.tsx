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
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"

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
  user_profiles: UserProfile;
}

interface TeamMemberResponse {
  user_id: string;
  role: string;
  users: {
    id: string;
    email: string;
    user_profiles: UserProfile;
  };
}

interface DirectMessageUser {
  id: string;
  email: string;
  user_profiles: {
    name: string | null;
    avatar_url: string | null;
    status: string | null;
  };
}

interface DirectMessageParticipant {
  user_id: string;
  user: DirectMessageUser;
}

interface DirectMessageChannel {
  id: string;
  participants: DirectMessageParticipant[];
}

interface RawTeamMember {
  user_id: string;
  role: string;
  users: {
    id: string;
    email: string;
    user_profiles: UserProfile;
  };
}

export function ChannelSidebar({ teamId, activeChannelId, onChannelSelect }: ChannelSidebarProps) {
  const [channels, setChannels] = useState<Channel[]>([])
  const [isDMDialogOpen, setIsDMDialogOpen] = useState(false)
  const [isChannelDialogOpen, setIsChannelDialogOpen] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [isPrivateChannel, setIsPrivateChannel] = useState(false)
  const [teamMembers, setTeamMembers] = useState<TeamMemberResponse[]>([])
  const { user } = useAuth()
  const router = useRouter()
  const { channels: dmChannels, createChannel: createDMChannel } = useDirectMessages({ teamId })
  const { toast } = useToast()
  const [userProfiles, setUserProfiles] = useState<Record<string, { name: string | null, avatar_url: string | null, status: string | null }>>({})
  const [formattedDMChannels, setFormattedDMChannels] = useState<Array<{
    id: string;
    participants: DirectMessageParticipant[];
  }>>([])

  useEffect(() => {
    if (teamId) {
      fetchChannels()
      fetchTeamMembers()
    }
  }, [teamId])

  useEffect(() => {
    const fetchUserProfiles = async () => {
      if (!dmChannels.length) return

      const userIds = dmChannels
        .map(channel => channel.participants.find(p => p.user_id !== user?.id)?.user_id)
        .filter((id): id is string => id !== undefined)

      if (!userIds.length) return

      try {
        const { data: members, error } = await supabase
          .from('team_members')
          .select(`
            user_id,
            users:users!inner (
              id,
              email,
              user_profiles!inner (
                name,
                avatar_url,
                status
              )
            )
          `)
          .eq('team_id', teamId)
          .in('user_id', userIds)

        if (error) throw error

        const profiles = Object.fromEntries(
          members.map(member => [
            member.user_id,
            {
              name: member.users[0]?.user_profiles[0]?.name,
              avatar_url: member.users[0]?.user_profiles[0]?.avatar_url,
              status: member.users[0]?.user_profiles[0]?.status
            }
          ])
        )

        setUserProfiles(profiles)
      } catch (err) {
        console.error('Error fetching user profiles:', err)
      }
    }

    fetchUserProfiles()
  }, [dmChannels, teamId, user?.id])

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
            user_profiles!inner (
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
        const userData = member.users
        return {
          user_id: member.user_id,
          role: member.role,
          users: {
            id: userData.id,
            email: userData.email,
            user_profiles: userData.user_profiles
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

  const getOtherParticipant = (channel: DirectMessageChannel) => {
    const otherParticipant = channel.participants.find(p => p.user_id !== user?.id);
    
    if (!otherParticipant?.user) {
      return 'Unknown User';
    }
    
    const userProfile = otherParticipant.user.user_profiles;
    
    if (!userProfile) {
      return 'Unknown User';
    }
    
    return userProfile.name || 'Unknown User';
  }

  useEffect(() => {
    const formatted = dmChannels.map(channel => ({
      id: channel.id,
      participants: channel.participants.map(p => ({
        user_id: p.user_id,
        user: {
          id: p.user.id,
          email: p.user.email,
          user_profiles: p.user.user_profiles
        }
      }))
    })).filter(channel => channel.participants.length > 0);

    setFormattedDMChannels(formatted);
  }, [dmChannels, user?.id]);

  const createChannel = async () => {
    if (!newChannelName.trim() || !user) return;
    
    try {
      // First create the channel
      const { data: channel, error: channelError } = await supabase
        .from('channels')
        .insert([
          {
            name: newChannelName.trim(),
            team_id: teamId,
            is_private: isPrivateChannel,
            created_by: user.id
          }
        ])
        .select()
        .single();

      if (channelError) throw channelError;

      // If it's a private channel, add the creator as a member
      if (isPrivateChannel) {
        const { error: memberError } = await supabase
          .from('channel_members')
          .insert([
            {
              channel_id: channel.id,
              user_id: user.id
            }
          ]);

        if (memberError) throw memberError;
      }

      setChannels(prev => [...prev, channel]);
      setNewChannelName('');
      setIsPrivateChannel(false);
      setIsChannelDialogOpen(false);
      onChannelSelect(channel.id, 'channel');
    } catch (error) {
      console.error('Error creating channel:', error);
      toast({
        title: "Error",
        description: "Could not create channel",
        variant: "destructive"
      });
    }
  };

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
              onClick={() => setIsChannelDialogOpen(true)}
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
          <h2 className="text-lg font-semibold mb-2">KIA</h2>
          <button
            onClick={() => onChannelSelect('ai', 'ai')}
            className={cn(
              "w-full flex items-center gap-x-2 px-2 py-1.5 text-sm rounded-md hover:bg-accent",
              activeChannelId === 'ai' && "bg-accent"
            )}
          >
            <Bot className="h-4 w-4" />
            <span>Know It All Bot</span>
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
              onClick={() => setIsDMDialogOpen(true)}
              className="h-5 w-5"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-[2px]">
            {formattedDMChannels.map(channel => (
              <button
                key={channel.id}
                onClick={() => onChannelSelect(channel.id, 'dm')}
                className={cn(
                  "w-full flex items-center gap-x-2 px-2 py-1.5 text-sm rounded-md hover:bg-accent",
                  activeChannelId === channel.id && "bg-accent"
                )}
              >
                <MessageSquare className="h-4 w-4" />
                <span>{getOtherParticipant(channel)}</span>
                {channel.participants.map(p => {
                  if (p.user_id === user?.id) return null;
                  const userProfile = p.user.user_profiles;
                  return (
                    <div 
                      key={p.user_id}
                      className={cn(
                        "w-2 h-2 rounded-full ml-auto",
                        userProfile?.status === 'online' && "bg-green-500",
                        userProfile?.status === 'away' && "bg-yellow-500",
                        userProfile?.status === 'busy' && "bg-red-500",
                        (!userProfile?.status || userProfile?.status === 'offline') && "bg-gray-500"
                      )}
                    />
                  );
                })}
              </button>
            ))}
          </div>
        </div>
      </ScrollArea>
      
      {/* New Channel Dialog */}
      <Dialog open={isChannelDialogOpen} onOpenChange={setIsChannelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a new channel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="channelName">Channel name</Label>
              <Input
                id="channelName"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="e.g. marketing"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="private"
                checked={isPrivateChannel}
                onCheckedChange={(checked) => setIsPrivateChannel(checked as boolean)}
              />
              <Label htmlFor="private">Make channel private</Label>
            </div>
            <Button 
              className="w-full" 
              onClick={createChannel}
              disabled={!newChannelName.trim()}
            >
              Create Channel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Direct Message Dialog */}
      <Dialog open={isDMDialogOpen} onOpenChange={setIsDMDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a conversation</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {teamMembers.map(member => {
              const userProfile = member.users.user_profiles;
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
                        setIsDMDialogOpen(false)
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
                  {userProfile?.name || 'Unknown User'}
              </Button>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

