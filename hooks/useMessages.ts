import { useState, useEffect } from 'react';
import { Message, MessageService } from '@/types/message';
import { MockMessageService } from '@/lib/services/mock-message-service';

interface UseMessagesOptions {
  channelId: string;
  parentId?: string | null;
}

interface UseMessagesReturn {
  messages: Message[];
  isLoading: boolean;
  error: Error | null;
  sendMessage: (content: string, file?: File) => Promise<void>;
  addReaction: (messageId: string, emoji: string) => Promise<void>;
  removeReaction: (messageId: string, emoji: string) => Promise<void>;
}

// In the future, this will be injected from a provider or configuration
const messageService: MessageService = new MockMessageService();

export function useMessages({ channelId, parentId }: UseMessagesOptions): UseMessagesReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const fetchedMessages = await messageService.getMessages(channelId);
        setMessages(fetchedMessages);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch messages'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, [channelId]);

  const sendMessage = async (content: string, file?: File) => {
    try {
      let fileData;
      if (file) {
        // In the mock service, we'll use URL.createObjectURL
        // In Supabase service, this will upload to Supabase Storage and return the URL
        if (messageService instanceof MockMessageService) {
          fileData = {
            name: file.name,
            type: file.type,
            url: URL.createObjectURL(file)
          };
        } else {
          // For Supabase, the service will handle the file upload
          fileData = {
            name: file.name,
            type: file.type,
            url: '' // The service will set this after upload
          };
        }
      }

      const newMessage = await messageService.createMessage({
        content,
        userId: '1',  // TODO: Get from auth
        channelId,
        parentId: parentId || null,
        user: {
          id: '1',
          name: 'You',  // TODO: Get from auth
          avatar: undefined
        },
        reactions: [],
        ...(fileData && { file: fileData })
      });

      setMessages(prev => [...prev, newMessage]);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to send message'));
      throw err;
    }
  };

  const addReaction = async (messageId: string, emoji: string) => {
    try {
      await messageService.addReaction(messageId, emoji, '1');  // TODO: Get userId from auth
      setMessages(prev => 
        prev.map(msg => {
          if (msg.id === messageId) {
            return {
              ...msg,
              reactions: [
                ...msg.reactions,
                {
                  id: String(Date.now()),
                  emoji,
                  userId: '1'
                }
              ]
            };
          }
          return msg;
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to add reaction'));
      throw err;
    }
  };

  const removeReaction = async (messageId: string, emoji: string) => {
    try {
      await messageService.removeReaction(messageId, emoji, '1');  // TODO: Get userId from auth
      setMessages(prev => 
        prev.map(msg => {
          if (msg.id === messageId) {
            return {
              ...msg,
              reactions: msg.reactions.filter(r => !(r.emoji === emoji && r.userId === '1'))
            };
          }
          return msg;
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to remove reaction'));
      throw err;
    }
  };

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    addReaction,
    removeReaction
  };
} 