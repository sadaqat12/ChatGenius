interface ChatInputProps {
  channelId: string;
  parentId?: string | null;  // ID of the message being replied to
}

export const ChatInput = ({ channelId, parentId }: ChatInputProps) => {
  const handleSend = async (content: string) => {
    await createMessage({
      content,
      channelId,
      parentId: parentId || null,
    });
  };

  return (
    // Your input UI
  );
}; 