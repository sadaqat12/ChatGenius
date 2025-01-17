#!/usr/bin/env python3

import json
import os
import sys
from datetime import datetime, timezone
import uuid
from supabase import create_client, Client
from dotenv import load_dotenv

def load_env():
    # Load environment variables from .env.local
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env.local')
    if not os.path.exists(env_path):
        print("Error: .env.local file not found")
        sys.exit(1)
    load_dotenv(env_path)

def load_json_file(filename):
    with open(os.path.join('scripts/seed_data', filename)) as f:
        return json.load(f)

def get_or_create_user(supabase: Client, user_data):
    # First check if user already exists by email in user_profiles
    try:
        result = supabase.from_('user_profiles').select('user_id').eq('name', user_data['name']).execute()
        if result.data and len(result.data) > 0:
            print(f"User {user_data['name']} already exists, using existing ID")
            return result.data[0]['user_id']
        
        print(f"Creating new user {user_data['email']}")
        # If user doesn't exist, create new one
        auth_response = supabase.auth.admin.create_user({
            "email": user_data['email'],
            "password": "Password123!",
            "email_confirm": True,
            "user_metadata": {
                "name": user_data['name']
            }
        })
        user_id = auth_response.user.id
        
        # Create user profile
        profile_data = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "name": user_data['name'],
            "avatar_url": user_data['avatar_url'],
            "status": 'online'
        }
        supabase.table('user_profiles').insert(profile_data).execute()
        return user_id
    except Exception as e:
        print(f"Error with user {user_data['email']}: {e}")
        raise e

def get_or_create_team(supabase: Client, team_data, owner_id):
    # Check if team already exists
    try:
        result = supabase.from_('teams').select('id').eq('name', team_data['name']).execute()
        if result.data and len(result.data) > 0:
            print(f"Team {team_data['name']} already exists, using existing ID")
            return result.data[0]['id']
        
        print(f"Creating new team {team_data['name']}")
        team_id = str(uuid.uuid4())
        team_data = {
            "id": team_id,
            "name": team_data['name'],
            "description": team_data['description'],
            "created_by": owner_id
        }
        supabase.table('teams').insert(team_data).execute()
        return team_id
    except Exception as e:
        print(f"Error with team {team_data['name']}: {e}")
        raise e

def get_or_create_channel(supabase: Client, channel_data, team_id, created_by):
    # Check if channel already exists in this team
    try:
        result = supabase.from_('channels').select('id').eq('name', channel_data['name']).eq('team_id', team_id).execute()
        if result.data and len(result.data) > 0:
            print(f"Channel {channel_data['name']} already exists in team, using existing ID")
            return result.data[0]['id']
        
        print(f"Creating new channel {channel_data['name']}")
        channel_id = str(uuid.uuid4())
        channel_data = {
            "id": channel_id,
            "name": channel_data['name'],
            "description": channel_data['description'],
            "is_private": channel_data['is_private'],
            "team_id": team_id,
            "created_by": created_by
        }
        supabase.table('channels').insert(channel_data).execute()
        return channel_id
    except Exception as e:
        print(f"Error with channel {channel_data['name']}: {e}")
        raise e

def create_reaction(supabase: Client, message_id, user_id, emoji="👍"):
    try:
        # Check if reaction already exists
        result = supabase.from_('reactions').select('id').eq('message_id', message_id).eq('user_id', user_id).eq('emoji', emoji).execute()
        if result.data and len(result.data) > 0:
            print(f"Reaction already exists, skipping: {emoji}")
            return
        
        print(f"Adding reaction {emoji} to message")
        reaction_data = {
            "id": str(uuid.uuid4()),
            "message_id": message_id,
            "user_id": user_id,
            "emoji": emoji,
            "created_by": user_id,
            "message_type": "message"  # or "direct_message" if needed
        }
        supabase.table('reactions').insert(reaction_data).execute()
    except Exception as e:
        print(f"Error creating reaction: {e}")
        raise e

def clean_messages(supabase: Client):
    try:
        print("Cleaning existing messages and reactions...")
        # Delete all reactions first (due to foreign key constraints)
        supabase.table('reactions').delete().gte('created_at', '2000-01-01').execute()
        # Delete all messages
        supabase.table('messages').delete().gte('created_at', '2000-01-01').execute()
        print("Cleaned existing messages and reactions")
    except Exception as e:
        print(f"Error cleaning messages: {e}")
        raise e

