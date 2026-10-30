import type { LayoutMode, MindMap, MovementMode } from '../types';

export type MapRow = { id: string; title: string; content: MindMap | null; share_token?: string | null; updated_at: string };

export function fromRow(row: MapRow): MindMap {
  const content = row.content || ({} as MindMap);
  return { ...content, id: row.id, title: row.title, nodes: content.nodes || [], layout: content.layout || 'right', updatedAt: new Date(row.updated_at).getTime(), shareToken: row.share_token || null };
}

const layouts: LayoutMode[] = ['right', 'left', 'balanced', 'down', 'up', 'split-down', 'radial', 'org', 'org-left', 'fishbone', 'fishbone-left', 'timeline', 'timeline-left', 'free'];
const movements: MovementMode[] = ['individual', 'hierarchical', 'automatic'];

export function validMap(value: unknown): value is MindMap {
  if (!value || typeof value !== 'object') return false;
  const map = value as Partial<MindMap>;
  return typeof map.id === 'string' && /^[0-9a-f-]{36}$/i.test(map.id) && typeof map.title === 'string' && map.title.length <= 160 && Array.isArray(map.nodes) && map.nodes.length <= 2000 && layouts.includes(map.layout as LayoutMode) && (map.movementMode === undefined || movements.includes(map.movementMode)) && (map.avoidOverlap === undefined || typeof map.avoidOverlap === 'boolean') && map.nodes.every(node => node && typeof node.id === 'string' && typeof node.text === 'string' && node.text.length <= 1000 && Number.isFinite(node.x) && Number.isFinite(node.y) && (node.movementMode === undefined || movements.includes(node.movementMode)) && ['positionLocked', 'inheritMovement', 'inheritMovementToChildren', 'avoidOverlap'].every(key => (node as unknown as Record<string, unknown>)[key] === undefined || typeof (node as unknown as Record<string, unknown>)[key] === 'boolean'));
}
