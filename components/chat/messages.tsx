import React from 'react';
import { useMessages } from '@/hooks/useMessages';
import { MessageItem } from './message-item';
import { Message } from '@/types';

interface MessagesProps {
  channelId: string;
  threadId?: string | null;
  isThreadView: boolean;
}

export const Messages = ({ channelId, threadId, isThreadView }: MessagesProps) => {
  const messages = useMessages(channelId);
  
  const filteredMessages = React.useMemo(() => {
    if (!messages?.length) return [];
    
    if (isThreadView && threadId) {
      // In thread view, show:
      // 1. The parent message (message with id === threadId)
      // 2. All replies to this message (messages with parentId === threadId)
      return messages
        .filter(msg => 
          msg.id === threadId || // The parent message
          msg.parentId === threadId // Direct replies
        )
        .sort((a, b) => {
          // Parent message always first
          if (a.id === threadId) return -1;
          if (b.id === threadId) return 1;
          // Sort replies by date
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });
    }
    
    // In main channel view, only show messages that aren't replies
    return messages
      .filter(msg => msg.parentId === null)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [messages, threadId, isThreadView]);

  return (
    <div className="flex-1 flex flex-col py-4 overflow-y-auto">
      {filteredMessages.map((message) => (
        <MessageItem 
          key={message.id} 
          message={message}
          isThreadView={isThreadView}
        />
      ))}
    </div>
  );
}; 