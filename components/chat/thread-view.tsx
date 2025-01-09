import React from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { Messages } from './messages';
import { ChatInput } from './chat-input';
import { Message } from '@/types';

interface ThreadViewProps {
  parentMessage: Message;
  onClose: () => void;
}

export const ThreadView = ({ parentMessage, onClose }: ThreadViewProps) => {
  // Validate that this is actually a parent message
  if (parentMessage.threadId || parentMessage.parentId) {
    console.error('Invalid parent message provided to ThreadView');
    return null;
  }

  return (
    <div className="w-[320px] border-l flex flex-col bg-red-100">
      <div className="p-4 border-b flex justify-between items-center bg-red-200">
        <h3 className="font-semibold">Thread</h3>
        <Button variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <Messages 
        channelId={parentMessage.channelId} 
        threadId={parentMessage.id}
        isThreadView={true}
      />
      <ChatInput 
        channelId={parentMessage.channelId}
        threadId={parentMessage.id}
      />
    </div>
  );
}; 