create table if not exists public.mind_maps (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) <= 160),
  content jsonb not null,
  share_token uuid unique,
  updated_at timestamptz not null default now()
);

create index if not exists mind_maps_owner_updated_idx on public.mind_maps(owner_id, updated_at desc);
alter table public.mind_maps enable row level security;

create policy "Owners can read maps" on public.mind_maps for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Owners can create maps" on public.mind_maps for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "Owners can update maps" on public.mind_maps for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Owners can delete maps" on public.mind_maps for delete to authenticated using ((select auth.uid()) = owner_id);

-- Shared maps use an unguessable token; anonymous users cannot enumerate the table.
create or replace function public.get_shared_map(p_token uuid)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object('id', id, 'title', title, 'content', content, 'updated_at', updated_at)
  from public.mind_maps
  where share_token = p_token
  limit 1;
$$;
revoke all on function public.get_shared_map(uuid) from public;
grant execute on function public.get_shared_map(uuid) to anon, authenticated;
