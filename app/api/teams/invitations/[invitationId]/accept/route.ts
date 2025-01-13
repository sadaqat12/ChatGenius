import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: { invitationId: string } }
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
    // Get the current user using getUser() for better security
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError) {
      console.error('Auth error:', authError)
      return NextResponse.json(
        { error: 'Authentication failed. Please log in again.' },
        { status: 401 }
      )
    }
    if (!user) {
      return NextResponse.json(
        { error: 'Please log in to accept the invitation' },
        { status: 401 }
      )
    }

    // Get the invitation
    const { data: invitation, error: inviteError } = await supabase
      .from('team_invites')
      .select(`
        *,
        team:teams (
          id,
          name,
          description
        )
      `)
      .eq('id', params.invitationId)
      .eq('status', 'pending')
      .single()

    if (inviteError) {
      console.error('Error fetching invitation:', inviteError)
      // Check if it's a "no rows" error
      if (inviteError.code === 'PGRST116') {
        // Try to find the invitation without status filter to give better error message
        const { data: expiredInvite, error: checkError } = await supabase
          .from('team_invites')
          .select('status')
          .eq('id', params.invitationId)
          .single()

        if (!checkError && expiredInvite) {
          return NextResponse.json(
            { error: `This invitation has already been ${expiredInvite.status}` },
            { status: 410 }
          )
        }
        
        return NextResponse.json(
          { error: 'Invalid or expired invitation' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: 'Failed to fetch invitation details' },
        { status: 500 }
      )
    }

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found or already used' },
        { status: 404 }
      )
    }

    // Verify the invitation is for the current user
    if (invitation.email !== user.email) {
      return NextResponse.json(
        { error: 'This invitation is for a different email address' },
        { status: 403 }
      )
    }

    // Create a service role client to verify the email if needed
    const serviceClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
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

    // If the user isn't email verified, verify them since they have a valid invitation
    if (!user.email_confirmed_at) {
      const { error: updateError } = await serviceClient.auth.admin.updateUserById(
        user.id,
        { email_confirm: true }
      )

      if (updateError) {
        console.error('Error verifying user:', updateError)
        return NextResponse.json(
          { error: 'Failed to verify email' },
          { status: 500 }
        )
      }
    }

    // Check if user is already a member
    const { data: existingMember, error: memberCheckError } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('team_id', invitation.team_id)
      .eq('user_id', user.id)
      .single()

    if (memberCheckError && memberCheckError.code !== 'PGRST116') {
      console.error('Error checking team membership:', memberCheckError)
      return NextResponse.json(
        { error: 'Failed to check team membership' },
        { status: 500 }
      )
    }

    if (existingMember) {
      // Update invitation status since user is already a member
      await supabase
        .from('team_invites')
        .update({ status: 'accepted' })
        .eq('id', params.invitationId)

      return NextResponse.json(
        { success: true, teamId: invitation.team_id, message: 'You are already a member of this team' }
      )
    }

    // Create user profile if it doesn't exist
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (profileError && profileError.code === 'PGRST116') {
      // Profile doesn't exist, create it
      const { error: createProfileError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: user.id,
          name: user.user_metadata?.full_name || user.email
        })

      if (createProfileError) {
        console.error('Error creating user profile:', createProfileError)
        return NextResponse.json(
          { error: 'Failed to create user profile' },
          { status: 500 }
        )
      }
    }

    // Add user to team
    const { error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id: invitation.team_id,
        user_id: user.id,
        role: 'member'
      })

    if (memberError) {
      console.error('Error adding team member:', memberError)
      if (memberError.code === '23505') { // Unique violation
        // Update invitation status since user is already a member
        await supabase
          .from('team_invites')
          .update({ status: 'accepted' })
          .eq('id', params.invitationId)

        return NextResponse.json(
          { success: true, teamId: invitation.team_id, message: 'You are already a member of this team' }
        )
      }
      return NextResponse.json(
        { error: 'Failed to add you to the team' },
        { status: 500 }
      )
    }

    // Update invitation status
    const { error: updateError } = await supabase
      .from('team_invites')
      .update({ status: 'accepted' })
      .eq('id', params.invitationId)

    if (updateError) {
      console.error('Error updating invitation:', updateError)
      // Don't throw here since the user was added to the team
      // Just log the error and continue
    }

    return NextResponse.json({ success: true, teamId: invitation.team_id })
  } catch (error) {
    console.error('Error accepting invitation:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to accept invitation' },
      { status: 500 }
    )
  }
} 