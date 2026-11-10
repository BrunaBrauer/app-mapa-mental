import type { MindMap } from '../types';
import type { MapSortMode, Workspace } from './workspace';

export const mapScopeKey = (projectId?: string | null, folderId?: string | null) => folderId ? `f:${folderId}` : projectId ? `p:${projectId}` : 'unfiled';
export const mapSortMode = (workspace: Workspace, projectId?: string | null, folderId?: string | null): MapSortMode => workspace.mapViews?.[mapScopeKey(projectId, folderId)]?.mode || 'asc';

export function sortScopeMaps(workspace: Workspace, maps: MindMap[], projectId?: string | null, folderId?: string | null): MindMap[] {
  const view = workspace.mapViews?.[mapScopeKey(projectId, folderId)];
  const mode = view?.mode || 'asc';
  const result = [...maps];
  if (mode === 'custom') {
    const position = new Map((view?.order || []).map((id, index) => [id, index]));
    return result.sort((a, b) => (position.get(a.id) ?? Infinity) - (position.get(b.id) ?? Infinity) || a.title.localeCompare(b.title, 'pt-BR') || a.id.localeCompare(b.id));
  }
  return result.sort((a, b) => (mode === 'asc' ? 1 : -1) * a.title.localeCompare(b.title, 'pt-BR') || a.id.localeCompare(b.id));
}

export function setScopeSort(workspace: Workspace, maps: MindMap[], projectId: string | null, folderId: string | null, mode: MapSortMode): Workspace {
  const key = mapScopeKey(projectId, folderId);
  const current = workspace.mapViews?.[key];
  const order = mode === 'custom' && !current?.order.length ? sortScopeMaps(workspace, maps, projectId, folderId).map(map => map.id) : current?.order || [];
  return { ...workspace, mapViews: { ...workspace.mapViews, [key]: { mode, order } } };
}

export function moveScopeMap(workspace: Workspace, maps: MindMap[], projectId: string | null, folderId: string | null, sourceId: string, targetId: string): Workspace {
  if (mapSortMode(workspace, projectId, folderId) !== 'custom' || sourceId === targetId) return workspace;
  const ordered = sortScopeMaps(workspace, maps, projectId, folderId).map(map => map.id);
  if (!ordered.includes(sourceId) || !ordered.includes(targetId)) return workspace;
  ordered.splice(ordered.indexOf(sourceId), 1);
  ordered.splice(ordered.indexOf(targetId), 0, sourceId);
  const key = mapScopeKey(projectId, folderId);
  return { ...workspace, mapViews: { ...workspace.mapViews, [key]: { mode: 'custom', order: ordered } } };
}
