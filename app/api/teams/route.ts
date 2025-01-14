import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { name } = await request.json()
    
    // Create a Supabase client for the route handler
    const supabase = createRouteHandlerClient({ cookies })
    
    // Get the current user
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session) {
      console.error('Auth error:', authError || 'No session found')
      return NextResponse.json(
        { error: 'Not authenticated. Please sign in.' },
        { status: 401 }
      )
    }

    // Create team using our database function
    const { data: teamId, error: teamError } = await supabase.rpc(
      'create_team_with_channel',
      {
        team_name: name,
        user_id: session.user.id
      }
    )

    if (teamError) {
      console.error('Database error:', teamError)
      return NextResponse.json(
        { error: 'Database error: ' + teamError.message },
        { status: 500 }
      )
    }

    // Verify team was created
    const { data: team, error: teamCheckError } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single()

    if (teamCheckError) {
      console.error('Team verification error:', teamCheckError)
      return NextResponse.json(
        { error: 'Failed to verify team creation: ' + teamCheckError.message },
        { status: 500 }
      )
    }

    // Verify team membership
    const { data: membership, error: membershipError } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .eq('user_id', session.user.id)
      .single()

    if (membershipError) {
      console.error('Membership verification error:', membershipError)
      return NextResponse.json(
        { error: 'Failed to verify team membership: ' + membershipError.message },
        { status: 500 }
      )
    }

    console.log('Team created successfully:', {
      teamId,
      team,
      membership
    })

    return NextResponse.json({ teamId })
  } catch (error) {
    console.error('Failed to create team:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create team' },
      { status: 500 }
    )
  }
} 