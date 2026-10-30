import type { LayoutMode, MindMap, MindNode, MovementMode } from '../types';
import { layoutBranch, visibleNodes } from './maps';

export type Point = { x: number; y: number };
export type NodeDimensions = Map<string, { width: number; height: number }>;
export type AlignCommand = 'left' | 'right' | 'center-x' | 'top' | 'bottom' | 'center-y' | 'distribute-x' | 'distribute-y' | 'uniform';

const childrenOf = (nodes: MindNode[]) => {
  const children = new Map<string, MindNode[]>();
  for (const node of nodes) if (node.parentId) children.set(node.parentId, [...(children.get(node.parentId) || []), node]);
  return children;
};

function branchIds(id: string, children: Map<string, MindNode[]>): Set<string> {
  const ids = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const current = stack.pop()!;
    if (ids.has(current)) continue;
    ids.add(current);
    for (const child of children.get(current) || []) stack.push(child.id);
  }
  return ids;
}

export function effectiveMovementMode(map: MindMap, id: string, globalMode: MovementMode = 'hierarchical'): MovementMode {
  const byId = new Map(map.nodes.map(node => [node.id, node]));
  const seen = new Set<string>();
  let node = byId.get(id);
  while (node && !seen.has(node.id)) {
    seen.add(node.id);
    if (node.movementMode) return node.movementMode;
    if (node.inheritMovement === false || !node.parentId) break;
    node = byId.get(node.parentId);
  }
  return map.movementMode || globalMode;
}

export function movementModes(map: MindMap, globalMode: MovementMode = 'hierarchical'): Map<string, MovementMode> {
  const byId = new Map(map.nodes.map(node => [node.id, node]));
  const resolved = new Map<string, MovementMode>();
  const resolving = new Set<string>();
  const modeFor = (id: string): MovementMode => {
    if (resolved.has(id)) return resolved.get(id)!;
    const node = byId.get(id);
    if (!node || resolving.has(id)) return map.movementMode || globalMode;
    resolving.add(id);
    const mode = node.movementMode || (node.inheritMovement !== false && node.parentId ? modeFor(node.parentId) : map.movementMode || globalMode);
    resolving.delete(id);
    resolved.set(id, mode);
    return mode;
  };
  for (const node of map.nodes) modeFor(node.id);
  return resolved;
}

export function effectiveAvoidOverlap(map: MindMap, id: string, globalValue = true): boolean {
  const node = map.nodes.find(item => item.id === id);
  return node?.avoidOverlap ?? map.avoidOverlap ?? globalValue;
}

export function childMovementSettings(parent: MindNode): Pick<MindNode, 'inheritMovement'> {
  return { inheritMovement: parent.inheritMovementToChildren !== false };
}

export function projectDrag(map: MindMap, requested: Map<string, Point>, globalMode: MovementMode, temporaryBranchId?: string | null): { positions: Map<string, Point>; automaticRoots: string[]; blocked?: string } {
  const byId = new Map(map.nodes.map(node => [node.id, node]));
  const children = childrenOf(map.nodes);
  const covered = new Set<string>();
  const positions = new Map<string, Point>();
  const automaticRoots: string[] = [];
  const depth = (node: MindNode) => { let n = node; let level = 0; const seen = new Set<string>(); while (n.parentId && byId.has(n.parentId) && !seen.has(n.id)) { seen.add(n.id); n = byId.get(n.parentId)!; level++; } return level; };
  const leaders = [...requested.keys()].map(id => byId.get(id)).filter((node): node is MindNode => Boolean(node)).sort((a, b) => depth(a) - depth(b));
  for (const leader of leaders) {
    if (covered.has(leader.id)) continue;
    const mode = temporaryBranchId === leader.id ? 'hierarchical' : effectiveMovementMode(map, leader.id, globalMode);
    const affected = mode === 'individual' ? new Set([leader.id]) : branchIds(leader.id, children);
    if ([...affected].some(id => byId.get(id)?.positionLocked)) return { positions: new Map(), automaticRoots: [], blocked: 'Este ramo contém um nó com posição bloqueada. Desbloqueie-o antes de mover o ramo.' };
    const target = requested.get(leader.id)!;
    const dx = target.x - leader.x; const dy = target.y - leader.y;
    for (const id of affected) {
      const node = byId.get(id)!;
      positions.set(id, { x: node.x + dx, y: node.y + dy });
      covered.add(id);
    }
    if (mode === 'automatic' && (dx || dy)) automaticRoots.push(leader.id);
  }
  return { positions, automaticRoots };
}

