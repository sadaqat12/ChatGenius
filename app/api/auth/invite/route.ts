import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { email, invitationId, name } = await request.json()

    // Create Supabase client with service role key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Send invite email
    const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: {
        name,
        invitationId,
      },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    })

    if (inviteError) throw inviteError

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error inviting user:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to invite user' },
      { status: 500 }
    )
  }
} 