import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/database.types';
import { messageEmbeddingService } from './message-embedding-service';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface SimilarMessage {
  id: string;
  content: string;
  similarity: number;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface RAGService {
  query(params: {
    question: string;
    teamId: string;
    maxTokens?: number;
    similarityThreshold?: number;
    conversationHistory?: ConversationMessage[];
  }): Promise<{
    answer: string;
    context: {
      messages: SimilarMessage[];
    };
  }>;
}

export class OpenAIRAGService implements RAGService {
  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text.replace(/\n/g, ' '),
    });

    return response.data[0].embedding;
  }

  private async findSimilarMessages(params: {
    embedding: number[];
    teamId: string;
    similarityThreshold?: number;
    maxResults?: number;
  }): Promise<SimilarMessage[]> {
    const {
      embedding,
      teamId,
      similarityThreshold = 0.7,
      maxResults = 5
    } = params;

    const { data: messages, error } = await supabase.rpc(
      'find_similar_messages',
      {
        query_embedding: embedding,
        team_id_filter: teamId,
        similarity_threshold: similarityThreshold,
        max_results: maxResults
      }
    );

    if (error) throw error;
    return messages || [];
  }

  private async generateAnswer(params: {
    question: string;
    context: string;
    conversationHistory?: ConversationMessage[];
  }): Promise<string> {
    const { question, context, conversationHistory = [] } = params;

    const messages = [
      {
        role: 'system' as const,
        content: `You are a helpful AI assistant that answers questions based on the provided context. 
        Always ground your answers in the context provided. If the context doesn't contain enough 
        information to answer the question confidently, acknowledge that and suggest what additional 
        information might be needed.
        
        When referring to previous conversation, maintain consistency with your earlier responses.`
      },
      {
        role: 'user' as const,
        content: `Context from team messages:
        ${context}
        
        Previous conversation:
        ${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}
        
        Current question: ${question}
        
        Please provide a clear and concise answer based on the context above and previous conversation.`
      }
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages,
      temperature: 0.7,
      max_tokens: 500
    });

    return response.choices[0].message.content || 'No answer generated';
  }

  async query(params: {
    question: string;
    teamId: string;
    maxTokens?: number;
    similarityThreshold?: number;
    conversationHistory?: ConversationMessage[];
  }) {
    // Generate embedding for the question
    const questionEmbedding = await this.generateEmbedding(params.question);

    // Find similar messages
    const similarMessages = await this.findSimilarMessages({
      embedding: questionEmbedding,
      teamId: params.teamId,
      similarityThreshold: params.similarityThreshold
    });

    // Format context from similar messages
    const context = similarMessages
      .map(msg => `Message: ${msg.content}`)
      .join('\n\n');

    // Generate answer using context and conversation history
    const answer = await this.generateAnswer({
      question: params.question,
      context,
      conversationHistory: params.conversationHistory
    });

    return {
      answer,
      context: {
        messages: similarMessages
      }
    };
  }
}

// Export singleton instance
export const ragService = new OpenAIRAGService(); 