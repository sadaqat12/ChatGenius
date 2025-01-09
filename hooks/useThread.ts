import { useState, useCallback } from 'react';
import { Message } from '@/types';

interface ThreadState {
  isOpen: boolean;
  parentMessage: Message | null;
}

export const useThread = () => {
  const [threadState, setThreadState] = useState<ThreadState>({
    isOpen: false,
    parentMessage: null,
  });

  const openThread = useCallback((message: Message) => {
    // Validate that we're opening a thread for a parent message
    if (message.threadId || message.parentId) {
      console.error('Attempted to open thread for a reply message');
      return;
    }
    
    setThreadState({
      isOpen: true,
      parentMessage: message,
    });
  }, []);

  const closeThread = useCallback(() => {
    setThreadState({
      isOpen: false,
      parentMessage: null,
    });
  }, []);

  return {
    threadState,
    openThread,
    closeThread,
  };
}; 