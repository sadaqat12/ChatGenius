import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface EventCoordination {
  id: string;
  messageId: string;
  channelId: string;
  status: 'collecting_responses' | 'analyzing' | 'completed';
  createdBy: string;
  expectedResponses?: number;
  responseTimeout?: Date;
}

interface CoordinationPayload {
  id: string;
  message_id: string;
  channel_id: string;
  status: 'collecting_responses' | 'analyzing' | 'completed';
  created_by: string;
  expected_responses?: number;
  response_timeout?: Date;
}

interface TimeSlot {
  day: string;
  time: string;
  count: number;
}

export function useEventCoordination(channelId: string) {
  const { user } = useAuth();
  const [activeCoordinations, setActiveCoordinations] = useState<EventCoordination[]>([]);

  // Add a ref to track ongoing analysis
  const analysisInProgress = useRef<Set<string>>(new Set());

  // Fetch initial state
  useEffect(() => {
    async function fetchCoordinations() {
      console.log('Fetching coordinations for channel:', channelId);
      const { data, error } = await supabase
        .from('event_coordination_threads')
        .select('*')
        .eq('channel_id', channelId)
        .eq('status', 'collecting_responses');

      if (error) {
        console.error('Error fetching coordinations:', error);
        return;
      }

      console.log('Raw coordination data:', data);

      // Transform the data to match our interface
      const transformedData = (data || []).map((item: CoordinationPayload) => ({
        id: item.id,
        messageId: item.message_id,
        channelId: item.channel_id,
        status: item.status,
        createdBy: item.created_by,
        expectedResponses: item.expected_responses,
        responseTimeout: item.response_timeout ? new Date(item.response_timeout) : undefined
      }));

      console.log('Transformed coordination data:', transformedData);
      setActiveCoordinations(transformedData);
    }

    fetchCoordinations();
  }, [channelId]);

  // Subscribe to message responses
  useEffect(() => {
    if (!user) return;

    // Subscribe to new messages that are responses to coordination threads
    const channel = supabase
      .channel(`coordination:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`
        },
        async (payload) => {
          console.log('New message received:', payload.new);
          
          // Check if this message is a response to any active coordination
          const message = payload.new as any;
          if (!message.parent_id) return;

          // Get the parent message to check if it's a coordination message
          const { data: parentMessage } = await supabase
            .from('messages')
            .select('extension')
            .eq('id', message.parent_id)
            .single();

          console.log('Parent message:', parentMessage);

          if (!parentMessage?.extension?.isEventCoordination) {
            console.log('Not a response to a coordination message');
            return;
          }

          // Get the coordination thread
          const { data: coordination } = await supabase
            .from('event_coordination_threads')
            .select('*')
            .eq('message_id', message.parent_id)
            .eq('status', 'collecting_responses')
            .single();

          console.log('Found coordination:', coordination);

          if (!coordination) {
            console.log('No active coordination found for this message');
            return;
          }

          // Get all responses for this thread
          const { data: responses } = await supabase
            .from('messages')
            .select('content, user_id')
            .eq('channel_id', channelId)
            .eq('parent_id', message.parent_id);

          console.log('Found responses:', responses);

          if (!responses) return;

          // Check if we have enough unique responses
          const uniqueResponders = new Set(responses.map(r => r.user_id));
          console.log('Unique responders:', uniqueResponders.size);
          
          const hasEnoughResponses = coordination.expected_responses 
            ? uniqueResponders.size >= coordination.expected_responses
            : uniqueResponders.size >= 2;

          console.log('Has enough responses:', hasEnoughResponses);

          // Check if we've hit the timeout
          const hasTimedOut = coordination.response_timeout 
            ? new Date() >= new Date(coordination.response_timeout)
            : false;

          console.log('Has timed out:', hasTimedOut);

          // If we have enough responses or hit the timeout, analyze them
          if (hasEnoughResponses || hasTimedOut) {
            console.log('Analyzing responses...');
            await analyzeResponses(coordination.id, responses);
          } else {
            console.log('Not enough responses yet and timeout not reached');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, user]);

  // Subscribe to coordination status changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`coordination-status:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_coordination_threads',
          filter: `channel_id=eq.${channelId}`
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const newItem = payload.new as CoordinationPayload;
            setActiveCoordinations(prev =>
              prev.map(coord =>
                coord.id === newItem.id
                  ? {
                      id: newItem.id,
                      messageId: newItem.message_id,
                      channelId: newItem.channel_id,
                      status: newItem.status,
                      createdBy: newItem.created_by
                    }
                  : coord
              )
            );
          } else if (payload.eventType === 'INSERT') {
            const newItem = payload.new as CoordinationPayload;
            setActiveCoordinations(prev => [...prev, {
              id: newItem.id,
              messageId: newItem.message_id,
              channelId: newItem.channel_id,
              status: newItem.status,
              createdBy: newItem.created_by
            }]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, user]);

  // Check active coordinations periodically
  useEffect(() => {
    if (!user || activeCoordinations.length === 0) return;

    async function checkActiveCoordinations() {
      console.log('Checking active coordinations:', activeCoordinations);
      
      for (const coordination of activeCoordinations) {
        // Skip if analysis is in progress
        if (analysisInProgress.current.has(coordination.id)) {
          console.log('Analysis in progress for coordination:', coordination.id);
          continue;
        }

        // Verify the coordination is still active
        const { data: currentStatus } = await supabase
          .from('event_coordination_threads')
          .select('status')
          .eq('id', coordination.id)
          .single();

        if (!currentStatus || currentStatus.status !== 'collecting_responses') {
          console.log('Coordination no longer active:', coordination.id);
          continue;
        }

        // Get all responses for this thread
        const { data: responses } = await supabase
          .from('messages')
          .select('content, user_id')
          .eq('channel_id', channelId)
          .eq('parent_id', coordination.messageId);

        if (!responses || responses.length === 0) {
          console.log('No responses found for coordination:', coordination.id);
          continue;
        }

        // Check if we have enough unique responses
        const uniqueResponders = new Set(responses.map(r => r.user_id));
        console.log('Unique responders:', uniqueResponders.size);
        
        const hasEnoughResponses = coordination.expectedResponses 
          ? uniqueResponders.size >= coordination.expectedResponses
          : uniqueResponders.size >= 2;

        console.log('Has enough responses:', hasEnoughResponses);

        // Check if we've hit the timeout
        const hasTimedOut = coordination.responseTimeout 
          ? new Date() >= coordination.responseTimeout
          : false;

        console.log('Has timed out:', hasTimedOut);

        // If we have enough responses or hit the timeout, analyze them
        if (hasEnoughResponses || hasTimedOut) {
          console.log('Analyzing responses for coordination:', coordination.id);
          await analyzeResponses(coordination.id, responses);
        } else {
          console.log('Not enough responses yet and timeout not reached');
        }
      }
    }

    // Check every 30 seconds
    const interval = setInterval(checkActiveCoordinations, 30000);

    // Initial check
    console.log('Running initial coordination check');
    checkActiveCoordinations();

    return () => clearInterval(interval);
  }, [channelId, user, activeCoordinations]);

  async function analyzeResponses(coordinationId: string, responses: any[]) {
    // Check if analysis is already in progress for this coordination
    if (analysisInProgress.current.has(coordinationId)) {
      console.log('Analysis already in progress for coordination:', coordinationId);
      return;
    }

    try {
      analysisInProgress.current.add(coordinationId);

      // First check if this coordination is still active
      const { data: coordination, error: coordError } = await supabase
        .from('event_coordination_threads')
        .select('message_id, channel_id, status')
        .eq('id', coordinationId)
        .single();

      if (coordError || !coordination) {
        console.error('Error getting coordination thread:', coordError);
        return;
      }

      // If already analyzing or completed, skip
      if (coordination.status !== 'collecting_responses') {
        console.log('Coordination already being analyzed or completed:', coordination.status);
        return;
      }

      console.log('Updating status to analyzing for coordination:', coordinationId);
      
      // First verify current status
      const { data: currentStatus, error: statusError } = await supabase
        .from('event_coordination_threads')
        .select('status')
        .eq('id', coordinationId)
        .single();

      if (statusError) {
        console.error('Error checking current status:', statusError);
        return;
      }

      if (currentStatus.status !== 'collecting_responses') {
        console.log('Coordination not in collecting_responses state:', currentStatus.status);
        return;
      }

      // Update status to analyzing
      const { error: updateError } = await supabase
        .from('event_coordination_threads')
        .update({ 
          status: 'analyzing',
          updated_at: new Date().toISOString()
        })
        .eq('id', coordinationId);

      if (updateError) {
        console.error('Error updating coordination status to analyzing:', updateError);
        return;
      }

      // Verify the update
      const { data: verifyStatus, error: verifyError } = await supabase
        .from('event_coordination_threads')
        .select('status')
        .eq('id', coordinationId)
        .single();

      if (verifyError || !verifyStatus || verifyStatus.status !== 'analyzing') {
        console.error('Failed to verify analyzing status:', verifyStatus?.status);
        return;
      }

      console.log('Successfully set analyzing state:', verifyStatus);

      // Get the original coordination message
      const { data: originalMessage } = await supabase
        .from('messages')
        .select('content')
        .eq('id', coordination.message_id)
        .single();

      // Extract availability information and log responses
      const availabilities = responses.map(r => r.content);
      console.log('Analyzing availabilities:', availabilities);

      // Get the team ID from the channel
      const { data: channel } = await supabase
        .from('channels')
        .select('team_id')
        .eq('id', channelId)
        .single();

      if (!channel) {
        console.error('Channel not found');
        await revertToCollectingResponses(coordinationId);
        return;
      }

      const response = await fetch('/api/analyze-availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          originalMessage: originalMessage?.content,
          responses: availabilities,
          teamId: channel.team_id
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze responses');
      }

      const { bestTime } = await response.json();
      console.log('AI analysis:', bestTime);

      // Only send follow-up if we found a valid time
      if (bestTime === "Could not determine a common time from the responses") {
        console.log('No common time found in responses:', availabilities);
        await revertToCollectingResponses(coordinationId);
        return;
      }

      // Send follow-up message with the suggested time
      const message = `📅 Based on everyone's responses, the best time for the event appears to be ${bestTime}.\n\nPlease react with 👍 if this works for you, or 👎 if you need an alternative time.`;

      // First send the message
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          channel_id: coordination.channel_id,
          content: message,
          user_id: user?.id,
          parent_id: coordination.message_id,
          topic: 'Event Coordination',
          extension: {
            isEventCoordination: true,
            coordinationId: coordinationId,
            status: 'completed'
          }
        });

      if (messageError) {
        console.error('Error sending follow-up message:', messageError);
        await revertToCollectingResponses(coordinationId);
        return;
      }

      console.log('Follow-up message sent successfully, updating status to completed');

      // When updating to completed, use the same pattern
      const { error: finalUpdateError } = await supabase
        .from('event_coordination_threads')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', coordinationId)
        .eq('status', 'analyzing');

      if (finalUpdateError) {
        console.error('Error updating coordination status to completed:', finalUpdateError);
        await revertToCollectingResponses(coordinationId);
        return;
      }

      // Verify the completed status
      const { data: verifyCompleted, error: verifyCompletedError } = await supabase
        .from('event_coordination_threads')
        .select('status')
        .eq('id', coordinationId)
        .single();

      if (verifyCompletedError || !verifyCompleted || verifyCompleted.status !== 'completed') {
        console.error('Failed to verify completed status:', verifyCompleted?.status);
        await revertToCollectingResponses(coordinationId);
        return;
      }

      console.log('Status successfully updated to completed:', verifyCompleted);

      // Remove from active coordinations
      setActiveCoordinations(prev => prev.filter(coord => coord.id !== coordinationId));

    } catch (error) {
      console.error('Error analyzing responses:', error);
      await revertToCollectingResponses(coordinationId);
    } finally {
      analysisInProgress.current.delete(coordinationId);
    }
  }

  // Helper function to revert status
  async function revertToCollectingResponses(coordinationId: string) {
    console.log('Reverting status to collecting_responses for coordination:', coordinationId);
    const { error } = await supabase
      .from('event_coordination_threads')
      .update({ 
        status: 'collecting_responses',
        updated_at: new Date().toISOString()
      })
      .eq('id', coordinationId);
    
    if (error) {
      console.error('Error reverting coordination status:', error);
    }
  }

  // Improved time slot finder
  function findBestTime(availabilities: string[]): string {
    // Initialize map to store time slot frequencies
    const timeSlots: Map<string, TimeSlot> = new Map();

    // Process each availability response
    availabilities.forEach(response => {
      try {
        console.log('Parsing response:', response);
        
        // Extract time slots using more flexible regex
        // Matches patterns like:
        // - "I'm available Monday at 2pm"
        // - "Tuesday 3:00 PM works"
        // - "I can do Wed 14:00"
        // - "Monday 2"
        // - "any time Monday"
        const matches = response.toLowerCase().matchAll(/\b(monday|tuesday|wednesday|thursday|friday|mon|tue|wed|thu|fri)\b.*?(?:\b(\d{1,2}(?::\d{2})?(?:\s*[ap]m)?|\d{2}:\d{2})\b|(?:\b(?:any ?time|all ?day)\b))/gi);
        
        let foundMatch = false;
        for (const match of matches) {
          foundMatch = true;
          const [fullMatch, day, time] = match;
          console.log('Found match:', { fullMatch, day, time });
          
          // Normalize day names
          const dayMap: { [key: string]: string } = {
            'mon': 'Monday',
            'tue': 'Tuesday',
            'wed': 'Wednesday',
            'thu': 'Thursday',
            'fri': 'Friday'
          };
          
          const normalizedDay = dayMap[day.toLowerCase()] || 
                              day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
          
          // Handle "any time" or "all day"
          if (!time || fullMatch.toLowerCase().includes('any time') || fullMatch.toLowerCase().includes('all day')) {
            // Add multiple time slots for "any time"
            ['9:00 AM', '12:00 PM', '2:00 PM', '4:00 PM'].forEach(defaultTime => {
              const key = `${normalizedDay} ${defaultTime}`;
              const existing = timeSlots.get(key);
              if (existing) {
                existing.count++;
              } else {
                timeSlots.set(key, {
                  day: normalizedDay,
                  time: defaultTime,
                  count: 1
                });
              }
            });
            continue;
          }
          
          // Normalize time to 12-hour format
          let normalizedTime = time;
          if (time.includes(':')) {
            // Handle 24-hour format
            const [hours, minutes] = time.split(':');
            const hour = parseInt(hours);
            if (hour > 12) {
              normalizedTime = `${hour - 12}:${minutes} PM`;
            } else if (hour === 12) {
              normalizedTime = `12:${minutes} PM`;
            } else if (hour === 0) {
              normalizedTime = `12:${minutes} AM`;
            } else {
              normalizedTime = `${hour}:${minutes} ${hour >= 8 && hour <= 11 ? 'AM' : 'PM'}`;
            }
          } else {
            // Handle simple hour format
            const hour = parseInt(time);
            if (!time.toLowerCase().includes('pm') && !time.toLowerCase().includes('am')) {
              normalizedTime = `${hour}:00 ${hour >= 8 && hour <= 11 ? 'AM' : 'PM'}`;
            }
          }

          const key = `${normalizedDay} ${normalizedTime}`;
          console.log('Adding time slot:', key);
          const existing = timeSlots.get(key);
          if (existing) {
            existing.count++;
          } else {
            timeSlots.set(key, {
              day: normalizedDay,
              time: normalizedTime,
              count: 1
            });
          }
        }
        
        if (!foundMatch) {
          console.log('No time slots found in response:', response);
        }
      } catch (error) {
        console.error('Error parsing availability:', error);
      }
    });

    // Log all found time slots
    console.log('All time slots found:', Array.from(timeSlots.entries()));

    // Find the time slot with the highest count
    let bestSlot: TimeSlot | null = null;
    let maxCount = 0;

    timeSlots.forEach(slot => {
      if (slot.count > maxCount) {
        maxCount = slot.count;
        bestSlot = slot;
      }
    });

    if (!bestSlot) {
      return "Could not determine a common time from the responses";
    }

    const { day, time } = bestSlot as TimeSlot;
    return `${day} at ${time}`;
  }

  return {
    activeCoordinations
  };
} 