import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    // Check password
    if (password === 'ZestFulcrum') {
      const response = NextResponse.json({ success: true });

      // Set cookie for data room access
      response.cookies.set('data-room-auth', 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 24 hours
        path: '/',
      });

      return response;
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid password' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Data room auth error:', error);
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });

  // Clear the data room auth cookie
  response.cookies.delete('data-room-auth');

  return response;
}
