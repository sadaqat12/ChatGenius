import tweepy
import os
import json
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Authentication credentials
api_key = os.getenv('TWITTER_API_KEY')
api_secret = os.getenv('TWITTER_API_SECRET')
access_token = os.getenv('TWITTER_ACCESS_TOKEN')
access_token_secret = os.getenv('TWITTER_ACCESS_TOKEN_SECRET')
bearer_token = os.getenv('TWITTER_BEARER_TOKEN')

# Create client object for v2 API
client = tweepy.Client(
    bearer_token=bearer_token,
    consumer_key=api_key,
    consumer_secret=api_secret,
    access_token=access_token,
    access_token_secret=access_token_secret
)

def get_user_tweets(username, num_tweets=100):
    """
    Fetch tweets from a specific user and save them to a JSON file
    username: Twitter username without the @ symbol
    num_tweets: Number of tweets to fetch (default 100)
    """
    try:
        # First get user ID from username
        user = client.get_user(username=username)
        if not user.data:
            print(f"User @{username} not found")
            return

        user_id = user.data.id

        # Fetch tweets using v2 API
        tweets = client.get_users_tweets(
            id=user_id,
            max_results=num_tweets,
            tweet_fields=['created_at', 'public_metrics', 'entities'],
            user_fields=['name', 'username', 'public_metrics'],
            expansions=['author_id']
        )
        
        if not tweets.data:
            print(f"No tweets found for @{username}")
            return

        # Create a list to store processed tweets
        tweets_data = []
        
        print(f"\nFetched {len(tweets.data)} tweets from @{username}")
        for tweet in tweets.data:
            # Store tweet data in a dictionary
            tweet_data = {
                "id": tweet.id,
                "date": str(tweet.created_at),
                "text": tweet.text,
                "metrics": {
                    "likes": tweet.public_metrics['like_count'],
                    "retweets": tweet.public_metrics['retweet_count'],
                    "replies": tweet.public_metrics['reply_count'],
                    "quotes": tweet.public_metrics['quote_count']
                },
                "hashtags": [tag['tag'] for tag in tweet.entities.get('hashtags', [])] if tweet.entities else [],
                "mentions": [mention['username'] for mention in tweet.entities.get('mentions', [])] if tweet.entities else [],
                "urls": [url['expanded_url'] for url in tweet.entities.get('urls', [])] if tweet.entities else []
            }
            tweets_data.append(tweet_data)
            
            # Print tweet info
            print("\n" + "="*50)
            print(f"Date: {tweet.created_at}")
            print(f"Tweet: {tweet.text}")
            print(f"Likes: {tweet.public_metrics['like_count']}")
            print(f"Retweets: {tweet.public_metrics['retweet_count']}")
        
        # Create data directory if it doesn't exist
        if not os.path.exists('data'):
            os.makedirs('data')
            
        # Save to JSON file with timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"data/{username}_tweets_{timestamp}.json"
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(tweets_data, f, indent=4, ensure_ascii=False)
            
        print(f"\nTweets saved to {filename}")
            
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    # Example usage
    username = "austen"  # Replace with any Twitter username
    num_tweets = 50        # Number of tweets you want to fetch
    
    get_user_tweets(username, num_tweets)
