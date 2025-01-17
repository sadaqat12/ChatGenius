import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { Database } from '@/lib/database.types';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not set in environment variables');
}

// Initialize OpenAI with explicit API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface MessageEmbeddingService {
  processMessage(message: {
    id: string;
    content: string;
    team_id: string;
    metadata?: Record<string, any>;
  }): Promise<void>;
  processMessages(messages: Array<{
    id: string;
    content: string;
    team_id: string;
    metadata?: Record<string, any>;
  }>): Promise<void>;
  deleteMessageEmbedding(messageId: string): Promise<void>;
}

export class OpenAIMessageEmbeddingService implements MessageEmbeddingService {
  private supabase: ReturnType<typeof createClient<Database>>;

  constructor() {
    // Initialize Supabase with service role key
    this.supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text.replace(/\n/g, ' '),
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  async processMessage(message: {
    id: string;
    content: string;
    team_id: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      // Generate embedding
      const embedding = await this.generateEmbedding(message.content);

      // Store in database
      const { error } = await this.supabase
        .from('message_embeddings')
        .upsert({
          message_id: message.id,
          team_id: message.team_id,
          content: message.content,
          embedding,
          metadata: message.metadata || {},
        });

      if (error) {
        console.error('Error storing embedding:', error);
        throw new Error('Failed to store embedding');
      }
    } catch (error) {
      console.error('Error processing message:', error);
      throw error;
    }
  }

  async processMessages(messages: Array<{
    id: string;
    content: string;
    team_id: string;
    metadata?: Record<string, any>;
  }>): Promise<void> {
    for (const message of messages) {
      await this.processMessage(message);
    }
  }

  async deleteMessageEmbedding(messageId: string): Promise<void> {
    const { error } = await this.supabase
      .from('message_embeddings')
      .delete()
      .eq('message_id', messageId);

    if (error) {
      console.error('Error deleting embedding:', error);
      throw new Error('Failed to delete embedding');
    }
  }
}

// Create a background worker to process message embeddings
export class MessageEmbeddingWorker {
  private embeddingService: MessageEmbeddingService;
  private isProcessing: boolean = false;
  private processInterval: number = 5000; // 5 seconds

  constructor(embeddingService: MessageEmbeddingService) {
    this.embeddingService = embeddingService;
  }

  async start() {
    // Process messages periodically
    setInterval(async () => {
      if (this.isProcessing) return;
      
      try {
        this.isProcessing = true;
        await this.processNewMessages();
      } catch (error) {
        console.error('Error in message processing worker:', error);
      } finally {
        this.isProcessing = false;
      }
    }, this.processInterval);
  }

  private async processNewMessages() {
    // Get messages that don't have embeddings yet
    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, content, team_id')
      .not('id', 'in', (
        supabase
          .from('message_embeddings')
          .select('message_id')
      ));

    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }

    if (messages && messages.length > 0) {
      await this.embeddingService.processMessages(messages);
    }
  }
}

// Export singleton instances
export const messageEmbeddingService = new OpenAIMessageEmbeddingService();
export const messageEmbeddingWorker = new MessageEmbeddingWorker(messageEmbeddingService); 