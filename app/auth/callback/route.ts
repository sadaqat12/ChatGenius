import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import * as jose from 'jose'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const searchParams = requestUrl.searchParams
  const cookieStore = cookies()
  
  // Log full URL and referrer for debugging
  console.log('Auth callback details:', {
    url: request.url,
    referrer: request.headers.get('referer'),
    params: Object.fromEntries(searchParams.entries())
  })

  // If we're getting redirected from Supabase's verify endpoint OR
  // this is a direct hit to the callback URL (might have hash params)
  if (request.headers.get('referer')?.includes('supabase.co/auth/v1/verify') || 
      !searchParams.has('code')) {
    // Return HTML that will handle the hash parameters client-side
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <script>
            // Log the full URL and hash for debugging
            console.log('Processing callback URL:', window.location.href);
            console.log('URL hash:', window.location.hash);
            
            // Extract hash parameters
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            console.log('Hash parameters:', Object.fromEntries(hashParams.entries()));
            
            const error = hashParams.get('error');
            const errorDescription = hashParams.get('error_description');
            console.log('Error details:', { error, errorDescription });
            
            if (error) {
              // If there's an error, redirect to login with the error
              const loginUrl = '/login?error=' + encodeURIComponent(errorDescription || error);
              console.log('Redirecting to:', loginUrl);
              window.location.href = loginUrl;
            } else {
              // Otherwise check for access_token/refresh_token
              const accessToken = hashParams.get('access_token');
              const refreshToken = hashParams.get('refresh_token');
              console.log('Token check:', { hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken });
              
              if (accessToken && refreshToken) {
                // Set up the session using cookies
                fetch('/auth/callback', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    access_token: accessToken,
                    refresh_token: refreshToken
                  })
                }).then(response => {
                  if (response.ok) {
                    // Get invite ID from the JWT if present
                    try {
                      const payload = JSON.parse(atob(accessToken.split('.')[1]));
                      const teamId = payload.user_metadata?.team_id;
                      const isNewUser = !payload.user_metadata?.has_set_password;
                      
                      if (isNewUser) {
                        console.log('New user, redirecting to set password');
                        window.location.href = '/auth/set-password?team=' + teamId;
                      } else if (teamId) {
                        console.log('Found team ID, redirecting to invite page');
                        window.location.href = '/invite?team=' + teamId;
                      } else {
                        console.log('No team ID found, redirecting to home');
                        window.location.href = '/';
                      }
                    } catch (e) {
                      console.error('Error parsing JWT:', e);
                      window.location.href = '/';
                    }
                  } else {
                    console.error('Failed to set up session');
                    window.location.href = '/login';
                  }
                }).catch(err => {
                  console.error('Error setting up session:', err);
                  window.location.href = '/login';
                });
              } else {
                // No tokens found, redirect to login
                console.log('No tokens found, redirecting to login');
                window.location.href = '/login';
              }
            }
          </script>
        </head>
        <body>
          Processing authentication...
        </body>
      </html>
    `, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-store'
      }
    })
  }

  // If this is a direct hit with a code, exchange it
  const code = searchParams.get('code')
  if (code) {
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) throw error
      
      return NextResponse.redirect(new URL('/', requestUrl.origin))
    } catch (error: any) {
      console.error('Auth error:', error)
      const message = error instanceof Error ? error.message : 'Authentication failed'
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, requestUrl.origin))
    }
  }

  // No auth parameters, redirect to login
  return NextResponse.redirect(new URL('/login', requestUrl.origin))
}

export async function POST(request: Request) {
  try {
    const { access_token, refresh_token } = await request.json()
    
    // Create Supabase client
    const supabase = createRouteHandlerClient({ cookies })
    
    // Set the session
    const { data: { session }, error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token
    })
    
    if (sessionError) {
      console.error('Error setting session:', sessionError)
      return Response.json({ error: 'Failed to set session' }, { status: 500 })
    }

    // Get team ID from JWT payload
    const payload = JSON.parse(Buffer.from(access_token.split('.')[1], 'base64').toString())
    const teamId = payload.user_metadata?.team_id

    if (teamId) {
      // Set invite data in user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          invite_data: {
            team_id: teamId,
            invite_type: 'team'
          }
        }
      })

      if (updateError) {
        console.error('Error updating user metadata:', updateError)
        return Response.json({ error: 'Failed to update user metadata' }, { status: 500 })
      }
    }

    // Check if user has set password
    const hasSetPassword = session?.user?.user_metadata?.has_set_password

    // Return the appropriate redirect URL
    if (!hasSetPassword) {
      return Response.json({ redirectTo: `/auth/set-password${teamId ? `?team=${teamId}` : ''}` })
    } else if (teamId) {
      return Response.json({ redirectTo: `/invite` })
    } else {
      return Response.json({ redirectTo: '/teams' })
    }
  } catch (error) {
    console.error('Error in callback POST:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
} 