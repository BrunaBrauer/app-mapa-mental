import { requireUser } from '../../../lib/supabase/server';
import { fromRow, validMap, type MapRow } from '../../../lib/server-maps';

export async function GET() {
  const { client, user } = await requireUser();
  if (!user) return Response.json({ error: 'Entre para ver seus mapas.' }, { status: 401 });
  const { data, error } = await client.from('mind_maps').select('id,title,content,share_token,updated_at').eq('owner_id', user.id).order('updated_at', { ascending: false });
  if (error) return Response.json({ error: 'Não foi possível carregar os mapas.' }, { status: 500 });
  return Response.json({ maps: (data as MapRow[]).map(fromRow) });
}

export async function POST(request: Request) {
  const { client, user } = await requireUser();
  if (!user) return Response.json({ error: 'Entre para salvar mapas.' }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  if (!validMap(body)) return Response.json({ error: 'Mapa inválido.' }, { status: 400 });
  const { data, error } = await client.from('mind_maps').insert({ id: body.id, owner_id: user.id, title: body.title, content: body }).select('id,title,content,share_token,updated_at').single();
  if (error || !data) return Response.json({ error: 'Não foi possível criar o mapa.' }, { status: 500 });
  return Response.json({ map: fromRow(data as MapRow) }, { status: 201 });
}