def create_message(supabase: Client, message_data, channel_id, user_id, parent_id=None):
    try:
        message_id = str(uuid.uuid4())
        print(f"Creating new message: {message_data['content'][:50]}...")
        
        # Handle file attachment if present
        file_data = message_data.get('file')
        
        message_data = {
            "id": message_id,
            "channel_id": channel_id,
            "content": message_data['content'],
            "user_id": user_id,
            "parent_id": parent_id,
            "topic": 'general',
            "file": file_data,
            "extension": "txt",  # Default extension for text messages
            "event": None,  # Default event type
            "payload": None,  # Default payload
            "private": False  # Default privacy setting
        }
        
        # If there's a file, use its extension
        if file_data:
            file_name = file_data.get('name', '')
            message_data['extension'] = file_name.split('.')[-1] if '.' in file_name else 'txt'
        
        supabase.table('messages').insert(message_data).execute()
        
        # Add some random reactions to make the chat more lively
        if not parent_id:  # Only add reactions to main messages, not replies
            emojis = ["👍", "❤️", "🚀", "💡", "👏"]
            # Randomly choose 1-3 users to react with 1-2 emojis each
            import random
            reacting_users = random.sample(list(user_mapping.values()), random.randint(1, 3))
            for user_id in reacting_users:
                for emoji in random.sample(emojis, random.randint(1, 2)):
                    create_reaction(supabase, message_id, user_id, emoji)
        
        return message_id
    except Exception as e:
        print(f"Error creating message: {e}")
        raise e

def add_team_member(supabase: Client, team_id, user_id, role):
    try:
        # Check if member already exists
        result = supabase.from_('team_members').select('*').eq('team_id', team_id).eq('user_id', user_id).execute()
        if result.data and len(result.data) > 0:
            print(f"Team member already exists, skipping")
            return
        
        team_member_data = {
            "team_id": team_id,
            "user_id": user_id,
            "role": role
        }
        supabase.table('team_members').insert(team_member_data).execute()
    except Exception as e:
        print(f"Error adding team member: {e}")
        raise e

def add_channel_member(supabase: Client, channel_id, user_id):
    try:
        # Check if member already exists
        result = supabase.from_('channel_members').select('*').eq('channel_id', channel_id).eq('user_id', user_id).execute()
        if result.data and len(result.data) > 0:
            print(f"Channel member already exists, skipping")
            return
        
        channel_member_data = {
            "channel_id": channel_id,
            "user_id": user_id
        }
        supabase.table('channel_members').insert(channel_member_data).execute()
    except Exception as e:
        print(f"Error adding channel member: {e}")
        raise e

def create_direct_message_channel(supabase: Client, participants):
    try:
        # Sort participant IDs to ensure consistent channel lookup
        participant_ids = sorted([user_mapping[email] for email in participants])
        
        # Check if channel exists by looking up participants
        channels = supabase.from_('direct_message_channels').select('id').execute()
        if channels.data:
            for channel in channels.data:
                participants_result = supabase.from_('direct_message_participants').select('user_id').eq('channel_id', channel['id']).execute()
                if participants_result.data:
                    channel_participants = sorted([p['user_id'] for p in participants_result.data])
                    if channel_participants == participant_ids:
                        print("Direct message channel already exists, using existing")
                        return channel['id']
        
        # Create new channel
        print("Creating new direct message channel")
        channel_id = str(uuid.uuid4())
        supabase.table('direct_message_channels').insert({"id": channel_id}).execute()
        
        # Add participants
        for user_id in participant_ids:
            supabase.table('direct_message_participants').insert({
                "channel_id": channel_id,
                "user_id": user_id
            }).execute()
        
        return channel_id
    except Exception as e:
        print(f"Error creating direct message channel: {e}")
        raise e

def create_direct_message(supabase: Client, message_data, channel_id, user_id, parent_id=None):
    try:
        message_id = str(uuid.uuid4())
        print(f"Creating direct message: {message_data['content'][:50]}...")
        
        message_data = {
            "id": message_id,
            "channel_id": channel_id,
            "content": message_data['content'],
            "sender_id": user_id,
            "file": None
        }
        
        supabase.table('direct_messages').insert(message_data).execute()
        
        # Add some random reactions
        if not parent_id:  # Only add reactions to main messages
            emojis = ["👍", "❤️", "🚀", "💡", "👏"]
            import random
            reacting_users = random.sample(list(user_mapping.values()), random.randint(1, 2))
            for user_id in reacting_users:
                create_direct_message_reaction(supabase, message_id, user_id, random.choice(emojis))
        
        return message_id
    except Exception as e:
        print(f"Error creating direct message: {e}")
        raise e

