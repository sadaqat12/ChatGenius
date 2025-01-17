import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/database.types';
import { messageEmbeddingService } from '@/lib/services/message-embedding-service';

// Verify required environment variables
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

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

interface Message {
  id: string;
  content: string;
  channel_id: string;
  channel: {
    team_id: string;
  };
}

type MessageWithChannel = {
  id: string;
  content: string;
  channel_id: string;
  channel: {
    team_id: string;
  };
};

async function backfillEmbeddings() {
  let processedCount = 0;
  let failedCount = 0;
  const batchSize = 50;
  let lastProcessedId: string | null = null;

  console.log('Starting embedding backfill...');

  while (true) {
    try {
      // First get existing message_ids from embeddings
      const { data: existingEmbeddings, error: embeddingsError } = await supabase
        .from('message_embeddings')
        .select('message_id');

      if (embeddingsError) {
        console.error('Error fetching existing embeddings:', embeddingsError);
        process.exit(1);
      }

      const existingMessageIds = existingEmbeddings?.map(e => e.message_id) || [];
      
      // Build the query
      let query = supabase
        .from('messages')
        .select(`
          id,
          content,
          channel_id,
          channel:channels!inner (
            team_id
          )
        `)
        .order('id')
        .limit(batchSize);

      // Add pagination if we have a last processed ID
      if (lastProcessedId) {
        query = query.gt('id', lastProcessedId);
      }

      const { data: messages, error } = await query as { 
        data: MessageWithChannel[] | null; 
        error: any 
      };

      if (error) {
        console.error('Error fetching messages:', error);
        process.exit(1);
      }

      // Filter out messages that already have embeddings
      const messagesToProcess = (messages || []).filter(
        msg => !existingMessageIds.includes(msg.id)
      );

      if (messagesToProcess.length === 0) {
        if (processedCount === 0) {
          console.log('No messages found to process');
        }
        break; // No more messages to process
      }

      // Process the batch
      console.log(`Processing batch of ${messagesToProcess.length} messages...`);
      
      for (const message of messagesToProcess) {
        try {
          await messageEmbeddingService.processMessage({
            id: message.id,
            content: message.content,
            team_id: message.channel.team_id,
            metadata: {
              backfilled: true,
              backfilled_at: new Date().toISOString(),
              channel_id: message.channel_id
            }
          });
          processedCount++;
          lastProcessedId = message.id;
          
          // Progress update every 10 messages
          if (processedCount % 10 === 0) {
            console.log(`Processed ${processedCount} messages (${failedCount} failed)`);
          }
        } catch (error) {
          console.error(`Failed to process message ${message.id}:`, error);
          failedCount++;
          lastProcessedId = message.id;
        }

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      }

    } catch (error) {
      console.error('Batch processing error:', error);
      process.exit(1);
    }
  }

  console.log('\nBackfill complete!');
  console.log(`Total processed: ${processedCount}`);
  console.log(`Failed: ${failedCount}`);
}

// Run the backfill
backfillEmbeddings().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 