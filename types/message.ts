interface Message {
  id: string;
  content: string;
  createdAt: Date;
  userId: string;
  channelId: string;
  parentId: string | null;  // null for parent messages, message ID for replies
  replyCount?: number;      // Count of replies to this message
}

export type { Message }; 