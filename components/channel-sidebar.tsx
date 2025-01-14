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
}

interface User {
  id: string;
  email: string;
  user_profiles: {
    name: string | null;
  };
}

interface TeamMemberResponse {
  user_id: string;
  role: string;
  users: User;
}

interface DirectMessageUser {
  id: string;
  email: string;
  user_profiles: {
    name: string | null;
  };
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
  const [memberButtons, setMemberButtons] = useState<Array<{ label: string; onClick: () => void }>>([])
  const { user } = useAuth()
  const router = useRouter()
  const { channels: dmChannels, createChannel: createDMChannel } = useDirectMessages()
  const { toast } = useToast()

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

  const createDirectMessage = async (otherUserId: string) => {
    if (!user?.id) return;

    try {
      // First check if user exists in auth.users
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('id', otherUserId)
        .single();

      if (userError || !userData) {
        toast({
          title: 'Error',
          description: 'Selected user is not available for direct messaging',
          variant: 'destructive'
        });
        return;
      }

      // Check if DM channel already exists between these users
      const { data: existingChannels, error: channelError } = await supabase
        .from('direct_message_participants')
        .select(`
          channel_id,
          channel:direct_message_channels!inner (
            id,
            participants:direct_message_participants!inner (
              user_id
            )
          )
        `)
        .eq('user_id', user.id);

      if (channelError) {
        console.error('Error checking existing channels:', channelError);
        toast({
          title: 'Error',
          description: 'Failed to check existing channels',
          variant: 'destructive'
        });
        return;
      }

      // Find a channel where both users are participants
      const existingChannel = existingChannels?.find(channel => {
        const participantIds = channel.channel.participants.map(p => p.user_id);
        return participantIds.includes(otherUserId);
      });

      if (existingChannel) {
        onChannelSelect(existingChannel.channel.id, 'dm');
        setIsDialogOpen(false);
        return;
      }

      // Create new DM channel
      const { data: newChannel, error: createError } = await supabase
        .from('direct_message_channels')
        .insert({})
        .select()
        .single();

      if (createError || !newChannel) {
        console.error('Error creating channel:', createError);
        toast({
          title: 'Error',
          description: 'Failed to create direct message channel',
          variant: 'destructive'
        });
        return;
      }

      // Add participants
      const { error: participantsError } = await supabase
        .from('direct_message_participants')
        .insert([
          { channel_id: newChannel.id, user_id: user.id },
          { channel_id: newChannel.id, user_id: otherUserId }
        ]);

      if (participantsError) {
        console.error('Error adding participants:', participantsError);
        toast({
          title: 'Error',
          description: 'Failed to add participants to channel',
          variant: 'destructive'
        });
        return;
      }

      onChannelSelect(newChannel.id, 'dm');
      setIsDialogOpen(false);

    } catch (error) {
      console.error('Error in createDirectMessage:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive'
      });
    }
  };

  const startDirectMessage = async () => {
    if (!user?.id) return;

    console.log('Fetching team members for team:', teamId);
    
    // First get all team members
    const { data: teamMembers, error } = await supabase
      .from('team_members')
      .select(`
        user_id,
        role,
        users:users!team_members_user_id_fkey (
          id,
          email,
          user_profiles!inner (
            name
          )
        )
      `)
      .eq('team_id', teamId)
      .neq('user_id', user?.id);

    console.log('Team members response:', teamMembers);
    
    if (error) {
      console.error('Error fetching team members:', error);
      toast({
        title: 'Error',
        description: 'Failed to load team members',
        variant: 'destructive'
      });
      return;
    }

    if (!teamMembers || teamMembers.length === 0) {
      toast({
        title: 'No team members found',
        description: 'No team members found to message'
      });
      return;
    }

    // Filter out members that don't exist in auth.users
    const validMembers = (teamMembers as unknown as RawTeamMember[]).filter(
      member => member && member.users && typeof member.users.id === 'string'
    );

    if (validMembers.length === 0) {
      toast({
        title: 'No valid members found',
        description: 'No team members are available for direct messaging'
      });
      return;
    }

    const buttons = validMembers.map((member) => ({
      label: member.users.user_profiles?.name || member.users.email || 'Unknown User',
      onClick: () => createDirectMessage(member.user_id),
    }));

    setMemberButtons(buttons);
    setIsDialogOpen(true);
  };

  const getOtherParticipant = (channel: typeof dmChannels[0]) => {
    const otherParticipant = channel.participants.find(p => p.user_id !== user?.id);
    
    if (!otherParticipant?.user) return 'Unknown User';
    
    const profileName = otherParticipant.user.user_profiles?.name;
    
    return profileName || otherParticipant.user.email || 'Unknown User';
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
            AI Assistant
          </h2>
          <div className="space-y-1">
            <Button
              variant="ghost"
              className="w-full justify-start text-white hover:bg-gray-700"
              onClick={() => onChannelSelect('ai-assistant', 'ai')}
            >
              <Bot className="mr-2 h-4 w-4" />
              Chat with AI
            </Button>
          </div>
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
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Team Member</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {memberButtons.map((button, index) => (
              <Button
                key={index}
                variant="outline"
                className="w-full justify-start"
                onClick={button.onClick}
              >
                {button.label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

