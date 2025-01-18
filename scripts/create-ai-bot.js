require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
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

async function updateAIBotUser() {
  try {
    const botUserId = process.env.AI_BOT_USER_ID;
    if (!botUserId) {
      throw new Error('AI_BOT_USER_ID not found in .env.local');
    }

    // Update the user profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({
        name: 'KIA Assistant',
        avatar_url: '/kia-avatar.svg',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', botUserId);

    if (profileError) throw profileError;

    console.log('KIA Assistant profile updated successfully!');

  } catch (error) {
    console.error('Error updating KIA bot user:', error);
    process.exit(1);
  }
}

updateAIBotUser(); 