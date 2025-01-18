require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

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

async function createAIBotUser() {
  try {
    // Create the user in auth.users
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: 'ai-assistant@chatgenius.ai',
      password: crypto.randomUUID(), // Random password since the bot won't log in normally
      email_confirm: true
    });

    if (authError) throw authError;
    if (!authUser.user) throw new Error('Failed to create auth user');

    // Create the user profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        user_id: authUser.user.id,
        name: 'AI Assistant',
        avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=AI',
        status: 'online'
      });

    if (profileError) throw profileError;

    // Update the .env.local file with the bot's user ID
    console.log('AI Bot created successfully!');
    console.log('Please update your .env.local file with:');
    console.log(`AI_BOT_USER_ID=${authUser.user.id}`);

  } catch (error) {
    console.error('Error creating AI bot user:', error);
    process.exit(1);
  }
}

createAIBotUser(); 