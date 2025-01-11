'use client'

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { Hash, Plus, Lock, MessageSquare } from "lucide-react"
import { useRouter } from "next/navigation"
import { supabase } from '@/lib/supabase'
import { Channel } from '@/types/chat'
import { useAuth } from '@/contexts/auth-context'
import { useDirectMessages } from '@/hooks/useDirectMessages'

interface ChannelSidebarProps {
  teamId: string
  activeChannelId?: string
  onChannelSelect: (channelId: string, type: 'channel' | 'dm') => void
}

export function ChannelSidebar({ teamId, activeChannelId, onChannelSelect }: ChannelSidebarProps) {
  const [channels, setChannels] = useState<Channel[]>([])
  const { user } = useAuth()
  const router = useRouter()
  const { channels: dmChannels, createChannel: createDMChannel } = useDirectMessages()

  useEffect(() => {
    if (teamId) {
      fetchChannels()
    }
  }, [teamId])

  const fetchChannels = async () => {
    try {
      // First get all public channels
      const { data: publicChannels, error: publicError } = await supabase
        .from('channels')
        .select('*')
        .eq('team_id', teamId)
        .eq('is_private', false);

      if (publicError) throw publicError;

      // Then get private channels where user is a member
      const { data: privateChannels, error: privateError } = await supabase
        .from('channels')
        .select('*, channel_members!inner(*)')
        .eq('team_id', teamId)
        .eq('is_private', true)
        .eq('channel_members.user_id', user?.id);

      if (privateError) throw privateError;

      // Combine and deduplicate channels
      const allChannels = [...(publicChannels || [])];
      privateChannels?.forEach(channel => {
        if (!allChannels.some(c => c.id === channel.id)) {
          allChannels.push(channel);
        }
      });

      setChannels(allChannels);
    } catch (error) {
      console.error('Error fetching channels:', error)
    }
  }

  const createChannel = async (name: string, isPrivate: boolean = false) => {
    try {
      const { data: channel, error } = await supabase
        .from('channels')
        .insert({
          name,
          team_id: teamId,
          is_private: isPrivate,
          created_by: user?.id
        })
        .select()
        .single()

      if (error) throw error

      // If private channel, add the creator as a member
      if (isPrivate && channel) {
        const { error: memberError } = await supabase
          .from('channel_members')
          .insert({
            channel_id: channel.id,
            user_id: user?.id,
            role: 'admin'
          })

        if (memberError) throw memberError
      }

      // Refresh channels list
      fetchChannels()
    } catch (error) {
      console.error('Error creating channel:', error)
    }
  }

  const startDirectMessage = async () => {
    try {
      // Fetch users in the team
      const { data: teamMembers, error } = await supabase
        .from('team_members')
        .select(`
          user_id,
          user:user_id(
            email,
            user_profiles(name)
          )
        `)
        .eq('team_id', teamId)
        .neq('user_id', user?.id)

      if (error) throw error

      interface TeamMember {
        user_id: string;
        user: [{
          email: string;
          user_profiles: Array<{
            name: string;
          }>;
        }];
      }

      // Transform the data to match our expected types
      const formattedMembers = (teamMembers as TeamMember[]).map(member => ({
        user_id: member.user_id,
        user: {
          email: member.user[0].email,
          user_profiles: member.user[0].user_profiles
        }
      }))

      // For now, just show a simple prompt. In a real app, this would be a proper UI dialog
      const userList = formattedMembers.map(member => 
        `${member.user.user_profiles[0]?.name || member.user.email} (${member.user_id})`
      ).join('\n')
      
      const selectedUserId = prompt(
        `Enter the user ID to start a conversation with:\n\n${userList}`
      )

      if (selectedUserId) {
        const channelId = await createDMChannel(selectedUserId)
        if (channelId) {
          onChannelSelect(channelId, 'dm')
        }
      }
    } catch (error) {
      console.error('Error starting direct message:', error)
    }
  }

  const getOtherParticipant = (channel: typeof dmChannels[0]) => {
    const otherParticipant = channel.participants.find(p => p.user_id !== user?.id)
    return otherParticipant?.user.user_profiles[0]?.name || otherParticipant?.user.email || 'Unknown User'
  }

  return (
    <div className="w-60 bg-gray-800 flex flex-col">
      <div className="p-3">
        <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight text-white">
          Channels
        </h2>
        <div className="space-y-1">
          <Button
            variant="ghost"
            className="w-full justify-start text-white hover:bg-gray-700"
            onClick={() => {
              // TODO: Open create channel dialog
              const name = prompt('Enter channel name:')
              if (name) createChannel(name)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Channel
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {channels.map((channel) => (
            <Button
              key={channel.id}
              variant="ghost"
              className={cn(
                "w-full justify-start font-normal text-white hover:bg-gray-700",
                channel.id === activeChannelId && "bg-gray-700"
              )}
              onClick={() => onChannelSelect(channel.id, 'channel')}
            >
              {channel.is_private ? (
                <Lock className="mr-2 h-4 w-4" />
              ) : (
                <Hash className="mr-2 h-4 w-4" />
              )}
              {channel.name}
            </Button>
          ))}
        </div>
        
        <Separator className="my-2 bg-gray-700" />
        
        <div className="p-3">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight text-white">
            Direct Messages
          </h2>
          <div className="space-y-1">
            <Button
              variant="ghost"
              className="w-full justify-start text-white hover:bg-gray-700"
              onClick={startDirectMessage}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Message
            </Button>
          </div>
        </div>
        
        <div className="space-y-1 p-2">
          {dmChannels.map((channel) => (
            <Button
              key={channel.id}
              variant="ghost"
              className={cn(
                "w-full justify-start font-normal text-white hover:bg-gray-700",
                channel.id === activeChannelId && "bg-gray-700"
              )}
              onClick={() => onChannelSelect(channel.id, 'dm')}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              {getOtherParticipant(channel)}
            </Button>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

