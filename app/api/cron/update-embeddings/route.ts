import { createClient } from '@supabase/supabase-js';
import { OpenAIMessageEmbeddingService } from '@/lib/services/message-embedding-service';
import { Database } from '@/lib/database.types';

// Vercel specific header to protect the route
export const runtime = 'edge';
export const preferredRegion = 'iad1';

async function processNewMessages() {
  // Initialize Supabase client
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
    return new Response('Error fetching messages', { status: 500 });
  }

  if (!messages || messages.length === 0) {
    console.log('No new messages to process');
    return new Response('No new messages to process', { status: 200 });
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
  return new Response('Successfully processed new messages', { status: 200 });
}

export async function GET(request: Request) {
  // Verify the request is coming from Vercel Cron
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  return processNewMessages();
} 