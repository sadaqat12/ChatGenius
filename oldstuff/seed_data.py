import json
import os
import random
import time
from datetime import datetime, timedelta
from typing import Dict, List
import uuid
from faker import Faker
import openai
from dotenv import load_dotenv
from supabase import create_client, Client
import httpx
from functools import wraps

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env.local'))

# Initialize Faker
fake = Faker()

# Initialize Supabase client
supabase: Client = create_client(
    os.getenv('NEXT_PUBLIC_SUPABASE_URL', ''),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY', ''),  # Use service role key for admin access
)

# Constants
NUM_USERS = 20
NUM_TEAMS = 5
CHANNELS_PER_TEAM = 5
MESSAGES_PER_CHANNEL = 50
DMS_PER_USER = 10
MESSAGES_PER_DM = 20
MAX_RETRIES = 3
RETRY_DELAY = 1  # seconds

def retry_on_network_error(max_retries=MAX_RETRIES, delay=RETRY_DELAY):
    """Decorator to retry functions on network errors"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except (httpx.NetworkError, httpx.ReadError) as e:
                    if attempt == max_retries - 1:
                        print(f"Failed after {max_retries} attempts: {str(e)}")
                        raise
                    print(f"Network error, retrying in {delay} seconds... ({attempt + 1}/{max_retries})")
                    time.sleep(delay * (attempt + 1))  # Exponential backoff
            return None
        return wrapper
    return decorator

@retry_on_network_error()
def safe_supabase_operation(operation_func):
    """Safely execute a Supabase operation with retry logic"""
    try:
        result = operation_func()
        time.sleep(0.1)  # Small delay between operations
        return result
    except Exception as e:
        print(f"Error in Supabase operation: {str(e)}")
        raise

# Emojis for reactions
EMOJIS = ['👍', '❤️', '😂', '🎉', '🚀', '💡', '👏', '🔥']

def generate_realistic_message() -> str:
    """Generate realistic team chat messages"""
    message_templates = [
        # Project updates
        lambda: f"Just pushed an update to {fake.word()}-branch. The new {fake.word()} feature is ready for review.",
        lambda: f"The {fake.word()} service is now deployed to production. Please monitor for any issues.",
        lambda: f"Weekly status update: Completed {random.randint(2, 5)} tasks this week, {random.randint(1, 3)} are in review.",
        
        # Questions and help requests
        lambda: f"Has anyone encountered this error before? '{fake.sentence()}'",
        lambda: f"Need help debugging an issue with the {fake.word()} module. Getting a {random.choice(['timeout', 'connection refused', 'permission denied', 'null reference'])} error.",
        lambda: f"Looking for feedback on the new {fake.word()} design. Thoughts?",
        
        # Meeting coordination
        lambda: f"Team standup in {random.randint(5, 30)} minutes. Anyone who can't make it?",
        lambda: f"Planning to schedule the {fake.word()} review for {random.choice(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])} at {random.randint(1, 4)}PM. Does that work for everyone?",
        lambda: f"Quick sync about the {fake.word()} project? Need to discuss the timeline.",
        
        # Announcements
        lambda: f"🎉 Just hit a major milestone: {fake.sentence()}",
        lambda: f"📢 Important: {fake.sentence()}",
        lambda: f"FYI: We'll be doing maintenance on {random.choice(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])} from {random.randint(9, 11)}AM to {random.randint(2, 5)}PM.",
        
        # Technical discussions
        lambda: f"I think we should use {random.choice(['React', 'Vue', 'Angular', 'Svelte'])} for the new frontend because {fake.sentence().lower()}",
        lambda: f"The performance issue was caused by {fake.sentence().lower()}. Fixed now.",
        lambda: f"Anyone familiar with {random.choice(['Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP'])}? Need help with {fake.word()} configuration.",
        
        # Team collaboration
        lambda: f"@{fake.first_name()} could you review my PR for the {fake.word()} feature?",
        lambda: f"Great work on the {fake.word()} implementation, @{fake.first_name()}!",
        lambda: f"I've documented the new process here: https://docs.example.com/{fake.word()}-{fake.word()}",
        
        # General team chat
        lambda: f"Welcome @{fake.first_name()} to the team! 👋",
        lambda: f"Taking a quick break, back in {random.randint(10, 60)} minutes.",
        lambda: f"Anyone up for virtual coffee chat today?",
        
        # Bug reports
        lambda: f"Found a bug in {fake.word()}: {fake.sentence()}",
        lambda: f"Critical issue: {fake.sentence()}. Investigating now.",
        lambda: f"Regression test failed on {fake.word()}-branch. Looking into it.",
        
        # Feature discussions
        lambda: f"What if we added {fake.word()} functionality to handle {fake.sentence().lower()}?",
        lambda: f"Users are requesting {fake.word()} feature. Should we prioritize this for next sprint?",
        lambda: f"Here's a mockup of the new {fake.word()} interface: [Design link]",
    ]
    return random.choice(message_templates)()

def cleanup_database():
    """Clean up existing seed data"""
    print("🧹 Cleaning up existing data...")
    
    # Clean up JSON files
    json_files = ['seed_credentials.json', 'team_admins.json']
    for file in json_files:
        file_path = os.path.join(os.path.dirname(__file__), file)
        if os.path.exists(file_path):
            os.remove(file_path)
            print(f"Cleaned up {file}")
    
    # Delete existing data in reverse order of dependencies
    tables_with_conditions = [
        ('reactions', 'id'),
        ('direct_message_reactions', 'id'),
        ('messages', 'id'),
        ('direct_messages', 'id'),
        ('channel_members', 'channel_id'),
        ('direct_message_participants', 'channel_id'),
        ('channels', 'id'),
        ('direct_message_channels', 'id'),
        ('team_members', 'team_id'),
        ('teams', 'id'),
        ('user_profiles', 'id')
    ]
    
    BATCH_SIZE = 50  # Reduced batch size
    
    for table, key_column in tables_with_conditions:
        try:
            # Get total count first
            count_result = safe_supabase_operation(
                lambda: supabase.table(table).select('count', count='exact').execute()
            )
            total_records = count_result.count if count_result.count is not None else 0
            
            if total_records > 0:
                print(f"Cleaning up {table} ({total_records} records)")
                
                # Delete in batches
                offset = 0
                while offset < total_records:
                    try:
                        # Get batch of records
                        batch = safe_supabase_operation(
                            lambda: supabase.table(table).select(key_column).range(offset, offset + BATCH_SIZE - 1).execute()
                        )
                        if batch.data:
                            ids = [record[key_column] for record in batch.data]
                            safe_supabase_operation(
                                lambda: supabase.table(table).delete().in_(key_column, ids).execute()
                            )
                            print(f"  Deleted batch of {len(ids)} records from {table}")
                        offset += BATCH_SIZE
                        time.sleep(0.5)  # Add delay between batches
                    except Exception as e:
                        print(f"Error processing batch in {table}: {str(e)}")
                        time.sleep(1)  # Wait longer on error
                        continue
                
                print(f"✓ Cleaned up {table}")
            else:
                print(f"No records to clean in {table}")
                
        except Exception as e:
            print(f"Error cleaning up {table}: {str(e)}")
            continue
    
    print("✅ Cleanup completed!")

def get_or_create_user(email: str, name: str, avatar_url: str, password: str) -> Dict:
    """Get existing user or create a new one"""
    try:
        # Try to get existing user
        existing_users = safe_supabase_operation(
            lambda: supabase.auth.admin.list_users()
        )
        existing_user = next((u for u in existing_users if getattr(u, 'email', '') == email), None)
        
        if existing_user:
            print(f"Found existing user: {email}")
            user_id = existing_user.id
        else:
            # Create new user
            auth_user = safe_supabase_operation(
                lambda: supabase.auth.admin.create_user({
                    'email': email,
                    'password': password,
                    'email_confirm': True,
                    'user_metadata': {
                        'name': name,
                        'avatar_url': avatar_url
                    }
                })
            )
            user_id = auth_user.user.id
            print(f"Created new user: {email}")
        
        # Create or update user profile
        profile_data = {
            'id': str(uuid.uuid4()),
            'user_id': user_id,
            'name': name,
            'avatar_url': avatar_url,
            'status': random.choice(['online', 'away', 'busy', 'offline']),
            'status_updated_at': datetime.now().isoformat(),
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat(),
        }
        
        try:
            # Delete existing profile if any
            safe_supabase_operation(
                lambda: supabase.table('user_profiles').delete().eq('user_id', user_id).execute()
            )
        except:
            pass  # Ignore if no profile exists
            
        # Create new profile
        safe_supabase_operation(
            lambda: supabase.table('user_profiles').insert(profile_data).execute()
        )
        
        return {
            'id': user_id,
            'email': email,
            'name': name,
            'avatar_url': avatar_url,
            'password': password,
            'created_at': datetime.now().isoformat(),
        }
        
    except Exception as e:
        print(f"Error processing user {email}: {str(e)}")
        return None

def create_users() -> List[Dict]:
    """Create sample users with authentication"""
    users = []
    default_password = "Password123!"  # Strong default password for test users
    
    for i in range(NUM_USERS):
        name = fake.name()
        email = f"testuser{i+1}@example.com"
        avatar_url = f"https://api.dicebear.com/7.x/avataaars/svg?seed={i}"
        
        user = get_or_create_user(email, name, avatar_url, default_password)
        if user:
            users.append(user)
    
    if not users:
        raise Exception("No users could be created or retrieved!")
    
    # Save user credentials to a file for reference
    credentials_file = os.path.join(os.path.dirname(__file__), 'seed_credentials.json')
    with open(credentials_file, 'w') as f:
        json.dump({
            'note': 'All users have the same password: Password123!',
            'users': [{
                'email': user['email'],
                'name': user['name']
            } for user in users]
        }, f, indent=2)
    print(f"\nSaved user credentials to {credentials_file}")
    
    return users

def create_teams(users: List[Dict]) -> List[Dict]:
    """Create sample teams"""
    teams = []
    team_admins = {}  # Track team admins
    
    for _ in range(NUM_TEAMS):
        creator = random.choice(users)
        team_id = str(uuid.uuid4())
        
        # First create the team
        team = {
            'id': team_id,
            'name': fake.company(),
            'description': fake.catch_phrase(),
            'created_by': creator['id'],
            'created_at': fake.date_time_this_year().isoformat(),
            'updated_at': datetime.now().isoformat(),
        }
        
        # Insert team into database
        safe_supabase_operation(
            lambda: supabase.table('teams').insert(team).execute()
        )
        teams.append(team)
        team_admins[team['name']] = creator['email']  # Track admin for this team
        
        print(f"Created team: {team['name']} (Admin: {creator['email']})")
        
        # First add creator as admin
        safe_supabase_operation(
            lambda: supabase.table('team_members').insert({
                'team_id': team_id,
                'user_id': creator['id'],
                'role': 'admin',
                'created_at': datetime.now().isoformat()
            }).execute()
        )
        print(f"Added admin {creator['email']} to team {team['name']}")
        
        # Then add other members
        other_users = [u for u in users if u['id'] != creator['id']]
        team_members = random.sample(other_users, random.randint(2, len(other_users)))
        
        for user in team_members:
            safe_supabase_operation(
                lambda: supabase.table('team_members').insert({
                    'team_id': team_id,
                    'user_id': user['id'],
                    'role': 'member',
                    'created_at': datetime.now().isoformat()
                }).execute()
            )
            print(f"Added member {user['email']} to team {team['name']}")
            time.sleep(0.1)  # Small delay between member additions
    
    # Save team admin information
    admin_file = os.path.join(os.path.dirname(__file__), 'team_admins.json')
    with open(admin_file, 'w') as f:
        json.dump({
            'teams': [{
                'name': team['name'],
                'admin': team_admins[team['name']]
            } for team in teams]
        }, f, indent=2)
    print(f"\nSaved team admin information to {admin_file}")
            
    return teams

def create_channels(teams: List[Dict]) -> List[Dict]:
    """Create channels for each team"""
    channels = []
    default_channels = ['general', 'random', 'announcements']
    
    for team in teams:
        # Get team members
        team_members_result = safe_supabase_operation(
            lambda: supabase.table('team_members').select('user_id').eq('team_id', team['id']).execute()
        )
        team_member_ids = [member['user_id'] for member in team_members_result.data]
        
        # Create default channels
        for channel_name in default_channels:
            channel = {
                'id': str(uuid.uuid4()),
                'name': channel_name,
                'team_id': team['id'],
                'is_private': False,
                'created_by': team['created_by'],
                'description': fake.catch_phrase(),
                'created_at': team['created_at'],
                'updated_at': datetime.now().isoformat(),
            }
            # Insert channel into database
            safe_supabase_operation(
                lambda: supabase.table('channels').insert(channel).execute()
            )
            channels.append(channel)
            print(f"Created channel #{channel_name} in team {team['name']}")
            
            # Add all team members to the channel
            for user_id in team_member_ids:
                safe_supabase_operation(
                    lambda: supabase.table('channel_members').insert({
                        'channel_id': channel['id'],
                        'user_id': user_id,
                        'created_at': datetime.now().isoformat()
                    }).execute()
                )
                time.sleep(0.1)  # Small delay between member additions
            print(f"Added {len(team_member_ids)} members to channel #{channel_name}")
            time.sleep(0.5)  # Delay between channels
        
        # Create additional random channels
        for _ in range(CHANNELS_PER_TEAM - len(default_channels)):
            is_private = random.random() < 0.3
            channel = {
                'id': str(uuid.uuid4()),
                'name': fake.word().lower(),
                'team_id': team['id'],
                'is_private': is_private,
                'created_by': team['created_by'],
                'description': fake.catch_phrase(),
                'created_at': fake.date_time_this_year().isoformat(),
                'updated_at': datetime.now().isoformat(),
            }
            # Insert channel into database
            safe_supabase_operation(
                lambda: supabase.table('channels').insert(channel).execute()
            )
            channels.append(channel)
            print(f"Created channel #{channel['name']} in team {team['name']}")
            
            # For private channels, add a random subset of team members
            # For public channels, add all team members
            if is_private:
                selected_members = random.sample(team_member_ids, random.randint(2, len(team_member_ids)))
            else:
                selected_members = team_member_ids
                
            for user_id in selected_members:
                safe_supabase_operation(
                    lambda: supabase.table('channel_members').insert({
                        'channel_id': channel['id'],
                        'user_id': user_id,
                        'created_at': datetime.now().isoformat()
                    }).execute()
                )
                time.sleep(0.1)  # Small delay between member additions
            print(f"Added {len(selected_members)} members to channel #{channel['name']}")
            time.sleep(0.5)  # Delay between channels
    
    return channels

def create_messages(channels: List[Dict], users: List[Dict]) -> None:
    """Create messages in channels with proper threading and chronological order"""
    # Track messages per channel for threading
    channel_messages = {}
    
    for channel in channels:
        print(f"\nCreating message history for channel #{channel['name']}")
        channel_messages[channel['id']] = []
        channel_users = random.sample(users, min(len(users), 5))
        
        # Generate messages over the past 30 days
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)
        
        for _ in range(MESSAGES_PER_CHANNEL):
            user = random.choice(channel_users)
            message_id = str(uuid.uuid4())
            
            # Generate timestamp between start and end date
            message_date = fake.date_time_between(start_date=start_date, end_date=end_date)
            
            # Decide if this is a parent message or reply
            parent_id = None
            if channel_messages[channel['id']] and random.random() < 0.2:  # 20% chance of being a reply
                parent_message = random.choice(channel_messages[channel['id']])
                parent_id = parent_message['id']
                message_date = fake.date_time_between(
                    start_date=datetime.fromisoformat(parent_message['created_at']),
                    end_date=end_date
                )
                content = generate_reply_message(parent_message['content'])
            else:
                content = generate_realistic_message()
            
            message = {
                'id': message_id,
                'content': content,
                'channel_id': channel['id'],
                'user_id': user['id'],
                'parent_id': parent_id,
                'created_at': message_date.isoformat(),
                'updated_at': message_date.isoformat(),
            }
            
            # Sometimes add a file attachment
            if random.random() < 0.1:  # 10% chance of file attachment
                message['file'] = {
                    'name': fake.file_name(),
                    'type': random.choice(['image/jpeg', 'application/pdf', 'text/plain']),
                    'url': f"https://example.com/files/{uuid.uuid4()}",
                    'size': random.randint(1000, 1000000)
                }
            
            # Insert message
            safe_supabase_operation(
                lambda: supabase.table('messages').insert(message).execute()
            )
            channel_messages[channel['id']].append(message)
            
            if parent_id:
                print(f"Created reply in thread of channel #{channel['name']}")
            else:
                print(f"Created new message in channel #{channel['name']}")
            
            # Add some reactions
            if random.random() < 0.3:  # 30% chance of reactions
                num_reactions = random.randint(1, 3)
                reaction_users = random.sample(users, num_reactions)
                
                for reaction_user in reaction_users:
                    safe_supabase_operation(
                        lambda: supabase.table('reactions').insert({
                            'id': str(uuid.uuid4()),
                            'message_id': message_id,
                            'user_id': reaction_user['id'],
                            'emoji': random.choice(EMOJIS),
                            'created_at': message_date.isoformat(),
                            'message_type': 'channel',
                            'created_by': reaction_user['id']
                        }).execute()
                    )
                    print(f"Added reaction to message in channel #{channel['name']}")
                    time.sleep(0.1)  # Small delay between reactions
            
            time.sleep(0.2)  # Small delay between messages

def generate_reply_message(parent_content: str) -> str:
    """Generate a contextual reply based on the parent message content"""
    # Extract key information from parent message to generate contextual reply
    if "review" in parent_content.lower():
        return random.choice([
            "I'll take a look at it now!",
            "On it, will review in the next hour.",
            "Already reviewed, left some comments.",
            "Could you clarify what specifically needs review?",
        ])
    elif "help" in parent_content.lower() or "?" in parent_content:
        return random.choice([
            "I can help with that. Let me check.",
            "Have you tried clearing the cache first?",
            "I ran into this before, the solution was to...",
            "Let's hop on a quick call to debug this.",
        ])
    elif "deploy" in parent_content.lower():
        return random.choice([
            "Deployment successful on my end.",
            "I'm seeing some issues in the logs...",
            "Remember to update the env variables.",
            "Can you verify it's working in staging?",
        ])
    elif "meeting" in parent_content.lower() or "schedule" in parent_content.lower():
        return random.choice([
            "That time works for me!",
            "Could we do 30 minutes later?",
            "I have a conflict, can we reschedule?",
            "👍 I'll be there.",
        ])
    elif "bug" in parent_content.lower() or "issue" in parent_content.lower():
        return random.choice([
            "Can you share the error message?",
            "Is this reproducible in dev?",
            "Which version are you running?",
            "I'll create a ticket for this.",
        ])
    else:
        return random.choice([
            "Thanks for the update!",
            "Got it, will follow up soon.",
            "Makes sense to me.",
            "Keep me posted on this.",
            "Good point! 👍",
        ])

def create_direct_messages(users: List[Dict]) -> None:
    """Create direct message channels and messages between users"""
    for user in users:
        # Create DM channels with random users
        other_users = [u for u in users if u['id'] != user['id']]
        dm_partners = random.sample(other_users, min(len(other_users), DMS_PER_USER))
        
        for partner in dm_partners:
            # Create DM channel
            channel_id = str(uuid.uuid4())
            safe_supabase_operation(
                lambda: supabase.table('direct_message_channels').insert({
                    'id': channel_id,
                    'created_at': fake.date_time_this_year().isoformat(),
                }).execute()
            )
            
            # Add participants
            for participant_id in [user['id'], partner['id']]:
                safe_supabase_operation(
                    lambda: supabase.table('direct_message_participants').insert({
                        'channel_id': channel_id,
                        'user_id': participant_id,
                    }).execute()
                )
                time.sleep(0.1)  # Small delay between participant additions
            
            # Create messages
            for _ in range(MESSAGES_PER_DM):
                sender = random.choice([user, partner])
                message_id = str(uuid.uuid4())
                
                message = {
                    'id': message_id,
                    'content': generate_realistic_message(),
                    'channel_id': channel_id,
                    'sender_id': sender['id'],
                    'created_at': fake.date_time_this_year().isoformat(),
                    'updated_at': datetime.now().isoformat(),
                }
                
                # Insert message
                safe_supabase_operation(
                    lambda: supabase.table('direct_messages').insert(message).execute()
                )
                
                # Add reactions sometimes
                if random.random() < 0.2:  # 20% chance of reactions
                    safe_supabase_operation(
                        lambda: supabase.table('direct_message_reactions').insert({
                            'id': str(uuid.uuid4()),
                            'message_id': message_id,
                            'user_id': partner['id'] if sender == user else user['id'],
                            'emoji': random.choice(EMOJIS),
                            'created_at': datetime.now().isoformat(),
                        }).execute()
                    )
                time.sleep(0.2)  # Small delay between messages
            time.sleep(0.5)  # Delay between DM channels

def main():
    """Main function to seed the database"""
    print("🌱 Starting database seeding...")
    
    # Clean up existing data first
    cleanup_database()
    
    print("\nCreating users...")
    users = create_users()
    
    print("\nCreating teams...")
    teams = create_teams(users)
    
    print("\nCreating channels...")
    channels = create_channels(teams)
    
    print("\nCreating messages...")
    create_messages(channels, users)
    
    print("\nCreating direct messages...")
    create_direct_messages(users)
    
    print("\n✅ Seeding completed!")

if __name__ == "__main__":
    main() 