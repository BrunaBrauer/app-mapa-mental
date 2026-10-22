import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { requireSupabaseConfig } from './config';

export async function createClient() {
  const { url, key } = requireSupabaseConfig();
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(items) {
        try { items.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
        catch { /* Server Components cannot write cookies; proxy.ts refreshes the session. */ }
      },
    },
  });
}

export async function requireUser() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  return { client, user: error ? null : user };
}
