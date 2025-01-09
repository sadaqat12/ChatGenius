import { useState, useEffect } from 'react';
import { Message } from '@/types/message';

export const useMessages = (channelId: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/channels/${channelId}/messages`);
        const data = await response.json();
        setMessages(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch messages'));
        setMessages([]); // Ensure messages is always an array
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, [channelId]);

  return messages; // Return just the messages array for now
}; 