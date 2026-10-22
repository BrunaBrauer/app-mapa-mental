import { createClient } from '@supabase/supabase-js';
import { requireSupabaseConfig } from './supabase/config';
import { fromRow, type MapRow } from './server-maps';

export async function getSharedMap(token: string) {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const { url, key } = requireSupabaseConfig();
  // This client is request-scoped and anonymous, so only the token policy can reveal a row.
  const client = createClient(url, key, { global: { headers: { 'x-share-token': token } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.from('mind_maps').select('id,title,content,updated_at').eq('share_token', token).maybeSingle();
  if (error || !data) return null;
  const map = fromRow(data as MapRow);
  delete map.shareToken;
  return map;
}
