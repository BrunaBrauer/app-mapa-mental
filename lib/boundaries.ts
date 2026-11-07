import type { MindMap } from '../types';

export type BoundarySelection = { kind: 'node' | 'group'; id: string };

export function boundaryTagIds(map: MindMap, selection: BoundarySelection): string[] {
  if (selection.kind === 'group') return map.boundaryGroups?.find(group => group.id === selection.id)?.tagIds || [];
  return map.nodes.find(node => node.id === selection.id && node.boundary)?.boundaryTagIds || [];
}

export function boundaryExists(map: MindMap, selection: BoundarySelection): boolean {
  return selection.kind === 'group'
    ? Boolean(map.boundaryGroups?.some(group => group.id === selection.id))
    : Boolean(map.nodes.some(node => node.id === selection.id && node.boundary));
}

export function removeBoundary(map: MindMap, selection: BoundarySelection): MindMap {
  if (!boundaryExists(map, selection)) return map;
  return selection.kind === 'group'
    ? { ...map, boundaryGroups: map.boundaryGroups?.filter(group => group.id !== selection.id) }
    : { ...map, nodes: map.nodes.map(node => node.id === selection.id ? { ...node, boundary: false, boundaryTagIds: undefined } : node) };
}

export function setBoundaryTag(map: MindMap, selection: BoundarySelection, tagId: string, enabled: boolean): MindMap {
  if (!boundaryExists(map, selection)) return map;
  const update = (ids?: string[]) => enabled ? [...new Set([...(ids || []), tagId])] : (ids || []).filter(id => id !== tagId);
  return selection.kind === 'group'
    ? { ...map, boundaryGroups: map.boundaryGroups?.map(group => group.id === selection.id ? { ...group, tagIds: update(group.tagIds) } : group) }
    : { ...map, nodes: map.nodes.map(node => node.id === selection.id ? { ...node, boundaryTagIds: update(node.boundaryTagIds) } : node) };
}
