import { requireUser } from '../../../lib/supabase/server';
import { emptyWorkspace, normalizeWorkspace, validWorkspace } from '../../../lib/workspace';

export async function GET() {
  const { client, user } = await requireUser();
  if (!user) return Response.json({ error: 'Entre para ver sua organização.' }, { status: 401 });
  const { data, error } = await client.from('user_workspaces').select('content').eq('owner_id', user.id).maybeSingle();
  if (error) return Response.json({ error: 'Não foi possível carregar os projetos.' }, { status: 500 });
  const workspace = data?.content ? normalizeWorkspace(data.content) : emptyWorkspace();
  return Response.json({ workspace: validWorkspace(workspace) ? workspace : emptyWorkspace() });
}

export async function PUT(request: Request) {
  const { client, user } = await requireUser();
  if (!user) return Response.json({ error: 'Entre para organizar seus arquivos.' }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  if (!validWorkspace(body)) return Response.json({ error: 'Organização inválida.' }, { status: 400 });
  const { error } = await client.from('user_workspaces').upsert({ owner_id: user.id, content: body, updated_at: new Date().toISOString() }, { onConflict: 'owner_id' });
  if (error) return Response.json({ error: 'Não foi possível salvar a organização.' }, { status: 500 });
  return Response.json({ workspace: body });
}
