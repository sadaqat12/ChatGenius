import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { OpenAIRAGService } from '@/lib/services/rag-service';

export async function POST(request: Request) {
  try {
    // Initialize Supabase client with cookies
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Get session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { originalMessage, responses, teamId } = await request.json();

    if (!teamId) {
      return NextResponse.json(
        { error: 'Team ID is required' },
        { status: 400 }
      );
    }

    const prompt = `
      Original event coordination message: "${originalMessage}"
      
      Responses from team members:
      ${responses.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n')}

      Based on these responses, what is the best time for the event? 
      If you can determine a common time that works for most people, return it in a clear format like "Monday at 2:00 PM".
      If you cannot determine a common time, explain why.
    `;

    const ragService = new OpenAIRAGService();
    const result = await ragService.query({
      question: prompt,
      teamId: teamId,
      userId: session.user.id,
      maxTokens: 500
    });

    const bestTime = result.answer.includes('at') ? result.answer : "Could not determine a common time from the responses";

    return NextResponse.json({ bestTime });
  } catch (error) {
    console.error('Error analyzing availability:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 