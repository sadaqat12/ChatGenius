import { useState, useEffect } from 'react';
import { useMessages } from './useMessages';
import { teamData } from '@/lib/mock-data';

interface SearchResult {
  type: 'channel' | 'directMessage';
  id: number;
  name: string;
  threadId?: number;
  messagePreview?: string;
  fileName?: string;
}

interface Channel {
  id: number;
  name: string;
}

interface DirectMessage {
  id: number;
  name: string;
}

interface TeamData {
  channels: Channel[];
  directMessages: DirectMessage[];
}

interface UseSearchProps {
  activeTeam: number;
  channelId: string;
}

export function useSearch({ activeTeam, channelId }: UseSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const { messages } = useMessages({ channelId });

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSearchResults([]);
      return;
    }

    const currentTeamData = teamData[activeTeam] as TeamData;
    const results: SearchResult[] = [];

    // Search channels
    currentTeamData.channels.forEach((channel) => {
      if (channel.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        results.push({ type: 'channel', id: channel.id, name: channel.name });
      }
    });

    // Search messages
    messages.forEach((message) => {
      if (message.content.toLowerCase().includes(searchQuery.toLowerCase())) {
        const channel = currentTeamData.channels.find(c => c.id === Number(message.channelId));
        if (channel) {
          results.push({
            type: 'channel',
            id: channel.id,
            name: channel.name,
            threadId: message.parentId ? Number(message.parentId) : undefined,
            messagePreview: message.content
          });
        }
      }
      if (message.file && message.file.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        const channel = currentTeamData.channels.find(c => c.id === Number(message.channelId));
        if (channel) {
          results.push({
            type: 'channel',
            id: channel.id,
            name: channel.name,
            threadId: message.parentId ? Number(message.parentId) : undefined,
            fileName: message.file.name
          });
        }
      }
    });

    // Search direct messages
    currentTeamData.directMessages.forEach((dm) => {
      if (dm.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        results.push({ type: 'directMessage', id: dm.id, name: dm.name });
      }
    });

    setSearchResults(results);
  }, [searchQuery, messages, activeTeam]);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults
  };
} 