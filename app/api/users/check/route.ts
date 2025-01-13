import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')

  if (!email) {
    return NextResponse.json(
      { error: 'Email is required' },
      { status: 400 }
    )
  }

  const cookieStore = cookies()
  const supabase = createServerClient(
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

  try {
    // Check if user exists in auth.users
    const { data: { users }, error: adminError } = await supabase.auth.admin.listUsers()
    if (adminError) {
      console.error('Error listing users:', adminError)
      return NextResponse.json(
        { error: 'Failed to check user' },
        { status: 500 }
      )
    }

    // Find the user with matching email
    const user = users.find(u => u.email === email)
    if (!user) {
      // User doesn't exist at all - they need to sign up
      return NextResponse.json({ exists: false, hasProfile: false })
    }

    // Check if they have a profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (profileError && profileError.code === 'PGRST116') {
      // User exists but no profile - they need to complete signup
      return NextResponse.json({ exists: true, hasProfile: false })
    }

    if (profileError) {
      console.error('Error checking profile:', profileError)
      return NextResponse.json(
        { error: 'Failed to check profile' },
        { status: 500 }
      )
    }

    // User exists and has a profile
    return NextResponse.json({ exists: true, hasProfile: true })
  } catch (error) {
    console.error('Error checking user:', error)
    return NextResponse.json(
      { error: 'Failed to check user' },
      { status: 500 }
    )
  }
} 