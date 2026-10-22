import { requireUser } from '../../../../lib/supabase/server';
import { fromRow, validMap, type MapRow } from '../../../../lib/server-maps';

type Context = { params: Promise<{ id: string }> };
const missing = () => Response.json({ error: 'Mapa não encontrado.' }, { status: 404 });

export async function PUT(request: Request, context: Context) {
  const { client, user } = await requireUser();
  if (!user) return Response.json({ error: 'Não autorizado.' }, { status: 401 });
  const { id } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  if (!validMap(body) || body.id !== id) return Response.json({ error: 'Mapa inválido.' }, { status: 400 });
  const { data, error } = await client.from('mind_maps').update({ title: body.title, content: body, updated_at: new Date().toISOString() }).eq('id', id).eq('owner_id', user.id).select('id,title,content,share_token,updated_at').maybeSingle();
  if (error) return Response.json({ error: 'Não foi possível salvar o mapa.' }, { status: 500 });
  if (!data) return missing();
  return Response.json({ map: fromRow(data as MapRow) });
}

export async function DELETE(_request: Request, context: Context) {
  const { client, user } = await requireUser();
  if (!user) return Response.json({ error: 'Não autorizado.' }, { status: 401 });
  const { id } = await context.params;
  const { data, error } = await client.from('mind_maps').delete().eq('id', id).eq('owner_id', user.id).select('id').maybeSingle();
  if (error) return Response.json({ error: 'Não foi possível excluir o mapa.' }, { status: 500 });
  if (!data) return missing();
  return Response.json({ ok: true });
}

export async function POST(_request: Request, context: Context) {
  const { client, user } = await requireUser();
  if (!user) return Response.json({ error: 'Não autorizado.' }, { status: 401 });
  const { id } = await context.params;
  const { data: existing, error: readError } = await client.from('mind_maps').select('id,title,content,share_token,updated_at').eq('id', id).eq('owner_id', user.id).maybeSingle();
  if (readError) return Response.json({ error: 'Não foi possível compartilhar o mapa.' }, { status: 500 });
  if (!existing) return missing();
  if (existing.share_token) return Response.json({ shareToken: existing.share_token, map: fromRow(existing as MapRow) });
  const { data, error } = await client.from('mind_maps').update({ share_token: crypto.randomUUID() }).eq('id', id).eq('owner_id', user.id).select('id,title,content,share_token,updated_at').single();
  if (error || !data) return Response.json({ error: 'Não foi possível compartilhar o mapa.' }, { status: 500 });
  return Response.json({ shareToken: data.share_token, map: fromRow(data as MapRow) });
}
