import { Message, MessageService } from '@/types/message';
import { messages as initialMockMessages } from '@/lib/mock-data';

// These interfaces are just for handling mock data
interface MockMessage {
  id: number;
  user: string;
  content: string;
  timestamp: string;
  threadId?: number;
  parentId?: number;
  file?: {
    name: string;
    type: string;
    url: string;
  };
  reactions: Array<{
    emoji: string;
    users: string[];
  }>;
}

interface MockMessages {
  channels: {
    [key: number]: MockMessage[];
  };
  directMessages: {
    [key: number]: MockMessage[];
  };
}

export class MockMessageService implements MessageService {
  // Static property to maintain mock data state during the session
  private static mockData: MockMessages = JSON.parse(JSON.stringify(initialMockMessages));

  async getMessages(channelId: string): Promise<Message[]> {
    const channelMessages = MockMessageService.mockData.channels[Number(channelId)] || [];
    
    return channelMessages.map((msg: MockMessage) => ({
      id: String(msg.id),
      content: msg.content,
      createdAt: new Date(),
      userId: '1',
      channelId: String(channelId),
      parentId: msg.parentId ? String(msg.parentId) : null,
      user: {
        id: '1',
        name: msg.user,
        avatar: undefined
      },
      file: msg.file,
      reactions: msg.reactions.map((r, i) => ({
        id: String(i),
        emoji: r.emoji,
        userId: r.users[0]
      }))
    }));
  }

  async createMessage(message: Omit<Message, 'id' | 'createdAt'>): Promise<Message> {
    const newMockMessage: MockMessage = {
      id: Date.now(),
      user: message.user.name,
      content: message.content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      parentId: message.parentId ? Number(message.parentId) : undefined,
      file: message.file,
      reactions: []
    };

    if (!MockMessageService.mockData.channels[Number(message.channelId)]) {
      MockMessageService.mockData.channels[Number(message.channelId)] = [];
    }
    MockMessageService.mockData.channels[Number(message.channelId)].push(newMockMessage);

    return {
      ...message,
      id: String(newMockMessage.id),
      createdAt: new Date()
    };
  }

  async addReaction(messageId: string, emoji: string, userId: string): Promise<void> {
    // Find the message in all channels
    for (const channelMessages of Object.values(MockMessageService.mockData.channels)) {
      const message = channelMessages.find(m => String(m.id) === messageId);
      if (message) {
        const existingReaction = message.reactions.find(r => r.emoji === emoji);
        if (existingReaction) {
          existingReaction.users.push(userId);
        } else {
          message.reactions.push({ emoji, users: [userId] });
        }
        break;
      }
    }
  }

  async removeReaction(messageId: string, emoji: string, userId: string): Promise<void> {
    // Find the message in all channels
    for (const channelMessages of Object.values(MockMessageService.mockData.channels)) {
      const message = channelMessages.find(m => String(m.id) === messageId);
      if (message) {
        const reactionIndex = message.reactions.findIndex(r => r.emoji === emoji);
        if (reactionIndex !== -1) {
          message.reactions[reactionIndex].users = message.reactions[reactionIndex].users.filter(
            u => u !== userId
          );
          if (message.reactions[reactionIndex].users.length === 0) {
            message.reactions.splice(reactionIndex, 1);
          }
        }
        break;
      }
    }
  }
} 