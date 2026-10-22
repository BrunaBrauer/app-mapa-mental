import { getSharedMap } from '../../../../lib/shared-map';

type Context = { params: Promise<{ token: string }> };
export async function GET(_request: Request, context: Context) {
  const { token } = await context.params;
  const map = await getSharedMap(token);
  if (!map) return Response.json({ error: 'Mapa não encontrado.' }, { status: 404 });
  return Response.json({ map });
}
