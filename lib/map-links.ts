import type { MindMap } from '../types';

/** Links are stable map IDs stored on the source node; target maps remain independent. */
export function updateNodeMapLink(map: MindMap, nodeId: string, targetId: string, linked: boolean): MindMap {
  if (targetId === map.id || !map.nodes.some(node => node.id === nodeId)) return map;
  const nodes = map.nodes.map(node => {
    if (node.id !== nodeId) return node;
    const ids = node.linkedMapIds || [];
    const nextIds = linked ? ids.includes(targetId) || ids.length >= 20 ? ids : [...ids, targetId] : ids.filter(id => id !== targetId);
    return nextIds === ids || nextIds.length === ids.length && nextIds.every((id, index) => id === ids[index])
      ? node : { ...node, linkedMapIds: nextIds.length ? nextIds : undefined };
  });
  return nodes.every((node, index) => node === map.nodes[index]) ? map : { ...map, nodes };
}

export function mapLinksForNode(map: MindMap, nodeId: string, ownedMaps: MindMap[]) {
  const node = map.nodes.find(item => item.id === nodeId);
  const byId = new Map(ownedMaps.map(item => [item.id, item]));
  return (node?.linkedMapIds || []).map(id => ({ id, map: byId.get(id) }));
}
