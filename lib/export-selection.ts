import type { MindMap } from '../types';

/** Export only explicit selection. A selected node becomes a root when its parent was not selected. */
export function selectionForExport(map: MindMap, ids: string[]): MindMap {
  const selected = new Set(ids);
  const nodes = map.nodes.filter(node => selected.has(node.id)).map(node => ({ ...node, parentId: node.parentId && selected.has(node.parentId) ? node.parentId : null }));
  return {
    ...map,
    title: `${map.title} — seleção`,
    shareToken: null,
    nodes,
    relationships: map.relationships?.filter(link => selected.has(link.source) && selected.has(link.target)),
    boundaryGroups: map.boundaryGroups?.map(group => ({ ...group, nodeIds: group.nodeIds.filter(id => selected.has(id)) })).filter(group => group.nodeIds.length > 0),
  };
}
