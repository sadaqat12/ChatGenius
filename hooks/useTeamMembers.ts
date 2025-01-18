'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';

interface TeamMember {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  role: 'owner' | 'admin' | 'member';
  status?: string;
}

type DatabaseTeamMember = {
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  users: {
    id: string;
    email: string;
    user_profiles: Array<{
      name: string;
      avatar_url: string | null;
      status: string | null;
    }>;
  };
};

interface UseTeamMembersProps {
  teamId?: string;
}

export function useTeamMembers(props?: UseTeamMembersProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const teamId = props?.teamId;

  useEffect(() => {
    if (user && teamId) {
      fetchMembers();

      // Subscribe to changes
      const channel = supabase
        .channel('team-members')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'team_members',
            filter: `team_id=eq.${teamId}`
          },
          () => {
            fetchMembers();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, teamId]);

  const fetchMembers = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('team_members')
        .select(`
          user_id,
          role,
          users:user_id (
            id,
            email,
            user_profiles!inner (
              name,
              avatar_url,
              status
            )
          )
        `)
        .eq('team_id', teamId);

      if (error) throw error;

      const dbMembers = data as unknown as DatabaseTeamMember[];
      const members = dbMembers.map(member => ({
        id: member.users.id,
        email: member.users.email,
        name: member.users.user_profiles[0].name,
        avatar_url: member.users.user_profiles[0].avatar_url || undefined,
        role: member.role,
        status: member.users.user_profiles[0].status || undefined
      }));

      setMembers(members);
    } catch (err) {
      console.error('Error fetching team members:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch team members'));
    } finally {
      setIsLoading(false);
    }
  };

  const inviteMember = async (email: string, role: 'admin' | 'member' = 'member') => {
    if (!user || !teamId) return null;

    try {
      const { error } = await supabase
        .from('team_invites')
        .insert({
          team_id: teamId,
          email,
          status: 'pending'
        });

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error inviting team member:', err);
      return false;
    }
  };

  const updateMemberRole = async (memberId: string, role: 'admin' | 'member') => {
    if (!user || !teamId) return false;

    try {
      const { error } = await supabase
        .from('team_members')
        .update({ role })
        .eq('team_id', teamId)
        .eq('user_id', memberId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error updating member role:', err);
      return false;
    }
  };

  const removeMember = async (memberId: string) => {
    if (!user || !teamId) return false;

    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId)
        .eq('user_id', memberId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error removing team member:', err);
      return false;
    }
  };

  return {
    members,
    isLoading,
    error,
    inviteMember,
    updateMemberRole,
    removeMember,
    refreshMembers: fetchMembers
  };
} 