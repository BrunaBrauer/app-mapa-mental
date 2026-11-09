import type { MindMap, MindNode } from '../types';
import type { NodeDimensions } from './movement';
import { layoutSize } from './maps';
import { markStyleOverrides, sizeLimits } from './visual-standardization';

export function resizeNodeGroup(map: MindMap, ids: string[], dx: number, dy: number, measured?: NodeDimensions, final = false): MindMap {
  const selected = new Set(ids);
  const group = map.nodes.filter(node => selected.has(node.id));
  if (group.length < 2) return map;
  if (!dx && !dy) return map;
  const axis = Math.abs(dx) >= Math.abs(dy) ? 'width' : 'height';
  const delta = axis === 'width' ? dx : dy;
  const resizable = group.filter(node => !node.sizeLocked);
  if (!resizable.length) return map;
  // Apply the same absolute delta to each current size. Nodes with different
  // dimensions keep that difference unless an individual limit is reached.
  const nodes = map.nodes.map(node => {
    if (!selected.has(node.id) || node.sizeLocked) return node;
    const base = measured?.get(node.id) || layoutSize(node);
    const limits = sizeLimits(node);
    const size = Math.max(axis === 'width' ? limits.minWidth : limits.minHeight, Math.min(axis === 'width' ? limits.maxWidth : limits.maxHeight, Math.round(base[axis] + delta)));
    if (size === Math.round(base[axis])) return node;
    const patch: Partial<MindNode> = {
      [axis]: size,
      sizeMode: 'custom',
    };
    return final ? markStyleOverrides(node, patch, map) : { ...node, ...patch };
  });
  return nodes.every((node, index) => node === map.nodes[index]) ? map : { ...map, nodes };
}
