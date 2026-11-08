import type { MindMap, MindNode } from '../types';
import type { NodeDimensions } from './movement';
import { layoutSize } from './maps';
import { markStyleOverrides, sizeLimits } from './visual-standardization';

export function resizeNodeGroup(map: MindMap, ids: string[], dx: number, dy: number, measured?: NodeDimensions, final = false): MindMap {
  const selected = new Set(ids);
  const nodes = map.nodes.map(node => {
    if (!selected.has(node.id) || node.sizeLocked) return node;
    const base = measured?.get(node.id) || layoutSize(node);
    const limits = sizeLimits(node);
    let width = base.width + dx;
    let height = base.height + dy;
    if (node.lockAspectRatio) {
      const scale = Math.abs(dx / base.width) >= Math.abs(dy / base.height) ? width / base.width : height / base.height;
      width = base.width * scale;
      height = base.height * scale;
    }
    const patch: Partial<MindNode> = {
      width: Math.max(limits.minWidth, Math.min(limits.maxWidth, Math.round(width))),
      height: Math.max(limits.minHeight, Math.min(limits.maxHeight, Math.round(height))),
      sizeMode: 'custom',
    };
    return final ? markStyleOverrides(node, patch, map) : { ...node, ...patch };
  });
  return { ...map, nodes };
}
