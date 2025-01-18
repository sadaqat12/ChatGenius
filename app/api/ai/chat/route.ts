import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { ragService } from '@/lib/services/rag-service';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { message, teamId, conversationHistory } = await request.json();

    if (!message || !teamId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Verify user has access to the team
    const { data: teamMember, error: teamError } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('team_id', teamId)
      .eq('user_id', session.user.id)
      .single();

    if (teamError || !teamMember) {
      return NextResponse.json(
        { error: 'Team access denied' },
        { status: 403 }
      );
    }

    // Query using RAG service
    const result = await ragService.query({
      question: message,
      teamId,
      userId: session.user.id,
      conversationHistory: conversationHistory || []
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('AI chat error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 