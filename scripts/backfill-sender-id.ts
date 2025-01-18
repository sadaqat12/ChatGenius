const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.local' });

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function backfillSenderIds() {
  console.log('Starting to backfill sender_ids...');
  
  // Get message embeddings without sender_id
  const { data: embeddings, error: embeddingsError } = await supabase
    .from('message_embeddings')
    .select('message_id')
    .is('sender_id', null);

  if (embeddingsError) {
    console.error('Error fetching embeddings:', embeddingsError);
    process.exit(1);
  }

  if (!embeddings || embeddings.length === 0) {
    console.log('No embeddings need backfilling');
    process.exit(0);
  }

  console.log(`Found ${embeddings.length} embeddings to backfill`);

  // Process in batches to avoid overwhelming the database
  const batchSize = 100;
  for (let i = 0; i < embeddings.length; i += batchSize) {
    const batch = embeddings.slice(i, i + batchSize);
    const messageIds = batch.map((e: { message_id: string }) => e.message_id);

    // Get the corresponding messages with their user_ids
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('id, user_id')
      .in('id', messageIds);

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      continue;
    }

    if (!messages || messages.length === 0) {
      console.log(`No messages found for batch ${i}`);
      continue;
    }

    // Update each embedding with its sender_id (using user_id from messages)
    for (const message of messages) {
      const { error: updateError } = await supabase
        .from('message_embeddings')
        .update({ sender_id: message.user_id })
        .eq('message_id', message.id);

      if (updateError) {
        console.error(`Error updating embedding for message ${message.id}:`, updateError);
      } else {
        console.log(`Updated embedding for message ${message.id}`);
      }

      // Add a small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log(`Processed batch ${i} to ${i + batch.length}`);
  }

  console.log('Finished backfilling sender_ids');
}

// Run the script
backfillSenderIds().catch(console.error); 