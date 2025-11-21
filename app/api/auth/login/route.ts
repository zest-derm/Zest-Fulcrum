import { NextRequest, NextResponse } from 'next/server';

const VALID_PASSWORD = 'ZestRules';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (password === VALID_PASSWORD) {
      const response = NextResponse.json({ success: true });

      // Set a cookie that expires in 7 days
      response.cookies.set('zest-auth', 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });

      return response;
    }

    return NextResponse.json(
      { error: 'Invalid password' },
      { status: 401 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
