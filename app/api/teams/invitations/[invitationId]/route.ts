import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(
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
    // Get the invitation details
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
      console.error('Database error fetching invitation:', inviteError)
      // Check if it's a "no rows" error
      if (inviteError.code === 'PGRST116') {
        // Try to find the invitation without status filter to give better error message
        const { data: expiredInvite, error: checkError } = await supabase
          .from('team_invites')
          .select('status, email')
          .eq('id', params.invitationId)
          .single()

        if (checkError) {
          return NextResponse.json(
            { error: 'Invalid or expired invitation' },
            { status: 404 }
          )
        }

        if (expiredInvite) {
          return NextResponse.json(
            { error: `This invitation has already been ${expiredInvite.status}` },
            { status: 410 }
          )
        }
      }
      
      return NextResponse.json(
        { error: 'Invalid or expired invitation' },
        { status: 404 }
      )
    }

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      )
    }

    if (!invitation.team) {
      return NextResponse.json(
        { error: 'Invalid invitation: Team not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(invitation)
  } catch (error) {
    console.error('Error fetching invitation:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch invitation' },
      { status: 500 }
    )
  }
} 