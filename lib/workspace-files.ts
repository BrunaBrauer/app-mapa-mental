'use client';
import { createClient } from './supabase/client';
import type { WorkspaceFile } from './workspace';

const BUCKET = 'workspace-files';
export async function uploadWorkspaceFile(file: File, projectId: string, folderId?: string): Promise<WorkspaceFile> {
  if (!file.name.trim() || file.name.length > 100 || file.size > 25 * 1024 * 1024) throw new Error('Use um arquivo com nome de até 100 caracteres e tamanho de até 25 MB.');
  const client = createClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) throw new Error('Entre na sua conta para enviar arquivos.');
  const id = crypto.randomUUID(), storagePath = `${user.id}/${id}`;
  const { error } = await client.storage.from(BUCKET).upload(storagePath, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
  if (error) throw new Error(`Falha no envio: ${error.message}`);
  return { id, projectId, folderId, name: file.name, mime: file.type || 'application/octet-stream', size: file.size, storagePath, createdAt: Date.now() };
}

export async function downloadWorkspaceFile(file: WorkspaceFile) {
  const { data, error } = await createClient().storage.from(BUCKET).download(file.storagePath);
  if (error || !data) throw new Error('Não foi possível baixar o arquivo.');
  const url = URL.createObjectURL(data); const link = document.createElement('a'); link.href = url; link.download = file.name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function removeWorkspaceFile(file: WorkspaceFile) {
  const { error } = await createClient().storage.from(BUCKET).remove([file.storagePath]);
  if (error) throw new Error('Não foi possível remover o arquivo armazenado.');
}
