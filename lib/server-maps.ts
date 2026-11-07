import type { LayoutMode, MindMap, MindNode, MovementMode, NodeShape, NodeStyle } from '../types';
import { migrateMapLayouts } from './layout-migration';

export type MapRow = { id: string; title: string; content: MindMap | null; share_token?: string | null; updated_at: string };

export function fromRow(row: MapRow): MindMap {
  const content = row.content || ({} as MindMap);
  return migrateMapLayouts({ ...content, id: row.id, title: row.title, nodes: content.nodes || [], layout: content.layout || 'horizontal', updatedAt: new Date(row.updated_at).getTime(), shareToken: row.share_token || null });
}

const MAX_NODES = 2000;
const MAX_DEPTH = 100;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const date = /^\d{4}-\d{2}-\d{2}$/;
const layouts: LayoutMode[] = ['horizontal', 'vertical', 'bilateral', 'radial', 'fishbone', 'flowchart', 'swimlane', 'cycle', 'concept', 'network', 'matrix', 'timeline', 'concentric', 'treemap', 'right', 'left', 'balanced', 'down', 'up', 'split-down', 'org', 'org-left', 'fishbone-left', 'timeline-left', 'free'];
const movements: MovementMode[] = ['individual', 'hierarchical', 'automatic'];
const shapes: NodeShape[] = ['rounded', 'rectangle', 'pill', 'ellipse', 'circle', 'diamond', 'hexagon', 'underline', 'transparent', 'tag-right', 'tag-left', 'arrow-right', 'arrow-left', 'arrow-up', 'arrow-down', 'bookmark-right', 'bookmark-left', 'half-rounded-right', 'half-rounded-left'];
const styleKeys: (keyof NodeStyle)[] = ['background', 'border', 'color', 'shape', 'icon', 'fontSize', 'fontFamily', 'lineSpacing', 'letterSpacing', 'bold', 'italic', 'underline', 'strike', 'textAlign', 'textVerticalAlign', 'wrapText', 'textTransform', 'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight', 'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'cornerRadius', 'borderWidth', 'borderStyle'];
const styleKeySet = new Set<string>(styleKeys);

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max: number, allowEmpty = true) => typeof value === 'string' && value.length <= max && (allowEmpty || value.length > 0);
const optionalText = (value: unknown, max: number) => value === undefined || text(value, max);
const finite = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const optionalFinite = (value: unknown, min: number, max: number) => value === undefined || finite(value, min, max);
const optionalBoolean = (value: unknown) => value === undefined || typeof value === 'boolean';
const oneOf = <T extends string>(value: unknown, values: readonly T[]) => typeof value === 'string' && values.includes(value as T);
const optionalOneOf = <T extends string>(value: unknown, values: readonly T[]) => value === undefined || oneOf(value, values);

function validWebUrl(value: unknown) {
  if (value === undefined || value === '') return true;
  if (typeof value !== 'string' || !text(value, 2048)) return false;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) return !/[\u0000-\u001f\u007f]/.test(value);
  try { return ['http:', 'https:'].includes(new URL(value).protocol); }
  catch { return false; }
}

function validImage(value: unknown) {
  if (value === undefined || value === '') return true;
  if (validWebUrl(value)) return true;
  return typeof value === 'string' && value.length <= 1_600_000 && /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/]+=*$/i.test(value);
}

function validLineStyle(value: unknown): boolean {
  if (!record(value)) return false;
  return optionalText(value.color, 64)
    && optionalFinite(value.width, 0, 20)
    && optionalOneOf(value.pattern, ['solid', 'dashed', 'dotted', 'double'])
    && optionalOneOf(value.curve, ['smooth', 'straight', 'step', 'rounded'])
    && optionalOneOf(value.start, ['none', 'arrow', 'circle', 'diamond', 'square', 'bar', 'hollow-circle'])
    && optionalOneOf(value.end, ['none', 'arrow', 'circle', 'diamond', 'square', 'bar', 'hollow-circle']);
}

