import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  try {
    // If this is a Supabase auth callback, let it through
    if (req.nextUrl.pathname === '/auth/callback') {
      const requestUrl = new URL(req.url);
      const code = requestUrl.searchParams.get('code');
      const token = requestUrl.searchParams.get('token');
      const type = requestUrl.searchParams.get('type');

      // If we have auth parameters, let the callback handle it
      if (code || (token && type === 'invite')) {
        return res;
      }
    }

    // Get session state - only check once
    const { data: { session } } = await supabase.auth.getSession();

    // Handle auth routes
    if (session && ['/login', '/signup'].includes(req.nextUrl.pathname)) {
      return NextResponse.redirect(new URL('/teams', req.url));
    }

    // Handle protected routes
    const isAuthRoute = ['/login', '/signup', '/auth', '/reset-password', '/update-password'].some(path => req.nextUrl.pathname.startsWith(path));
    if (!session && !isAuthRoute) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    return res;
  } catch (error) {
    console.error('Middleware error:', error);
    // On error, redirect to login
    return NextResponse.redirect(new URL('/login', req.url));
  }
}

// Add a matcher to ensure middleware runs on all relevant routes
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
} 