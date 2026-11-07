import { redirect } from 'next/navigation';
import { requireUser } from '../../lib/supabase/server';
import { normalizePreferences } from '../../lib/preferences';
import Dashboard from '../../components/Dashboard';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  if (process.env.NEXT_PUBLIC_STORAGE_MODE !== 'cloud') return <Dashboard userName="Você" initialDark={false}/>;
  const { user } = await requireUser();
  if (!user) redirect('/login');
  return <Dashboard userName={user.user_metadata?.full_name || user.email || 'Você'} initialDark={normalizePreferences(user.user_metadata?.nodum_preferences).dark}/>;
}
