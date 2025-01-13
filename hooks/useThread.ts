import { useState, useCallback } from 'react';
import type { Message } from '@/types/chat';

interface ThreadState {
  isOpen: boolean;
  message?: Message;
}

export function useThread() {
  const [state, setState] = useState<ThreadState>({
    isOpen: false,
    message: undefined
  });

  const openThread = useCallback((message: Message) => {
    if (!message.parentId) {
      setState({
        isOpen: true,
        message
      });
    }
  }, []);

  const closeThread = useCallback(() => {
    setState({
      isOpen: false,
      message: undefined
    });
  }, []);

  return {
    ...state,
    openThread,
    closeThread
  };
} 