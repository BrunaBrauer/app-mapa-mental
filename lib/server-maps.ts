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
  return typeof map.id === 'string' && /^[0-9a-f-]{36}$/i.test(map.id) && typeof map.title === 'string' && map.title.length <= 160 && Array.isArray(map.nodes) && map.nodes.length <= 2000 && layouts.includes(map.layout as LayoutMode) && (map.movementMode === undefined || movements.includes(map.movementMode)) && (map.avoidOverlap === undefined || typeof map.avoidOverlap === 'boolean') && (map.levelStyles === undefined || Array.isArray(map.levelStyles) && map.levelStyles.length <= 50 && map.levelStyles.every(level => level && Number.isInteger(level.depth) && level.depth >= 0 && level.depth <= 50 && level.style && typeof level.style === 'object' && (level.autoWidth === undefined || typeof level.autoWidth === 'boolean') && (level.autoHeight === undefined || typeof level.autoHeight === 'boolean') && (level.repeatAfter === undefined || typeof level.repeatAfter === 'boolean'))) && map.nodes.every(node => node && typeof node.id === 'string' && typeof node.text === 'string' && node.text.length <= 1000 && Number.isFinite(node.x) && Number.isFinite(node.y) && (node.movementMode === undefined || movements.includes(node.movementMode)) && (node.childAlignment === undefined || ['left','center','right'].includes(node.childAlignment)) && (node.sizeMode === undefined || ['auto','uniform','custom'].includes(node.sizeMode)) && ['minWidth','maxWidth','minHeight','maxHeight'].every(key => { const size = (node as unknown as Record<string, unknown>)[key]; return size === undefined || typeof size === 'number' && Number.isFinite(size) && size >= (key.includes('Width') ? 80 : 36) && size <= (key.includes('Width') ? 800 : 500); }) && (node.styleOverrides === undefined || Array.isArray(node.styleOverrides) && node.styleOverrides.length <= 40 && node.styleOverrides.every(key => typeof key === 'string')) && ['positionLocked', 'inheritMovement', 'inheritMovementToChildren', 'avoidOverlap', 'sizeLocked', 'lockAspectRatio', 'wrapText'].every(key => (node as unknown as Record<string, unknown>)[key] === undefined || typeof (node as unknown as Record<string, unknown>)[key] === 'boolean'));
}
