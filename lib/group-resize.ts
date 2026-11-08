import type { MindMap, MindNode } from '../types';
import type { NodeDimensions } from './movement';
import { layoutSize } from './maps';
import { markStyleOverrides, sizeLimits } from './visual-standardization';

export function resizeNodeGroup(map: MindMap, ids: string[], dx: number, dy: number, measured?: NodeDimensions, final = false): MindMap {
  const selected = new Set(ids);
  const group = map.nodes.filter(node => selected.has(node.id));
  if (group.length < 2) return map;
  const left = Math.min(...group.map(node => node.x));
  const top = Math.min(...group.map(node => node.y));
  const right = Math.max(...group.map(node => node.x + (measured?.get(node.id) || layoutSize(node)).width));
  const bottom = Math.max(...group.map(node => node.y + (measured?.get(node.id) || layoutSize(node)).height));
  const groupWidth = Math.max(1, right - left);
  const groupHeight = Math.max(1, bottom - top);
  // One scale factor preserves every node's aspect ratio and the relative spacing.
  const factor = Math.abs(dx / groupWidth) >= Math.abs(dy / groupHeight) ? 1 + dx / groupWidth : 1 + dy / groupHeight;
  const resizable = group.filter(node => !node.sizeLocked);
  if (!resizable.length) return map;
  const minFactor = Math.max(...resizable.map(node => { const base = measured?.get(node.id) || layoutSize(node); const limits = sizeLimits(node); return Math.max(limits.minWidth / base.width, limits.minHeight / base.height); }));
  const maxFactor = Math.min(...resizable.map(node => { const base = measured?.get(node.id) || layoutSize(node); const limits = sizeLimits(node); return Math.min(limits.maxWidth / base.width, limits.maxHeight / base.height); }));
  const scale = Math.max(minFactor, Math.min(maxFactor, factor));
  if (Math.abs(scale - 1) < 0.002) return map;
  const nodes = map.nodes.map(node => {
    if (!selected.has(node.id) || node.sizeLocked) return node;
    const base = measured?.get(node.id) || layoutSize(node);
    const limits = sizeLimits(node);
    const patch: Partial<MindNode> = {
      width: Math.max(limits.minWidth, Math.min(limits.maxWidth, Math.round(base.width * scale))),
      height: Math.max(limits.minHeight, Math.min(limits.maxHeight, Math.round(base.height * scale))),
      sizeMode: 'custom',
    };
    if (!node.positionLocked) { patch.x = Math.round(left + (node.x - left) * scale); patch.y = Math.round(top + (node.y - top) * scale); }
    return final ? markStyleOverrides(node, patch, map) : { ...node, ...patch };
  });
  return { ...map, nodes };
}
