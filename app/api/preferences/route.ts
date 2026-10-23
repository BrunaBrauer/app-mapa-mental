import { requireUser } from '../../../lib/supabase/server';
import { defaultPreferences, normalizePreferences } from '../../../lib/preferences';

export async function PUT(request: Request) {
  const { client, user } = await requireUser();
  if (!user) return Response.json({ error: 'Entre para salvar suas preferências.' }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Object.keys(defaultPreferences).some(key => typeof (body as Record<string, unknown>)[key] !== 'boolean')) return Response.json({ error: 'Preferências inválidas.' }, { status: 400 });
  const preferences = normalizePreferences(body);
  // These are display preferences only, never authorization claims.
  const { data, error } = await client.auth.updateUser({ data: { nodum_preferences: preferences } });
  if (error || !data.user) return Response.json({ error: 'Não foi possível salvar suas preferências.' }, { status: 500 });
  return Response.json({ preferences: normalizePreferences(data.user.user_metadata.nodum_preferences) });
}