def create_direct_message_reaction(supabase: Client, message_id, user_id, emoji="👍"):
    try:
        # Check if reaction already exists
        result = supabase.from_('direct_message_reactions').select('id').eq('message_id', message_id).eq('user_id', user_id).eq('emoji', emoji).execute()
        if result.data and len(result.data) > 0:
            print(f"Direct message reaction already exists, skipping: {emoji}")
            return
        
        print(f"Adding reaction {emoji} to direct message")
        reaction_data = {
            "id": str(uuid.uuid4()),
            "message_id": message_id,
            "user_id": user_id,
            "emoji": emoji
        }
        supabase.table('direct_message_reactions').insert(reaction_data).execute()
    except Exception as e:
        print(f"Error creating direct message reaction: {e}")
        raise e

def clean_direct_messages(supabase: Client):
    try:
        print("Cleaning existing direct messages...")
        # Delete in correct order due to foreign key constraints
        supabase.table('direct_message_reactions').delete().gte('created_at', '2000-01-01').execute()
        supabase.table('direct_messages').delete().gte('created_at', '2000-01-01').execute()
        supabase.table('direct_message_participants').delete().gte('created_at', '2000-01-01').execute()
        supabase.table('direct_message_channels').delete().gte('created_at', '2000-01-01').execute()
        print("Cleaned existing direct messages")
    except Exception as e:
        print(f"Error cleaning direct messages: {e}")
        raise e

def main():
    # Load environment variables from .env.local
    load_env()
    
    # Initialize Supabase client
    supabase_url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
    supabase_service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    
    if not supabase_url or not supabase_service_key:
        print("Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local")
        sys.exit(1)
    
    supabase: Client = create_client(supabase_url, supabase_service_key)
    
    # Load data
    users_data = load_json_file('users.json')
    teams_data = load_json_file('teams.json')
    messages_data = load_json_file('messages.json')
    textbooks_data = load_json_file('textbooks.json')
    
    try:
        # Get or create users and store mapping of email to user_id
        print("\nProcessing users...")
        global user_mapping  # Make it global so create_message can access it for reactions
        user_mapping = {}
        for user in users_data['users']:
            user_id = get_or_create_user(supabase, user)
            user_mapping[user['email']] = user_id
        
        # Find owner (first user with role 'owner')
        owner_email = next(user['email'] for user in users_data['users'] if user['role'] == 'owner')
        owner_id = user_mapping[owner_email]
        
        # Process teams and channels
        print("\nProcessing teams and channels...")
        channel_mapping = {}  # store channel_name -> channel_id mapping
        for team in teams_data['teams']:
            team_id = get_or_create_team(supabase, team, owner_id)
            
            # Add team members
            for user in users_data['users']:
                add_team_member(supabase, team_id, user_mapping[user['email']], user['role'])
            
            # Create channels
            for channel in team['channels']:
                channel_id = get_or_create_channel(supabase, channel, team_id, owner_id)
                channel_mapping[channel['name']] = channel_id
                
                # Add all team members to non-private channels
                if not channel['is_private']:
                    for user in users_data['users']:
                        add_channel_member(supabase, channel_id, user_mapping[user['email']])
        
        # Clean existing messages and direct messages
        clean_messages(supabase)
        clean_direct_messages(supabase)
        
        # Create regular messages
        print("\nProcessing channel messages...")
        for thread in messages_data['message_threads']:
            channel_id = channel_mapping[thread['channel']]
            
            for message in thread['messages']:
                author_id = user_mapping[message['author']]
                message_id = create_message(supabase, message, channel_id, author_id)
                
                # Create replies
                if 'replies' in message:
                    for reply in message['replies']:
                        reply_author_id = user_mapping[reply['author']]
                        create_message(supabase, reply, channel_id, reply_author_id, message_id)
        
        # Create direct messages
        print("\nProcessing direct messages...")
        direct_messages_data = load_json_file('direct_messages.json')
        for thread in direct_messages_data['direct_message_threads']:
            channel_id = create_direct_message_channel(supabase, thread['participants'])
            
            for message in thread['messages']:
                author_id = user_mapping[message['author']]
                message_id = create_direct_message(supabase, message, channel_id, author_id)
                
                # Create replies
                if 'replies' in message:
                    for reply in message['replies']:
                        reply_author_id = user_mapping[reply['author']]
                        create_direct_message(supabase, reply, channel_id, reply_author_id, message_id)
        
        print("\nDatabase seeding completed!")
        
    except Exception as e:
        print(f"\nError seeding database: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 