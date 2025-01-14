import { OpenAI } from 'openai'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Check for required environment variables
if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing OPENAI_API_KEY environment variable')
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables')
}

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

interface Tweet {
  id: number
  content: string
  similarity: number
}

export async function POST(req: Request) {
  try {
    // Parse request body
    const body = await req.json()
    const { message } = body

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Get embedding for the user's message
    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: message,
      dimensions: 1536
    }).catch(error => {
      console.error('OpenAI Embedding Error:', error)
      throw new Error('Failed to generate embedding')
    })

    // Search for similar tweets with adjusted threshold
    const { data: similarTweets, error: dbError } = await supabase.rpc('match_tweets', {
      query_embedding: embedding.data[0].embedding,
      match_threshold: 0.3, // Lower threshold to get more potential matches
      match_count: 15 // Get more matches to filter
    }) as { data: Tweet[] | null, error: Error | null }

    if (dbError) {
      console.error('Database Error:', dbError)
      throw new Error('Failed to search similar tweets')
    }

    // Log similar tweets for debugging
    console.log('Query:', message)
    console.log('Found similar tweets:', similarTweets?.map(t => ({
      id: t.id,
      content: t.content,
      similarity: t.similarity
    })) || 'No matches found')

    // Filter and sort tweets by similarity
    const relevantTweets = similarTweets
      ?.filter(tweet => tweet.similarity > 0.3) // Only keep reasonably similar tweets
      ?.sort((a, b) => b.similarity - a.similarity)
      ?.slice(0, 5) // Take top 5 most similar

    // Prepare context from similar tweets
    const context = relevantTweets
      ?.map(tweet => `Tweet: "${tweet.content}" (Similarity: ${(tweet.similarity * 100).toFixed(1)}%)`)
      .join('\n\n') || ''

    // Get chat completion with context
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: `You are a helpful AI assistant with access to a database of tweets. 
          Your responses should be based on the context provided from the tweet database.
          
          Here are the most relevant tweets for the current query:
          ${context}

          Instructions:
          1. Base your response primarily on the information from the provided tweets
          2. If the tweets don't contain relevant information for the query, explicitly state: "I don't have enough relevant information in my tweet database to answer this question accurately."
          3. Don't mention that you're using tweets as context unless specifically asked
          4. Maintain a natural, conversational tone
          5. If you need to speculate beyond the provided context, clearly state: "Based on the available information, I can speculate that..."`
        },
        { role: "user", content: message }
      ],
      temperature: 0.5, // Reduced temperature for more focused responses
    }).catch(error => {
      console.error('OpenAI Chat Error:', error)
      throw new Error('Failed to generate response')
    })

    return NextResponse.json({
      message: completion.choices[0].message.content,
      debug: process.env.NODE_ENV === 'development' ? {
        similarTweets: relevantTweets?.map(t => ({
          content: t.content,
          similarity: t.similarity
        }))
      } : undefined
    })

  } catch (error) {
    console.error('Error in AI chat:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    )
  }
} 