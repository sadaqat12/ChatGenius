import os
import json
from datetime import datetime
from typing import List, Dict
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env.local'))

# Initialize Supabase client
supabase: Client = create_client(
    os.getenv('NEXT_PUBLIC_SUPABASE_URL', ''),
    os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')
)

def fetch_all_messages() -> List[Dict]:
    """Fetch all messages from both channels and DMs"""
    # Fetch channel messages
    channel_messages = supabase.table('messages').select(
        'id, content, channel_id, user_id, parent_id, created_at, channels(name, team_id, teams(name))'
    ).execute()
    
    # Fetch DM messages
    dm_messages = supabase.table('direct_messages').select(
        'id, content, channel_id, sender_id, created_at'
    ).execute()
    
    return channel_messages.data + dm_messages.data

def process_messages(messages: List[Dict]) -> List[str]:
    """Process messages into a format suitable for RAG"""
    processed_messages = []
    
    for msg in messages:
        # Skip messages without content
        if not msg.get('content'):
            continue
        
        # Process channel messages
        if 'channels' in msg:
            context = f"Team: {msg['channels']['teams']['name']}, Channel: {msg['channels']['name']}"
            processed_text = f"Context: {context}\nMessage: {msg['content']}"
        # Process DM messages
        else:
            processed_text = f"Context: Direct Message\nMessage: {msg['content']}"
        
        processed_messages.append(processed_text)
    
    return processed_messages

def save_for_rag(processed_messages: List[str]) -> None:
    """Save processed messages for RAG training"""
    output_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'rag', 'data')
    os.makedirs(output_dir, exist_ok=True)
    
    output_file = os.path.join(output_dir, 'processed_messages.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({
            'messages': processed_messages,
            'metadata': {
                'created_at': datetime.now().isoformat(),
                'count': len(processed_messages)
            }
        }, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Saved {len(processed_messages)} processed messages to {output_file}")

def main():
    """Main function to prepare data for RAG"""
    print("🔄 Starting RAG data preparation...")
    
    print("Fetching messages...")
    messages = fetch_all_messages()
    
    print("Processing messages...")
    processed_messages = process_messages(messages)
    
    print("Saving processed messages...")
    save_for_rag(processed_messages)
    
    print("✅ RAG data preparation completed!")

if __name__ == "__main__":
    main() 