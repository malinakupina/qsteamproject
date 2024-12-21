

import { NextResponse } from 'next/server';
import cookie from 'cookie';

export function middleware(req) {
  const { method } = req;
  const { cookies } = req;
  
  if (method === 'POST') {
    const response = NextResponse.json({ message: 'Login success' });
    
    // Postavljanje kolačića sa tokenom
    response.cookies.set('token', 'your-session-token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24,
      path: '/',
    });
    
    return response;
  }

  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