export function collectNodeDimensions(): NodeDimensions {
  const dimensions: NodeDimensions = new Map();
  if (typeof document === 'undefined') return dimensions;
  for (const element of document.querySelectorAll<HTMLElement>('.react-flow__node[data-id] .mind-node')) {
    const id = element.closest<HTMLElement>('.react-flow__node[data-id]')?.dataset.id;
    if (id) dimensions.set(id, { width: element.offsetWidth, height: element.offsetHeight });
  }
  return dimensions;
}

export function visualSize(node: MindNode, dimensions?: NodeDimensions): { width: number; height: number } {
  const measured = dimensions?.get(node.id);
  if (measured) return measured;
  const width = node.width || (node.shape === 'circle' ? 95 : node.shape === 'diamond' ? 205 : node.shape === 'ellipse' ? 175 : !node.parentId && !node.floating ? 182 : 145);
  const height = node.height || (node.shape === 'circle' ? 95 : node.shape === 'diamond' ? 118 : node.shape === 'ellipse' ? 74 : !node.parentId && !node.floating ? 62 : 50);
  return { width, height: height + (node.image ? 120 : 0) };
}

export function overlappingIds(nodes: MindNode[], movedIds: Set<string>, gap = 12, dimensions?: NodeDimensions): Set<string> {
  const collisions = new Set<string>();
  const bounds = nodes.map(node => ({ node, ...visualSize(node, dimensions) }));
  for (let i = 0; i < bounds.length; i++) for (let j = i + 1; j < bounds.length; j++) {
    const a = bounds[i], b = bounds[j];
    if (!movedIds.has(a.node.id) && !movedIds.has(b.node.id)) continue;
    if (a.node.x < b.node.x + b.width + gap && a.node.x + a.width + gap > b.node.x && a.node.y < b.node.y + b.height + gap && a.node.y + a.height + gap > b.node.y) { collisions.add(a.node.id); collisions.add(b.node.id); }
  }
  return collisions;
}

/** Keep a dragged group rigid while finding the closest free landing position. */
export function snapMoveAwayFromOverlap(map: MindMap, movedIds: Set<string>, dimensions?: NodeDimensions): { map: MindMap; adjusted: boolean; blocked: boolean } {
  if (!movedIds.size) return { map, adjusted: false, blocked: false };
  const visible = visibleNodes(map.nodes);
  const moving = visible.filter(node => movedIds.has(node.id));
  const stationary = visible.filter(node => !movedIds.has(node.id));
  const intersectsStationary = (dx: number, dy: number) => moving.some(node => stationary.some(other => intersects({ ...node, x: node.x + dx, y: node.y + dy }, other, 12, dimensions)));
  if (!intersectsStationary(0, 0)) return { map, adjusted: false, blocked: false };
  // The first available offset is chosen by distance, with a vertical preference
  // so horizontal mind-map branches keep their visual direction.
  const step = 24;
  for (let radius = 1; radius <= 50; radius++) {
    const candidates: Point[] = [];
    for (let x = -radius; x <= radius; x++) for (const y of [-radius, radius]) candidates.push({ x: x * step, y: y * step });
    for (let y = -radius + 1; y < radius; y++) for (const x of [-radius, radius]) candidates.push({ x: x * step, y: y * step });
    candidates.sort((a, b) => a.x * a.x + a.y * a.y - b.x * b.x - b.y * b.y || Math.abs(a.x) - Math.abs(b.x));
    for (const candidate of candidates) if (!intersectsStationary(candidate.x, candidate.y)) {
      return { map: { ...map, nodes: map.nodes.map(node => movedIds.has(node.id) ? { ...node, x: node.x + candidate.x, y: node.y + candidate.y } : node) }, adjusted: true, blocked: false };
    }
  }
  return { map, adjusted: false, blocked: true };
}

function intersects(a: MindNode, b: MindNode, gap = 12, dimensions?: NodeDimensions): boolean {
  const aSize = visualSize(a, dimensions), bSize = visualSize(b, dimensions);
  return a.x < b.x + bSize.width + gap && a.x + aSize.width + gap > b.x && a.y < b.y + bSize.height + gap && a.y + aSize.height + gap > b.y;
}

