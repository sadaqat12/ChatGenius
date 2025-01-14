import json
import os
from datetime import datetime

# Create data directory if it doesn't exist
data_dir = os.path.join(os.path.dirname(__file__), 'data')
if not os.path.exists(data_dir):
    os.makedirs(data_dir)
    print(f"Created directory: {data_dir}")

def extract_tweet_texts(input_file):
    """
    Extract just the text content from tweets JSON file and save as a JSON array
    """
    # Read the JSON file
    with open(input_file, 'r', encoding='utf-8') as f:
        tweets = json.load(f)
    
    # Extract just the text from each tweet
    tweet_texts = [tweet['text'] for tweet in tweets]
    
    # Create output with fixed filename
    output_file = os.path.join(data_dir, "processedtweets.json")
    
    # Save to file as JSON
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({"tweets": tweet_texts}, f, indent=2, ensure_ascii=False)
    
    print(f"Extracted {len(tweet_texts)} tweets to {output_file}")
    return output_file

if __name__ == "__main__":
    input_file = os.path.join(data_dir, "fetchedtweets.json")
    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found. Please run fetch_tweets.py first.")
        exit(1)
    
    print(f"Processing {input_file}")
    extract_tweet_texts(input_file) 