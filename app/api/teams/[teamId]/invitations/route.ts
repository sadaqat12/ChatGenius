import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: { teamId: string } }
) {
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
    const { email } = await request.json()
    
    // Get the current user
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError) throw authError
    if (!session) throw new Error('Not authenticated')

    // Check if user is an admin of the team
    const { data: teamMember, error: teamError } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', params.teamId)
      .eq('user_id', session.user.id)
      .single()

    if (teamError || !teamMember || teamMember.role !== 'admin') {
      console.log('Team member check failed:', { teamMember, teamError })
      return NextResponse.json(
        { error: 'Not authorized to invite to this team' },
        { status: 403 }
      )
    }

    // Check if user already exists
    const { data: existingUser, error: userError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('email', email)
      .maybeSingle()

    if (userError) {
      console.log('User profile check failed:', userError)
    }

    // Check if user is already a member
    if (existingUser?.user_id) {
      const { data: existingMember } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', params.teamId)
        .eq('user_id', existingUser.user_id)
        .single()

      if (existingMember) {
        return NextResponse.json(
          { error: 'User is already a member of this team' },
          { status: 400 }
        )
      }
    }

    // Check if invitation already exists
    const { data: existingInvite } = await supabase
      .from('team_invites')
      .select('id, status')
      .eq('team_id', params.teamId)
      .eq('email', email)
      .single()

    let inviteId: string

    if (existingInvite) {
      if (existingInvite.status === 'pending') {
        return NextResponse.json(
          { error: 'Invitation already sent' },
          { status: 400 }
        )
      }
      // Update existing invitation
      const { error: updateError } = await supabase
        .from('team_invites')
        .update({
          status: 'pending',
          invited_by: session.user.id
        })
        .eq('id', existingInvite.id)

      if (updateError) throw updateError
      inviteId = existingInvite.id
    } else {
      // Create new invitation
      const { data: invitation, error: inviteError } = await supabase
        .from('team_invites')
        .insert({
          team_id: params.teamId,
          email,
          invited_by: session.user.id
        })
        .select()
        .single()

      if (inviteError) throw inviteError
      inviteId = invitation.id
    }

    // Send invitation email using Supabase Auth
    const { error: emailError } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/join?invitation=${inviteId}`,
      data: {
        invitation_id: inviteId,
        team_id: params.teamId
      }
    })

    if (emailError) throw emailError

    return NextResponse.json({ success: true, inviteId })
  } catch (error) {
    console.error('Error creating invitation:', error)
    return NextResponse.json(
      { error: 'Failed to create invitation' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: Request,
  { params }: { params: { teamId: string } }
) {
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
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError) throw authError
    if (!session) throw new Error('Not authenticated')

    // Check if user is an admin of the team
    const { data: teamMember, error: teamError } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', params.teamId)
      .eq('user_id', session.user.id)
      .single()

    if (teamError || !teamMember || teamMember.role !== 'admin') {
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
        created_at,
        invited_by (
          id,
          email,
          user_profiles (
            name
          )
        )
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