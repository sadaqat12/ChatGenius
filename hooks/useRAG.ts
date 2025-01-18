import { useCallback, useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { User } from '@supabase/supabase-js';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatHistoryRecord {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface LastAction {
  type: 'send_message';
  payload: {
    recipient: string;
    message: string;
    time?: string;
  };
}

interface UseRAGOptions {
  teamId: string;
  similarityThreshold?: number;
}

export function useRAG({ teamId, similarityThreshold = 0.7 }: UseRAGOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [context, setContext] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastAction, setLastAction] = useState<LastAction | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isHistoryCleared, setIsHistoryCleared] = useState(false);
  const supabase = createClientComponentClient();

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
    };
    getUser();
  }, [supabase.auth]);

  // Load chat history when component mounts
  useEffect(() => {
    if (!user?.id || !teamId || isHistoryCleared) return;

    const loadChatHistory = async () => {
      try {
        const { data, error } = await supabase
          .rpc('get_user_chat_history', {
            p_user_id: user.id,
            p_team_id: teamId,
            p_limit: 50
          });

        if (error) throw error;

        // Convert and reverse the messages to show oldest first
        const historicalMessages = (data as ChatHistoryRecord[])
          .map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content
          }))
          .reverse();

        setMessages(historicalMessages);
      } catch (err) {
        console.error('Error loading chat history:', err);
        setError(err as Error);
      }
    };

    loadChatHistory();
  }, [user?.id, teamId, isHistoryCleared]);

  const persistMessage = async (message: Message) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('ai_chat_history')
        .insert({
          user_id: user.id,
          team_id: teamId,
          role: message.role,
          content: message.content
        });

      if (error) throw error;
    } catch (err) {
      console.error('Error persisting message:', err);
      // Don't set error state here to avoid disrupting the chat flow
    }
  };

  const askQuestion = useCallback(async (question: string) => {
    if (!user?.id) return;

    setIsLoading(true);
    setError(null);
    setIsHistoryCleared(false); // Reset the cleared state when asking a new question

    try {
      // Add user message to state and persist
      const userMessage = { role: 'user' as const, content: question };
      setMessages(prev => [...prev, userMessage]);
      await persistMessage(userMessage);

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question,
          teamId,
          conversationHistory: messages
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response from AI');
      }

      const data = await response.json();

      // Add AI response to state and persist
      const assistantMessage = { role: 'assistant' as const, content: data.answer };
      setMessages(prev => [...prev, assistantMessage]);
      await persistMessage(assistantMessage);

      setContext(data.context);
      setLastAction(data.action || null);
    } catch (err) {
      setError(err as Error);
      console.error('Error in askQuestion:', err);
    } finally {
      setIsLoading(false);
    }
  }, [messages, teamId, user?.id]);

  const clearConversation = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('ai_chat_history')
        .delete()
        .match({ user_id: user.id, team_id: teamId });

      if (error) throw error;

      setMessages([]);
      setContext(null);
      setLastAction(null);
      setIsHistoryCleared(true);
    } catch (err) {
      console.error('Error clearing conversation:', err);
      throw err;
    }
  }, [user?.id, teamId]);

  return {
    messages,
    context,
    isLoading,
    error,
    askQuestion,
    clearConversation,
    lastAction
  };
} 