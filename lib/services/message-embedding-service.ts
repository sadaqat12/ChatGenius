import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { Database } from '@/lib/database.types';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not set in environment variables');
}

// Initialize OpenAI with explicit API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase with service role key and RLS bypass
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Using service role key for admin access
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    }
  }
);

// Add this line to bypass RLS for the service role
supabase.auth.setSession({
  access_token: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  refresh_token: ''
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
      const { error } = await supabase
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
    // Process in batches of 10 to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      await Promise.all(batch.map(msg => this.processMessage(msg)));
    }
  }

  async deleteMessageEmbedding(messageId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('message_embeddings')
        .delete()
        .eq('message_id', messageId);

      if (error) {
        console.error('Error deleting embedding:', error);
        throw new Error('Failed to delete embedding');
      }
    } catch (error) {
      console.error('Error deleting message embedding:', error);
      throw error;
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