import { notFound } from 'next/navigation';
import { getSharedMap } from '../../../lib/shared-map';
import ShareViewer from '../../../components/ShareViewer';
import LocalShare from '../../../components/LocalShare';
export const dynamic = 'force-dynamic';
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (process.env.NEXT_PUBLIC_STORAGE_MODE !== 'cloud') return <LocalShare token={token}/>;
  const map = await getSharedMap(token);
  if (!map) notFound();
  return <ShareViewer map={map}/>;
}
