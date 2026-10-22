import { redirect } from 'next/navigation';
import { requireUser } from '../lib/supabase/server';
import Editor from '../components/Editor';
export const dynamic = 'force-dynamic';
export default async function Home() {
  if (process.env.NEXT_PUBLIC_STORAGE_MODE !== 'cloud') return <Editor userName="Você" signOutPath="/" />;
  const { user } = await requireUser();
  if (!user) redirect('/login');
  return <Editor userName={user.user_metadata?.full_name || user.email || 'Você'} signOutPath="/auth/signout" />;
}
