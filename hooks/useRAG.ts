import { useState, useCallback } from 'react';
import { ConversationMessage } from '@/lib/services/rag-service';

interface UseRAGOptions {
  teamId: string;
  maxTokens?: number;
  similarityThreshold?: number;
}

interface UseRAGReturn {
  isLoading: boolean;
  error: Error | null;
  messages: ConversationMessage[];
  askQuestion: (question: string) => Promise<void>;
  clearConversation: () => void;
  context: {
    messages: Array<{
      id: string;
      content: string;
      similarity: number;
    }>;
  } | null;
  lastAction: {
    type: 'send_message';
    payload: {
      recipient: string;
      message: string;
      time?: string;
    };
  } | null;
}

export function useRAG({ teamId, maxTokens, similarityThreshold }: UseRAGOptions): UseRAGReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [currentContext, setCurrentContext] = useState<UseRAGReturn['context']>(null);
  const [lastAction, setLastAction] = useState<UseRAGReturn['lastAction']>(null);

  const askQuestion = useCallback(async (question: string) => {
    setIsLoading(true);
    setError(null);
    setLastAction(null);

    try {
      // Create user's question message
      const userMessage: ConversationMessage = {
        role: 'user',
        content: question
      };

      // Create updated conversation history including the new message
      const updatedHistory = [...messages, userMessage];
      
      // Update messages state
      setMessages(updatedHistory);

      // Make API request with the updated history
      const response = await fetch('/api/rag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          teamId,
          maxTokens,
          similarityThreshold,
          conversationHistory: updatedHistory
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get answer');
      }

      const result = await response.json();

      // Add assistant's response to conversation
      const assistantMessage: ConversationMessage = {
        role: 'assistant',
        content: result.answer
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Update context
      setCurrentContext(result.context);

      // Handle action if present
      if (result.action) {
        setLastAction(result.action);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('An error occurred'));
    } finally {
      setIsLoading(false);
    }
  }, [teamId, maxTokens, similarityThreshold, messages]);

  const clearConversation = useCallback(() => {
    setMessages([]);
    setCurrentContext(null);
    setError(null);
    setLastAction(null);
  }, []);

  return {
    isLoading,
    error,
    messages,
    askQuestion,
    clearConversation,
    context: currentContext,
    lastAction
  };
} 