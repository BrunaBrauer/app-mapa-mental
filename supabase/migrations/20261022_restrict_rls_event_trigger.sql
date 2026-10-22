-- This managed event-trigger function should not be callable through the public Data API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
