import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (code) {
    const client = await createClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) {
      const next = url.searchParams.get('next') || '/';
      let destination = new URL('/', url.origin);
      if (next.startsWith('/') && !next.startsWith('//')) {
        try {
          const requested = new URL(next, url.origin);
          if (requested.origin === url.origin) destination = requested;
        } catch { /* Invalid return URLs fall back to the home page. */ }
      }
      return NextResponse.redirect(destination);
    }
  }
  return NextResponse.redirect(new URL('/login?error=auth', url.origin));
}
