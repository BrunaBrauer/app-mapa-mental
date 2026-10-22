export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pzhsmwhoefxoedoamdao.supabase.co';
export const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

export function requireSupabaseConfig() {
  if (!supabasePublishableKey) throw new Error('Configure NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY no ambiente.');
  return { url: supabaseUrl, key: supabasePublishableKey };
}
