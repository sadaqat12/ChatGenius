import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    const { email } = await request.json()
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    // Get current user's session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      )
    }

    // Check if user is team admin or owner
    const { data: teamMember, error: teamError } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', params.teamId)
      .eq('user_id', session.user.id)
      .single()

    if (teamError) throw teamError
    if (!teamMember || (teamMember.role !== 'admin' && teamMember.role !== 'owner')) {
      return NextResponse.json(
        { error: 'Unauthorized - Must be team admin or owner' },
        { status: 403 }
      )
    }

    // Create invitation with admin client
    const adminClient = createRouteHandlerClient(
      { cookies: () => cookieStore },
      {
        supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      }
    )

    // Try to invite the user
    const { data: invite, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      data: {
        invite_type: 'team',
        team_id: params.teamId,
        team_name: 'GauntletAI'
      }
    })

    if (inviteError) {
      console.error('Invite error:', inviteError)
      return NextResponse.json(
        { error: inviteError.message },
        { status: 400 }
      )
    }

    // Create record in team_invites table
    const { data: teamInvite, error: teamInviteError } = await supabase
      .from('team_invites')
      .insert({
        team_id: params.teamId,
        email: email,
        status: 'pending'
      })
      .select()
      .single()

    if (teamInviteError) {
      console.error('Error creating team invite record:', teamInviteError)
      return NextResponse.json(
        { error: 'Failed to create invitation record' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true,
      message: 'Invitation sent successfully',
      inviteId: teamInvite.id
    })
  } catch (error: any) {
    console.error('Error inviting user:', error)
    return NextResponse.json(
      { error: `Error inviting user: ${error.message}` },
      { status: 500 }
    )
  }
}

export async function GET(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  try {
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError) throw authError
    if (!session) throw new Error('Not authenticated')

    // Check if user is an admin or owner of the team
    const { data: teamMember, error: teamError } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', params.teamId)
      .eq('user_id', session.user.id)
      .single()

    if (teamError || !teamMember || (teamMember.role !== 'admin' && teamMember.role !== 'owner')) {
      console.log('Team member check failed:', { teamMember, teamError })
      return NextResponse.json(
        { error: 'Not authorized to view invitations' },
        { status: 403 }
      )
    }

    const { data: invitations, error } = await supabase
      .from('team_invites')
      .select(`
        id,
        email,
        status,
        created_at
      `)
      .eq('team_id', params.teamId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json(invitations)
  } catch (error) {
    console.error('Error fetching invitations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invitations' },
      { status: 500 }
    )
  }
} 