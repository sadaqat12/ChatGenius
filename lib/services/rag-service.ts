import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/database.types';
import { messageEmbeddingService } from './message-embedding-service';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Initialize service role client for bot operations
const serviceClient = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface SimilarMessage {
  id: string;
  content: string;
  similarity: number;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ActionIntent {
  type: 'send_message' | 'create_channel' | 'send_channel_message';
  payload: {
    recipient?: string;
    message?: string;
    time?: string;
    channel_name?: string;
    channel_description?: string;
    is_private?: boolean;
    channel_id?: string;
    thread_id?: string;
    expect_responses?: boolean;
  };
}

interface RAGResponse {
  answer: string;
  context: {
    messages: SimilarMessage[];
  };
  action?: ActionIntent;
}

export interface RAGService {
  query(params: {
    question: string;
    teamId: string;
    userId: string;
    maxTokens?: number;
    similarityThreshold?: number;
    conversationHistory?: ConversationMessage[];
  }): Promise<RAGResponse>;
}

export class OpenAIRAGService implements RAGService {
  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text.replace(/\n/g, ' '),
    });

    return response.data[0].embedding;
  }

  private async findSimilarMessages(params: {
    embedding: number[];
    teamId: string;
    similarityThreshold?: number;
    maxResults?: number;
  }): Promise<SimilarMessage[]> {
    const {
      embedding,
      teamId,
      similarityThreshold = 0.7,
      maxResults = 5
    } = params;

    const { data: messages, error } = await supabase.rpc(
      'find_similar_messages',
      {
        query_embedding: embedding,
        team_id_filter: teamId,
        similarity_threshold: similarityThreshold,
        max_results: maxResults
      }
    );

    if (error) throw error;
    return messages || [];
  }

  private async findUserByName(name: string): Promise<{ id: string; email: string } | null> {
    const { data: profile, error } = await serviceClient
      .from('user_profiles')
      .select('user_id')
      .ilike('name', `%${name}%`)
      .limit(1)
      .single();

    if (error || !profile) return null;

    // Get the user's email from auth.users
    const { data: user, error: userError } = await serviceClient
      .from('users')
      .select('email')
      .eq('id', profile.user_id)
      .single();

    if (userError || !user) return null;
    
    return {
      id: profile.user_id,
      email: user.email
    };
  }

  private async getUserName(userId: string): Promise<string | null> {
    try {
      const { data: profile, error } = await serviceClient
        .from('user_profiles')
        .select('name')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error getting user name:', error);
        return null;
      }

      return profile?.name || null;
    } catch (error) {
      console.error('Error in getUserName:', error);
      return null;
    }
  }

  private async createDirectMessage(params: {
    senderId: string;
    recipientId: string;
    content: string;
  }): Promise<void> {
    const { senderId, recipientId, content } = params;

    try {
      // First, find an existing DM channel where both users are participants
      const { data: channels, error: findError } = await serviceClient
        .from('direct_message_participants')
        .select('channel_id')
        .eq('user_id', senderId);

      if (findError) {
        console.error('Error finding channels:', findError);
        throw new Error('Failed to find DM channels');
      }

      let channelId: string | null = null;

      if (channels && channels.length > 0) {
        // Check which of these channels also has the recipient
        const { data: sharedChannel, error: sharedError } = await serviceClient
          .from('direct_message_participants')
          .select('channel_id')
          .eq('user_id', recipientId)
          .in('channel_id', channels.map(c => c.channel_id))
          .limit(1)
          .single();

        if (!sharedError && sharedChannel) {
          channelId = sharedChannel.channel_id;
        }
      }

      if (!channelId) {
        // Create a new DM channel
        const { data: newChannel, error: channelError } = await serviceClient
          .from('direct_message_channels')
          .insert({})
          .select('id')
          .single();

        if (channelError) {
          console.error('Error creating DM channel:', channelError);
          throw new Error('Failed to create DM channel');
        }
        if (!newChannel) throw new Error('No channel ID returned');
        
        channelId = newChannel.id;

        // Add both users as participants
        const { error: participantsError } = await serviceClient
          .from('direct_message_participants')
          .insert([
            { channel_id: channelId, user_id: senderId },
            { channel_id: channelId, user_id: recipientId }
          ]);

        if (participantsError) {
          console.error('Error adding participants:', participantsError);
          throw new Error('Failed to add participants to DM channel');
        }
      }

      // Send the message
      const { error: messageError } = await serviceClient
        .from('direct_messages')
        .insert({
          channel_id: channelId,
          sender_id: senderId,
          content: content
        });

      if (messageError) {
        console.error('Error sending message:', messageError);
        throw new Error('Failed to send message');
      }
    } catch (error) {
      console.error('Direct message error:', error);
      throw error;
    }
  }

  private async createChannel(params: {
    teamId: string;
    userId: string;
    name: string;
    description?: string;
    isPrivate?: boolean;
  }): Promise<string | null> {
    try {
      const normalizedName = params.name.toLowerCase().replace(/\s+/g, '-');

      // Check if channel already exists in this team
      const { data: existingChannel, error: existingError } = await serviceClient
        .from('channels')
        .select('id')
        .eq('team_id', params.teamId)
        .eq('name', normalizedName)
        .single();

      if (existingError && existingError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        throw existingError;
      }

      if (existingChannel) {
        throw new Error(`Channel #${normalizedName} already exists`);
      }

      // Create the channel
      const { data: channel, error: channelError } = await serviceClient
        .from('channels')
        .insert({
          name: normalizedName,
          team_id: params.teamId,
          is_private: params.isPrivate || false,
          created_by: params.userId,
          description: params.description
        })
        .select()
        .single();

      if (channelError) throw channelError;
      if (!channel) throw new Error('No channel returned after creation');

      // If it's a private channel, add the creator as a member
      if (params.isPrivate) {
        const { error: memberError } = await serviceClient
          .from('channel_members')
          .insert({
            channel_id: channel.id,
            user_id: params.userId
          });

        if (memberError) throw memberError;
      }

      return channel.id;
    } catch (err) {
      console.error('Error creating channel:', err);
      if (err instanceof Error && err.message.includes('already exists')) {
        throw err; // Re-throw the "already exists" error to handle it differently
      }
      return null;
    }
  }

  private async generateAnswer(params: {
    question: string;
    context: string;
    conversationHistory?: ConversationMessage[];
  }): Promise<{ answer: string; action?: ActionIntent }> {
    const { question, context, conversationHistory = [] } = params;

    // Filter out any messages with null content
    const validHistory = conversationHistory.filter(msg => msg && msg.content && msg.role);

    const messages = [
      {
        role: 'system' as const,
        content: `You are a helpful AI assistant that answers questions based on the provided context. 
        You can perform actions like sending messages to team members and creating channels.
        
        When a user asks you to send a message to someone:
        1. Extract the recipient's name (partial names like "Sarah" for "Sarah Chen" are supported)
        2. Extract the message content
        3. Extract any time/scheduling information
        4. Format your response as JSON with:
           {
             "answer": "I'll send your message to [recipient]",
             "action": {
               "type": "send_message",
               "payload": {
                 "recipient": "[recipient name - can be partial]",
                 "message": "[Message via KIA] [message content]",
                 "time": "[optional time info]"
               }
             }
           }

        When a user asks you to create a channel:
        1. Extract the channel name
        2. Extract any description provided
        3. Determine if it should be private
        4. Format your response as JSON with:
           {
             "answer": "I'll create a [private/public] channel called #[name]",
             "action": {
               "type": "create_channel",
               "payload": {
                 "channel_name": "[name]",
                 "channel_description": "[description]",
                 "is_private": [true/false]
               }
             }
           }

        When a user asks you to coordinate a team event or meeting:
        1. Extract the event details (what, when)
        2. If a specific channel is mentioned, use that channel name in the payload
        3. If no channel is specified, omit the channel_id field (it will default to #general)
        4. Format your response as JSON with:
           {
             "answer": "I'll help coordinate [event type]. I'll send a message in [channel name or '#general'] to collect everyone's availability.",
             "action": {
               "type": "send_channel_message",
               "payload": {
                 "channel_id": "[optional - only if specific channel mentioned]",
                 "message": "🗓️ Team Event Coordination\n\n[event details]\n\nPlease reply to this thread with your availability for [time frame]. I'll analyze the responses and suggest the best time that works for everyone.",
                 "expect_responses": true
               }
             }
           }
        
        Always format messages as "[Message via KIA] [content]" where {user} is the name of the person asking you to send the message.
        This helps recipients know who originally sent the message.
        
        Always ground your answers in the context provided. If the context doesn't contain enough 
        information to answer the question confidently, acknowledge that and suggest what additional 
        information might be needed.
        
        When referring to previous conversation, maintain consistency with your earlier responses.
        
        Remember to ALWAYS format your response as a JSON object with an "answer" field, and optionally an "action" field for message sending or channel creation.
        Note: For finding users, you can use partial names - the system will match them to full names.`
      },
      ...validHistory,
      {
        role: 'user' as const,
        content: `Context from team messages:
        ${context}
        
        Question: ${question}`
      }
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages,
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No response from OpenAI');

    try {
      const result = JSON.parse(content);
      return {
        answer: result.answer,
        action: result.action
      };
    } catch (e) {
      return {
        answer: content
      };
    }
  }

  private async sendChannelMessage(params: {
    channelId: string;
    content: string;
    userId: string;
    parentId?: string;
  }): Promise<string> {
    const { channelId, content, userId, parentId } = params;

    try {
      const { data, error: messageError } = await serviceClient
        .from('messages')
        .insert({
          channel_id: channelId,
          user_id: userId,
          content: content,
          parent_id: parentId,
          topic: 'event_coordination',
          extension: {}
        })
        .select('id')
        .single();

      if (messageError) {
        console.error('Error sending channel message:', messageError);
        throw new Error('Failed to send channel message');
      }

      return data?.id;
    } catch (error) {
      console.error('Channel message error:', error);
      throw error;
    }
  }

  private async analyzeAvailabilityResponses(channelId: string, threadId: string): Promise<string[]> {
    try {
      // Get all responses in the thread
      const { data: responses, error } = await serviceClient
        .from('messages')
        .select('content')
        .eq('channel_id', channelId)
        .eq('parent_id', threadId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!responses) return [];

      // Extract availability information from responses
      // This is a simple implementation - in reality, you'd want to use NLP to parse the responses
      const availabilities: string[] = responses.map(r => r.content);
      
      return availabilities;
    } catch (error) {
      console.error('Error analyzing responses:', error);
      throw error;
    }
  }

  private async sendFollowUpMessage(params: {
    channelId: string;
    threadId: string;
    userId: string;
    availabilities: string[];
  }): Promise<void> {
    const { channelId, threadId, userId, availabilities } = params;

    try {
      // Simple algorithm to find common availability
      // In reality, you'd want to use a more sophisticated algorithm
      const suggestedTime = "Based on the responses, the best time appears to be...";

      const followUpMessage = `📅 Thank you everyone for sharing your availability!\n\n${suggestedTime}\n\nPlease confirm if this time works for you by reacting with 👍 or 👎.`;

      await this.sendChannelMessage({
        channelId,
        content: followUpMessage,
        userId,
        parentId: threadId
      });
    } catch (error) {
      console.error('Error sending follow-up:', error);
      throw error;
    }
  }

  private async findChannelByName(teamId: string, channelName: string): Promise<string | null> {
    try {
      const { data: channel, error } = await serviceClient
        .from('channels')
        .select('id')
        .eq('team_id', teamId)
        .ilike('name', channelName.toLowerCase())
        .single();

      if (error) {
        console.error('Error finding channel:', error);
        return null;
      }

      return channel?.id || null;
    } catch (error) {
      console.error('Error in findChannelByName:', error);
      return null;
    }
  }

  async query(params: {
    question: string;
    teamId: string;
    userId: string;
    maxTokens?: number;
    similarityThreshold?: number;
    conversationHistory?: ConversationMessage[];
  }): Promise<RAGResponse> {
    try {
      // Get sender's name first
      const senderName = await this.getUserName(params.userId);
      if (!senderName) {
        throw new Error('Could not find sender name');
      }

      // Generate embedding for the question
      const embedding = await this.generateEmbedding(params.question);

      // Find similar messages
      const similarMessages = await this.findSimilarMessages({
        embedding,
        teamId: params.teamId,
        similarityThreshold: params.similarityThreshold
      });

      // Build context from similar messages
      const context = similarMessages
        .map(msg => `Message: ${msg.content}`)
        .join('\n\n');

      // Generate answer using OpenAI
      const { answer, action } = await this.generateAnswer({
        question: `[Sender: ${senderName}] ${params.question}`,
        context,
        conversationHistory: params.conversationHistory
      });

      // Handle actions based on type
      if (action?.type === 'send_message') {
        const recipient = await this.findUserByName(action.payload.recipient!);
        if (!recipient) {
          return {
            answer: `I couldn't find a user named "${action.payload.recipient}". Please try again with a different name.`,
            context: { messages: similarMessages }
          };
        }

        // Format the message with sender's name
        const messageWithSender = action.payload.message!.replace('{user}', senderName);

        // Send the direct message
        await this.createDirectMessage({
          senderId: params.userId,
          recipientId: recipient.id,
          content: messageWithSender
        });
      } else if (action?.type === 'create_channel') {
        try {
          const channelId = await this.createChannel({
            teamId: params.teamId,
            userId: params.userId,
            name: action.payload.channel_name!,
            description: action.payload.channel_description,
            isPrivate: action.payload.is_private
          });

          if (!channelId) {
            return {
              answer: `I couldn't create the channel "${action.payload.channel_name}". Please try again with a different name.`,
              context: { messages: similarMessages }
            };
          }
        } catch (err) {
          if (err instanceof Error && err.message.includes('already exists')) {
            return {
              answer: err.message + ". Would you like me to do something else?",
              context: { messages: similarMessages }
            };
          }
          throw err;
        }
      } else if (action?.type === 'send_channel_message') {
        // Get channel ID if one was provided
        let targetChannelId: string | undefined = action.payload.channel_id;
        
        if (targetChannelId) {
          // If a channel was specified, verify it exists
          if (!targetChannelId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            // If not a UUID, treat it as a channel name
            const foundChannelId = await this.findChannelByName(params.teamId, targetChannelId);
            if (!foundChannelId) {
              return {
                answer: `I couldn't find the channel "${targetChannelId}". Would you like me to try in #general instead?`,
                context: { messages: similarMessages }
              };
            }
            targetChannelId = foundChannelId;
          }
        } else {
          // Default to general channel if none specified
          const generalChannelId = await this.findChannelByName(params.teamId, 'general');
          if (!generalChannelId) {
            return {
              answer: "I couldn't find the #general channel. This is unusual - please contact your workspace administrator.",
              context: { messages: similarMessages }
            };
          }
          targetChannelId = generalChannelId;
        }

        const messageId = await this.sendChannelMessage({
          channelId: targetChannelId,
          content: action.payload.message!,
          userId: params.userId
        });

        if (action.payload.expect_responses) {
          // Get channel member count for expected responses
          const { count: memberCount } = await serviceClient
            .from('channel_members')
            .select('*', { count: 'exact', head: true })
            .eq('channel_id', targetChannelId);

          // For public channels, count all team members
          const { count: teamMemberCount } = await serviceClient
            .from('team_members')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', params.teamId);

          const expectedResponses = memberCount || teamMemberCount || 2; // Default to 2 if counts fail
          
          // Set timeout to 24 hours from now
          const responseTimeout = new Date();
          responseTimeout.setHours(responseTimeout.getHours() + 24);

          // Store the thread ID for later analysis
          await serviceClient
            .from('event_coordination_threads')
            .insert({
              message_id: messageId,
              channel_id: targetChannelId,
              status: 'collecting_responses',
              created_by: params.userId,
              expected_responses: expectedResponses,
              response_timeout: responseTimeout.toISOString()
            });
        }
      }

      return {
        answer,
        context: { messages: similarMessages },
        action: action ? {
          ...action,
          payload: {
            ...action.payload,
            message: action.payload.message?.replace('{user}', senderName)
          }
        } : undefined
      };
    } catch (error) {
      console.error('RAG query error:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const ragService = new OpenAIRAGService(); 