import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
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
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Check if user has permission to invite
    const { data: membership, error: membershipError } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', params.teamId)
      .eq('user_id', session.user.id)
      .single()

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Not authorized to invite to this team' },
        { status: 403 }
      )
    }

    // Create admin client to check user existence
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Check if user exists
    const { data: existingUser, error: userError } = await adminClient.auth.admin.listUsers()
      .then(({ data: { users } }) => ({
        data: users.find(u => u.email === email),
        error: null
      }))
      .catch(error => ({ data: null, error }))

    if (userError) {
      console.error('Error checking user existence:', userError)
      return NextResponse.json(
        { error: 'Failed to check user existence' },
        { status: 500 }
      )
    }

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User does not exist. They must create an account before being invited.' },
        { status: 400 }
      )
    }

    // Check if user is already a member of the team
    const { data: existingMember, error: memberError } = await supabase
      .from('team_members')
      .select('team_id, user_id')
      .eq('team_id', params.teamId)
      .eq('user_id', existingUser.id)
      .maybeSingle()

    if (memberError) {
      console.error('Error checking team membership:', memberError)
      return NextResponse.json(
        { error: 'Failed to check team membership' },
        { status: 500 }
      )
    }

    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a member of this team' },
        { status: 400 }
      )
    }

    // Check for existing pending invitation
    const { data: existingInvite, error: inviteError } = await supabase
      .from('team_invites')
      .select('id, status')
      .eq('team_id', params.teamId)
      .eq('email', email)
      .eq('status', 'pending')
      .maybeSingle()

    if (inviteError) {
      console.error('Error checking existing invitation:', inviteError)
      return NextResponse.json(
        { error: 'Failed to check existing invitation' },
        { status: 500 }
      )
    }

    if (existingInvite) {
      return NextResponse.json(
        { message: 'Invitation already sent to this user' },
        { status: 200 }
      )
    }

    // Create the invitation
    const { error: createError } = await supabase
      .from('team_invites')
      .insert({
        team_id: params.teamId,
        email: email,
        status: 'pending'
      })

    if (createError) {
      console.error('Error creating invitation:', createError)
      return NextResponse.json(
        { error: 'Failed to create invitation' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in invitation process:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
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