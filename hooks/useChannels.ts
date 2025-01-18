'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';

interface Channel {
  id: string;
  name: string;
  description: string | null;
  is_private: boolean;
  created_at: string;
  team_id: string;
}

interface UseChannelsProps {
  teamId?: string;
}

export function useChannels(props?: UseChannelsProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const teamId = props?.teamId;

  useEffect(() => {
    if (user && teamId) {
      fetchChannels();

      // Subscribe to changes
      const channel = supabase
        .channel('channels')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'channels',
            filter: `team_id=eq.${teamId}`
          },
          () => {
            fetchChannels();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, teamId]);

  const fetchChannels = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: channels, error } = await supabase
        .from('channels')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setChannels(channels || []);
    } catch (err) {
      console.error('Error fetching channels:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch channels'));
    } finally {
      setIsLoading(false);
    }
  };

  const createChannel = async (params: {
    name: string;
    description?: string;
    is_private?: boolean;
  }) => {
    if (!user || !teamId) return null;

    try {
      const { data: channel, error } = await supabase
        .from('channels')
        .insert({
          name: params.name,
          description: params.description,
          is_private: params.is_private || false,
          team_id: teamId,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;

      // Add creator as channel member
      const { error: memberError } = await supabase
        .from('channel_members')
        .insert({
          channel_id: channel.id,
          user_id: user.id
        });

      if (memberError) throw memberError;

      return channel;
    } catch (err) {
      console.error('Error creating channel:', err);
      return null;
    }
  };

  return {
    channels,
    isLoading,
    error,
    createChannel,
    refreshChannels: fetchChannels
  };
} 