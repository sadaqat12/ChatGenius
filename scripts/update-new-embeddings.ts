import { createClient } from '@supabase/supabase-js';
import { OpenAIMessageEmbeddingService } from '@/lib/services/message-embedding-service';
import dotenv from 'dotenv';
import { Database } from '@/lib/database.types';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function processNewMessages() {
  console.log('Starting to process new messages...');
  
  // Get messages that don't have embeddings yet
  const { data: messages, error } = await supabase
    .from('messages')
    .select('id, content, team_id')
    .not('id', 'in', (
      supabase
        .from('message_embeddings')
        .select('message_id')
    ))
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching messages:', error);
    process.exit(1);
  }

  if (!messages || messages.length === 0) {
    console.log('No new messages to process');
    process.exit(0);
  }

  console.log(`Found ${messages.length} messages to process`);

  const messageEmbeddingService = new OpenAIMessageEmbeddingService();

  // Process messages in batches to avoid rate limits
  for (const message of messages) {
    try {
      await messageEmbeddingService.processMessage({
        id: message.id,
        content: message.content,
        team_id: message.team_id
      });
      console.log(`Processed message ${message.id}`);
    } catch (error) {
      console.error(`Error processing message ${message.id}:`, error);
    }
    
    // Add a small delay between messages to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('Finished processing new messages');
}

// Run the script
processNewMessages().catch(console.error); 