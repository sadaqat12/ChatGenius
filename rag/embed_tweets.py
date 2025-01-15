import json
import os
import sys
from openai import OpenAI
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables from .env.local in the root directory
load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env.local'))

# Get OpenAI API key
openai_api_key = os.getenv('OPENAI_API_KEY')
if not openai_api_key or openai_api_key == 'your_openai_api_key_here':
    print("Error: Please set your OpenAI API key in .env.local")
    sys.exit(1)

# Initialize OpenAI client
client = OpenAI(api_key=openai_api_key)

# Initialize Supabase client
supabase: Client = create_client(
    os.getenv('NEXT_PUBLIC_SUPABASE_URL', ''),
    os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')
)

def get_embedding(text: str) -> list[float]:
    """Get embedding for a text using OpenAI's API"""
    response = client.embeddings.create(
        model="text-embedding-3-small",  # or text-embedding-ada-002 for older version
        input=text
    )
    return response.data[0].embedding

def process_tweets():
    """Process tweets and store embeddings in Supabase"""
    input_file = os.path.join(os.path.dirname(__file__), 'data', 'processedtweets.json')
    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found. Please run process_tweets.py first.")
        return
    
    print(f"Processing {input_file}")
    
    # Read the tweets
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
        tweets = data['tweets']
    
    print(f"Found {len(tweets)} tweets to process")
    
    # Process each tweet
    for i, tweet in enumerate(tweets, 1):
        try:
            # Get embedding
            embedding = get_embedding(tweet)
            
            # Store in Supabase
            result = supabase.table('tweets').insert({
                'content': tweet,
                'embedding': embedding
            }).execute()
            
            print(f"Processed tweet {i}/{len(tweets)}")
            
        except Exception as e:
            print(f"Error processing tweet {i}: {str(e)}")
            continue

if __name__ == "__main__":
    process_tweets() 