function validStyle(value: unknown): boolean {
  if (!record(value)) return false;
  return optionalText(value.background, 64)
    && optionalText(value.border, 64)
    && optionalText(value.color, 64)
    && optionalOneOf(value.shape, shapes)
    && optionalText(value.icon, 24)
    && optionalFinite(value.fontSize, 6, 200)
    && optionalFinite(value.lineSpacing, 1, 2.5)
    && optionalFinite(value.letterSpacing, -2, 12)
    && optionalText(value.fontFamily, 200)
    && ['bold', 'italic', 'underline', 'strike', 'wrapText'].every(key => optionalBoolean(value[key]))
    && optionalOneOf(value.textAlign, ['left', 'center', 'right', 'justify'])
    && optionalOneOf(value.textVerticalAlign, ['top', 'center', 'bottom'])
    && optionalOneOf(value.textTransform, ['none', 'uppercase', 'lowercase'])
    && optionalFinite(value.width, 80, 800)
    && optionalFinite(value.height, 36, 500)
    && optionalFinite(value.minWidth, 80, 800)
    && optionalFinite(value.maxWidth, 80, 800)
    && optionalFinite(value.minHeight, 36, 500)
    && optionalFinite(value.maxHeight, 36, 500)
    && ['padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'].every(key => optionalFinite(value[key], 0, 80))
    && optionalFinite(value.cornerRadius, 0, 100)
    && optionalFinite(value.borderWidth, 0, 20)
    && optionalOneOf(value.borderStyle, ['solid', 'dashed', 'dotted', 'double']);
}