export function reorganizeBranch(map: MindMap, id: string, avoidOverlap = true, dimensions?: NodeDimensions): MindMap {
  const anchor = map.nodes.find(node => node.id === id);
  if (!anchor) return map;
  const ids = branchIds(id, childrenOf(map.nodes));
  const mode: LayoutMode = anchor.branchLayout || (map.layout === 'free' ? 'right' : map.layout);
  const originals = new Map(map.nodes.map(node => [node.id, node]));
  const planned = layoutBranch(map.nodes.map(node => ids.has(node.id) ? { ...node, collapsed: false } : node), id, mode, map.spacing);
  const next = planned.map(node => { const original = originals.get(node.id)!; return node.positionLocked ? { ...node, x: original.x, y: original.y, collapsed: original.collapsed } : { ...node, collapsed: original.collapsed }; });
  if (avoidOverlap) {
    const perpendicular = ['down', 'up', 'org'].includes(mode) ? 'x' : 'y';
    const sign = mode === 'up' || mode === 'left' || mode === 'org-left' ? -1 : 1;
    const occupied = next.filter(node => !ids.has(node.id) || node.positionLocked || node.id === id);
    for (const node of next.filter(node => ids.has(node.id) && node.id !== id && !node.positionLocked)) {
      const original = { x: node.x, y: node.y };
      let step = 0;
      while (occupied.some(other => intersects(node, other, 12, dimensions)) && step < 40) {
        step++;
        node[perpendicular] = original[perpendicular] + sign * step * (perpendicular === 'x' ? (map.spacing?.x || 260) / 2 : (map.spacing?.y || 112) / 2);
      }
      occupied.push(node);
    }
  }
  return { ...map, nodes: next };
}

export function alignNodes(map: MindMap, selectedIds: string[], command: AlignCommand, dimensions?: NodeDimensions): MindMap {
  const selected = map.nodes.filter(node => selectedIds.includes(node.id));
  const movable = selected.filter(node => !node.positionLocked);
  if (selected.length < 2 || !movable.length) return map;
  const positions = new Map<string, Point>();
  const sizes = new Map(selected.map(node => [node.id, visualSize(node, dimensions)]));
  const left = Math.min(...selected.map(node => node.x));
  const top = Math.min(...selected.map(node => node.y));
  const right = Math.max(...selected.map(node => node.x + sizes.get(node.id)!.width));
  const bottom = Math.max(...selected.map(node => node.y + sizes.get(node.id)!.height));
  if (command.startsWith('distribute') || command === 'uniform') {
    const axis = command === 'uniform' ? (right - left >= bottom - top ? 'x' : 'y') : command === 'distribute-x' ? 'x' : 'y';
    const dimension = axis === 'x' ? 'width' : 'height';
    const ordered = [...selected].sort((a, b) => a[axis] - b[axis]);
    const start = ordered[0][axis];
    const end = Math.max(...ordered.map(node => node[axis] + sizes.get(node.id)![dimension]));
    const occupied = ordered.reduce((sum, node) => sum + sizes.get(node.id)![dimension], 0);
    const gap = command === 'uniform' ? (axis === 'x' ? (map.spacing?.x || 260) - 145 : (map.spacing?.y || 112) - 50) : (end - start - occupied) / (ordered.length - 1);
    let cursor = start;
    for (const node of ordered) {
      if (!node.positionLocked) positions.set(node.id, { x: node.x, y: node.y, [axis]: cursor });
      cursor += sizes.get(node.id)![dimension] + Math.max(0, gap);
    }
  } else {
    for (const node of movable) {
      const size = sizes.get(node.id)!;
      const x = command === 'left' ? left : command === 'right' ? right - size.width : command === 'center-x' ? (left + right - size.width) / 2 : node.x;
      const y = command === 'top' ? top : command === 'bottom' ? bottom - size.height : command === 'center-y' ? (top + bottom - size.height) / 2 : node.y;
      positions.set(node.id, { x, y });
    }
  }
  const locked = selected.filter(node => node.positionLocked);
  for (const node of movable) {
    const position = positions.get(node.id);
    if (position && locked.some(other => intersects({ ...node, ...position }, other, 12, dimensions) && !intersects(node, other, 12, dimensions))) positions.delete(node.id);
  }
  return { ...map, nodes: map.nodes.map(node => positions.has(node.id) ? { ...node, ...positions.get(node.id)! } : node) };
}
