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
}

export function useRAG({ teamId, maxTokens, similarityThreshold }: UseRAGOptions): UseRAGReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [currentContext, setCurrentContext] = useState<UseRAGReturn['context']>(null);

  const askQuestion = useCallback(async (question: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Add user's question to conversation
      const userMessage: ConversationMessage = {
        role: 'user',
        content: question
      };
      setMessages(prev => [...prev, userMessage]);

      // Make API request
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
          conversationHistory: messages
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
  }, []);

  return {
    isLoading,
    error,
    messages,
    askQuestion,
    clearConversation,
    context: currentContext
  };
} 