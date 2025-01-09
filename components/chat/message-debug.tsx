import { Message } from '@/types';

interface MessageDebugProps {
  message: Message;
}

export const MessageDebug = ({ message }: MessageDebugProps) => {
  if (process.env.NODE_ENV === 'production') return null;

  return (
    <div className="text-xs text-gray-400 mt-1">
      ID: {message.id.slice(0, 6)}...
      {message.threadId && ` | Thread: ${message.threadId.slice(0, 6)}...`}
    </div>
  );
}; 