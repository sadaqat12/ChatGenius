import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { OpenAIRAGService } from '@/lib/services/rag-service'
import { OpenAIMessageEmbeddingService } from '@/lib/services/message-embedding-service'
import { Message } from '@/types/chat'

// Initialize Supabase client for server-side
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log('Request body:', body)

    if (!body.message) {
      console.error('Missing message field:', { body })
      return NextResponse.json({ error: 'Missing message field' }, { status: 400 })
    }

    const { message, recipientId, context, isFollowUp } = body

    // Initialize services
    const ragService = new OpenAIRAGService()
    const messageEmbeddingService = new OpenAIMessageEmbeddingService()
    
    try {
      // Get relevant messages using RAG query
      const { context: similarMessagesContext } = await ragService.query({
        question: message,
        teamId: recipientId,
        similarityThreshold: 0.7,
        maxTokens: 1500
      })

      // Filter out AI responses and format the current context
      const filteredContext = context?.filter((msg: Message) => {
        // Keep initial AI responses for context but filter out "Based on" responses
        return !msg.content.includes('Based on the context:')
      })

      const currentContext = filteredContext
        ?.map((msg: Message) => `${msg.user.id === recipientId ? 'Assistant' : 'User'}: ${msg.content}`)
        .join('\n') || ''

      // Filter and format historical messages
      const historicalContext = similarMessagesContext.messages
        .filter(msg => !msg.content.includes('Based on the context:'))
        .map(msg => `Previous message: ${msg.content}`)
        .join('\n')

      let response
      if (isFollowUp) {
        // If this is a follow-up to an initial response, provide the actual information
        response = `Based on the context and historical messages, I found the following information about the arbitrage policy: ${historicalContext}`
      } else {
        // Initial response indicating that we're checking
        response = "I'll check the available information about the arbitrage policy. One moment please..."
      }

      return NextResponse.json({ response })
    } catch (error) {
      console.error('Error in RAG processing:', error)
      return NextResponse.json({ error: 'Failed to process RAG query' }, { status: 500 })
    }
  } catch (error) {
    console.error('Error processing request:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 