-- Organizacao privada por usuario. O conteudo guarda projetos, pastas, etiquetas e metadados dos arquivos.
create table if not exists public.user_workspaces (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  content jsonb not null default '{"version":1,"projects":[],"folders":[],"tags":[],"files":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_workspaces enable row level security;
grant select, insert, update, delete on public.user_workspaces to authenticated;

create policy "workspace_select_own" on public.user_workspaces
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "workspace_insert_own" on public.user_workspaces
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "workspace_update_own" on public.user_workspaces
  for update to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- Bucket privado: apenas arquivos sob o prefixo do proprio UUID do usuario.
insert into storage.buckets (id, name, public, file_size_limit)
values ('workspace-files', 'workspace-files', false, 26214400)
on conflict (id) do nothing;

create policy "workspace_file_select_own" on storage.objects
  for select to authenticated using (
    bucket_id = 'workspace-files' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "workspace_file_insert_own" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'workspace-files' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "workspace_file_delete_own" on storage.objects
  for delete to authenticated using (
    bucket_id = 'workspace-files' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
