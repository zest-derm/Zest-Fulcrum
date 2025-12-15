import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/api/auth/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check for main auth cookie
  const authCookie = request.cookies.get('zest-auth');

  if (authCookie?.value !== 'authenticated') {
    // Redirect to login page
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Additional check for data room routes
  if (pathname.startsWith('/data-room') || pathname.startsWith('/api/data-room/analytics')) {
    const dataRoomAuth = request.cookies.get('data-room-auth');

    if (dataRoomAuth?.value !== 'authenticated') {
      // Redirect to data room page (which will show password prompt)
      if (pathname.startsWith('/api/data-room/analytics')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      // For the page itself, allow through so it can show the password prompt
      if (pathname === '/data-room') {
        return NextResponse.next();
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
