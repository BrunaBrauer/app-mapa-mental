drop function if exists public.get_shared_map(uuid);

grant select on table public.mind_maps to anon;
grant select, insert, update, delete on table public.mind_maps to authenticated;

-- PostgREST exposes request headers to RLS. A random share token only reveals its own map.
create policy "Token holders can read shared maps"
on public.mind_maps for select to anon
using (
  share_token is not null
  and share_token::text = (select current_setting('request.headers', true)::jsonb ->> 'x-share-token')
);
