import type { MindMap, TagDefinition } from '../types';

export type Project = { id: string; name: string; createdAt: number };
export type Folder = { id: string; projectId: string; parentId: string | null; name: string; createdAt: number };
export type WorkspaceFile = { id: string; projectId?: string; folderId?: string; name: string; mime: string; size: number; storagePath: string; createdAt: number };
export type Workspace = { version: 1; projects: Project[]; folders: Folder[]; tags: TagDefinition[]; files: WorkspaceFile[] };
export const emptyWorkspace = (): Workspace => ({ version: 1, projects: [], folders: [], tags: [], files: [] });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const title = (value: unknown) => typeof value === 'string' && value.trim().length > 0 && value.length <= 100;
const date = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export function normalizeWorkspace(value: unknown): Workspace {
  if (!record(value)) return emptyWorkspace();
  return { version: 1, projects: Array.isArray(value.projects) ? value.projects as Project[] : [], folders: Array.isArray(value.folders) ? value.folders as Folder[] : [], tags: Array.isArray(value.tags) ? value.tags as TagDefinition[] : [], files: Array.isArray(value.files) ? value.files as WorkspaceFile[] : [] };
}

export function validWorkspace(value: unknown): value is Workspace {
  if (!record(value) || value.version !== 1 || !Array.isArray(value.projects) || !Array.isArray(value.folders) || !Array.isArray(value.tags) || !Array.isArray(value.files)) return false;
  if (value.projects.length > 100 || value.folders.length > 1000 || value.tags.length > 200 || value.files.length > 2000) return false;
  if (!value.projects.every(project => record(project) && typeof project.id === 'string' && uuid.test(project.id) && title(project.name) && date(project.createdAt))) return false;
  if (!value.folders.every(folder => record(folder) && typeof folder.id === 'string' && uuid.test(folder.id) && typeof folder.projectId === 'string' && uuid.test(folder.projectId) && (folder.parentId === null || typeof folder.parentId === 'string' && uuid.test(folder.parentId)) && title(folder.name) && date(folder.createdAt))) return false;
  if (!value.tags.every(tag => record(tag) && typeof tag.id === 'string' && uuid.test(tag.id) && title(tag.name) && typeof tag.color === 'string' && /^#[0-9a-f]{6}$/i.test(tag.color))) return false;
  if (!value.files.every(file => record(file) && typeof file.id === 'string' && uuid.test(file.id) && (file.projectId === undefined || typeof file.projectId === 'string' && uuid.test(file.projectId)) && (file.folderId === undefined || typeof file.folderId === 'string' && uuid.test(file.folderId)) && title(file.name) && typeof file.mime === 'string' && file.mime.length <= 150 && typeof file.size === 'number' && Number.isSafeInteger(file.size) && file.size >= 0 && file.size <= 25 * 1024 * 1024 && typeof file.storagePath === 'string' && /^[-\w/]+$/.test(file.storagePath) && file.storagePath.length <= 200 && date(file.createdAt))) return false;
  const projects = value.projects as Project[], folders = value.folders as Folder[], tags = value.tags as TagDefinition[], files = value.files as WorkspaceFile[];
  if (new Set(projects.map(project => project.id)).size !== projects.length || new Set(folders.map(folder => folder.id)).size !== folders.length || new Set(tags.map(tag => tag.id)).size !== tags.length || new Set(files.map(file => file.id)).size !== files.length) return false;
  const projectIds = new Set(projects.map(project => project.id));
  const byFolder = new Map(folders.map(folder => [folder.id, folder]));
  for (const folder of folders) {
    if (!projectIds.has(folder.projectId)) return false;
    const seen = new Set([folder.id]); let parentId = folder.parentId;
    while (parentId) {
      if (seen.has(parentId)) return false;
      seen.add(parentId);
      const parent = byFolder.get(parentId);
      if (!parent || parent.projectId !== folder.projectId) return false;
      parentId = parent.parentId;
    }
  }
  if (files.some(file => file.projectId && !projectIds.has(file.projectId) || file.folderId && byFolder.get(file.folderId)?.projectId !== file.projectId)) return false;
  return true;
}

export function folderTreeIds(folders: Folder[], folderId: string): Set<string> {
  const ids = new Set([folderId]);
  for (let count = 0; count < folders.length; count++) {
    let changed = false;
    for (const folder of folders) if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) { ids.add(folder.id); changed = true; }
    if (!changed) break;
  }
  return ids;
}

export function mapHasTag(map: MindMap, tagId: string): boolean {
  return map.nodes.some(node => node.tagIds?.includes(tagId) || node.boundaryTagIds?.includes(tagId))
    || Boolean(map.boundaryGroups?.some(group => group.tagIds?.includes(tagId)));
}

export function projectCounts(workspace: Workspace, maps: MindMap[], projectId: string) {
  return { folders: workspace.folders.filter(folder => folder.projectId === projectId).length, files: maps.filter(map => map.projectId === projectId).length + workspace.files.filter(file => file.projectId === projectId).length };
}
