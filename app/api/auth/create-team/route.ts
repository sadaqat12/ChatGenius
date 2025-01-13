import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const cookieStore = cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )

  try {
    // Get the current user
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError) {
      console.error('Auth error:', authError)
      return NextResponse.json(
        { error: 'Authentication error: ' + authError.message },
        { status: 401 }
      )
    }
    if (!session) {
      console.error('No session found')
      return NextResponse.json(
        { error: 'Not authenticated. Please sign in.' },
        { status: 401 }
      )
    }

    // Check if email is verified
    if (!session.user.email_confirmed_at) {
      console.error('Email not verified for user:', session.user.id)
      return NextResponse.json(
        { error: 'Please confirm your email before creating a team' },
        { status: 403 }
      )
    }

    // Get the pending team name from user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('pending_team_name')
      .eq('user_id', session.user.id)
      .single()

    if (profileError) {
      console.error('Profile fetch error:', profileError)
      return NextResponse.json(
        { error: 'Failed to fetch user profile: ' + profileError.message },
        { status: 500 }
      )
    }

    if (!profile?.pending_team_name) {
      console.error('No pending team name found for user:', session.user.id)
      return NextResponse.json(
        { error: 'No pending team name found' },
        { status: 400 }
      )
    }

    console.log('Creating team with name:', profile.pending_team_name)

    // Create team using our database function
    const { data: teamId, error: teamError } = await supabase.rpc(
      'create_team_with_channel',
      {
        team_name: profile.pending_team_name,
        user_id: session.user.id
      }
    )

    if (teamError) {
      console.error('Team creation error:', teamError)
      return NextResponse.json(
        { error: 'Failed to create team: ' + teamError.message },
        { status: 500 }
      )
    }

    if (!teamId) {
      console.error('No team ID returned after creation')
      return NextResponse.json(
        { error: 'Failed to create team: No team ID returned' },
        { status: 500 }
      )
    }

    // Clear the pending team name
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ pending_team_name: null })
      .eq('user_id', session.user.id)

    if (updateError) {
      console.error('Failed to clear pending team name:', updateError)
      // Don't return error here as team was created successfully
    }

    return NextResponse.json({ teamId })
  } catch (error) {
    console.error('Unexpected error in create-team:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create team' },
      { status: 500 }
    )
  }
} 