function validRichText(value: unknown): boolean {
  return value === undefined || Array.isArray(value) && value.length <= 1000
    && value.reduce((length, run) => length + (record(run) && typeof run.text === 'string' ? run.text.length : 0), 0) <= 1000
    && value.every(run => record(run)
    && text(run.text, 1000)
    && ['bold', 'italic', 'underline', 'strike'].every(key => optionalBoolean(run[key]))
    && optionalFinite(run.fontSize, 8, 96)
    && optionalText(run.fontFamily, 120)
    && optionalFinite(run.lineSpacing, 1, 2.5)
    && optionalFinite(run.letterSpacing, -2, 12)
    && optionalOneOf(run.textTransform, ['none', 'uppercase', 'lowercase'])
    && (run.highlight === undefined || typeof run.highlight === 'string' && /^#[0-9a-f]{6}$/i.test(run.highlight))
    && (run.color === undefined || typeof run.color === 'string' && /^#[0-9a-f]{6}$/i.test(run.color)));
}

function validNode(node: unknown): node is MindNode {
  if (!record(node)) return false;
  if (!text(node.id, 100, false) || !(node.parentId === null || text(node.parentId, 100, false)) || !text(node.text, 1000) || !finite(node.x, -10_000_000, 10_000_000) || !finite(node.y, -10_000_000, 10_000_000)) return false;
  if (node.floating === true && node.parentId !== null) return false;
  if (!optionalOneOf(node.side, ['left', 'right']) || !optionalOneOf(node.branchLayout, layouts) || !optionalOneOf(node.shape, shapes) || !optionalOneOf(node.mediaType, ['video', 'audio']) || !optionalOneOf(node.flowAnswer, ['yes', 'no'])) return false;
  if (!optionalText(node.conceptRelation, 100) || !optionalFinite(node.treemapValue, 0.01, 1_000_000_000) || !optionalFinite(node.radialStartAngle, -360, 360) || !optionalFinite(node.radialRadius, 100, 1000)) return false;
  if (node.timelineDate !== undefined && (typeof node.timelineDate !== 'string' || node.timelineDate !== '' && !date.test(node.timelineDate))) return false;
  if (node.matrixRows !== undefined && (!Array.isArray(node.matrixRows) || node.matrixRows.length < 1 || node.matrixRows.length > 12 || !node.matrixRows.every(label => text(label, 60, false)))) return false;
  if (node.matrixColumns !== undefined && (!Array.isArray(node.matrixColumns) || node.matrixColumns.length < 1 || node.matrixColumns.length > 12 || !node.matrixColumns.every(label => text(label, 60, false)))) return false;
  if (node.matrixRow !== undefined && (!Number.isInteger(node.matrixRow) || !finite(node.matrixRow, 0, 11))) return false;
  if (node.matrixColumn !== undefined && (!Number.isInteger(node.matrixColumn) || !finite(node.matrixColumn, 0, 11))) return false;
  if (!optionalOneOf(node.movementMode, movements) || !optionalOneOf(node.childAlignment, ['left', 'center', 'right']) || !optionalOneOf(node.sizeMode, ['auto', 'uniform', 'custom'])) return false;
  if (!optionalOneOf(node.textAlign, ['left', 'center', 'right', 'justify']) || !optionalOneOf(node.textVerticalAlign, ['top', 'center', 'bottom']) || !optionalOneOf(node.textTransform, ['none', 'uppercase', 'lowercase'])) return false;
  if (!['collapsed', 'floating', 'boundary', 'bold', 'italic', 'underline', 'strike', 'positionLocked', 'inheritMovement', 'inheritMovementToChildren', 'avoidOverlap', 'sizeLocked', 'lockAspectRatio', 'wrapText', 'flowDecision'].every(key => optionalBoolean(node[key]))) return false;
  if (!['note', 'summary'].every(key => optionalText(node[key], 100_000)) || !optionalText(node.label, 1000) || !optionalText(node.equation, 10_000) || !optionalText(node.icon, 24) || !optionalText(node.fontFamily, 200)) return false;
  if (![node.tagIds, node.boundaryTagIds].every(ids => ids === undefined || Array.isArray(ids) && ids.length <= 20 && new Set(ids).size === ids.length && ids.every(id => typeof id === 'string' && uuid.test(id)))) return false;
  if (node.notes !== undefined && (!Array.isArray(node.notes) || node.notes.length > 100
    || node.notes.reduce((length, note) => length + (record(note) && typeof note.text === 'string' ? note.text.length : 0), 0) > 200_000
    || new Set(node.notes.map(note => record(note) ? note.id : undefined)).size !== node.notes.length
    || !node.notes.every(note => record(note) && text(note.id, 100, false) && text(note.text, 100_000) && finite(note.createdAt, 0, Number.MAX_SAFE_INTEGER)))) return false;
  if (!validWebUrl(node.url) || !validWebUrl(node.mediaUrl) || !validImage(node.image) || !validStyle(node)) return false;
  if (node.connectionStyle !== undefined && !validLineStyle(node.connectionStyle)) return false;
  if (!validRichText(node.richText)) return false;
  if (node.styleOverrides !== undefined && (!Array.isArray(node.styleOverrides) || node.styleOverrides.length > styleKeys.length || node.styleOverrides.some(key => typeof key !== 'string' || !styleKeySet.has(key)))) return false;
  if (node.comments !== undefined && (!Array.isArray(node.comments) || node.comments.length > 500 || !node.comments.every(comment => record(comment) && text(comment.id, 100, false) && text(comment.text, 10_000) && finite(comment.createdAt, 0, Number.MAX_SAFE_INTEGER)))) return false;
  if (node.task !== undefined) {
    const task = node.task;
    if (!record(task) || typeof task.done !== 'boolean' || !optionalOneOf(task.priority, ['p0', 'p1', 'p2', 'p3', 'p4', 'low', 'medium', 'high']) || !optionalFinite(task.progress, 0, 100) || !optionalFinite(task.duration, 0, 100_000) || !optionalText(task.assignee, 500)) return false;
    if (![task.start, task.due].every(value => value === undefined || typeof value === 'string' && (value === '' || date.test(value)))) return false;
  }
  const minWidth = node.minWidth ?? 80, maxWidth = node.maxWidth ?? 800, minHeight = node.minHeight ?? 36, maxHeight = node.maxHeight ?? 500;
  return minWidth <= maxWidth && minHeight <= maxHeight;
}

function validTree(nodes: MindNode[]) {
  const byId = new Map(nodes.map(node => [node.id, node]));
  if (byId.size !== nodes.length || nodes.filter(node => node.parentId === null && !node.floating).length !== 1) return false;
  for (const node of nodes) {
    if (node.parentId === node.id || node.parentId !== null && !byId.has(node.parentId)) return false;
    const seen = new Set([node.id]);
    let parent = node.parentId;
    let depth = 0;
    while (parent) {
      if (seen.has(parent) || ++depth > MAX_DEPTH) return false;
      seen.add(parent);
      parent = byId.get(parent)?.parentId ?? null;
    }
  }
  return true;
}

export function validMap(value: unknown): value is MindMap {
  if (!record(value)) return false;
  if (typeof value.id !== 'string' || !text(value.id, 36, false) || !uuid.test(value.id) || !text(value.title, 160) || !Array.isArray(value.nodes) || !value.nodes.length || value.nodes.length > MAX_NODES || !value.nodes.every(validNode) || !validTree(value.nodes)) return false;
  const map = value as unknown as MindMap;
  if (!oneOf(map.layout, layouts) || !finite(map.updatedAt, 0, Number.MAX_SAFE_INTEGER) || !(map.shareToken === undefined || map.shareToken === null || typeof map.shareToken === 'string' && uuid.test(map.shareToken))) return false;
  if (![map.projectId, map.folderId].every(id => id === undefined || typeof id === 'string' && uuid.test(id))) return false;
  if (map.tagDefinitions !== undefined && (!Array.isArray(map.tagDefinitions) || map.tagDefinitions.length > 200 || new Set(map.tagDefinitions.map(tag => tag.id)).size !== map.tagDefinitions.length || !map.tagDefinitions.every(tag => record(tag) && typeof tag.id === 'string' && uuid.test(tag.id) && text(tag.name, 100, false) && /^#[0-9a-f]{6}$/i.test(String(tag.color))))) return false;
  if (!optionalOneOf(map.movementMode, movements) || !optionalBoolean(map.avoidOverlap) || !optionalBoolean(map.siblingReorder)) return false;
  const nodeIds = new Set(map.nodes.map(node => node.id));
  if (map.boundaryGroups !== undefined && (!Array.isArray(map.boundaryGroups) || map.boundaryGroups.length > 500 || new Set(map.boundaryGroups.map(group => group.id)).size !== map.boundaryGroups.length || !map.boundaryGroups.every(group => record(group) && typeof group.id === 'string' && uuid.test(group.id) && Array.isArray(group.nodeIds) && group.nodeIds.length >= 1 && group.nodeIds.length <= MAX_NODES && new Set(group.nodeIds).size === group.nodeIds.length && group.nodeIds.every(id => typeof id === 'string' && nodeIds.has(id)) && (group.tagIds === undefined || Array.isArray(group.tagIds) && group.tagIds.length <= 20 && new Set(group.tagIds).size === group.tagIds.length && group.tagIds.every(id => typeof id === 'string' && uuid.test(id)))))) return false;
  if (map.relationships !== undefined && (!Array.isArray(map.relationships) || map.relationships.length > 4000 || !map.relationships.every(link => record(link) && text(link.id, 100, false) && text(link.source, 100, false) && text(link.target, 100, false) && link.source !== link.target && nodeIds.has(link.source) && nodeIds.has(link.target) && optionalText(link.sourceHandle, 40) && optionalText(link.targetHandle, 40) && optionalText(link.label, 1000) && (link.style === undefined || validLineStyle(link.style))) || new Set(map.relationships.map(link => link.id)).size !== map.relationships.length)) return false;
  if (map.favoriteIcons !== undefined && (!Array.isArray(map.favoriteIcons) || map.favoriteIcons.length > 80 || !map.favoriteIcons.every(icon => text(icon, 24)))) return false;
  if (map.spacing !== undefined && (!record(map.spacing) || !finite(map.spacing.x, 80, 1000) || !finite(map.spacing.y, 30, 500))) return false;
  if (map.defaultNodeStyle !== undefined && !validStyle(map.defaultNodeStyle)) return false;
  if (map.stylePresets !== undefined && (!Array.isArray(map.stylePresets) || map.stylePresets.length > 100 || !map.stylePresets.every(preset => record(preset) && text(preset.id, 100, false) && text(preset.name, 100, false) && validStyle(preset.style)))) return false;
  if (map.levelReferences !== undefined && (!Array.isArray(map.levelReferences) || map.levelReferences.length > MAX_NODES || !map.levelReferences.every(reference => record(reference) && (reference.parentId === null || typeof reference.parentId === 'string' && nodeIds.has(reference.parentId)) && oneOf(reference.mode, ['size', 'format', 'both']) && validStyle(reference.style)))) return false;
  if (map.levelStyles !== undefined && (!Array.isArray(map.levelStyles) || map.levelStyles.length > MAX_DEPTH + 1 || !map.levelStyles.every(level => record(level) && Number.isInteger(level.depth) && finite(level.depth, 0, MAX_DEPTH) && validStyle(level.style) && optionalBoolean(level.autoWidth) && optionalBoolean(level.autoHeight) && optionalBoolean(level.repeatAfter)))) return false;
  if (map.levelConnections !== undefined && (!Array.isArray(map.levelConnections) || map.levelConnections.length > MAX_NODES || !map.levelConnections.every(connection => record(connection) && typeof connection.parentId === 'string' && nodeIds.has(connection.parentId) && validLineStyle(connection.style)))) return false;
  return true;
}
