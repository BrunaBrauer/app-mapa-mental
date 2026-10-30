import type { MindMap, MindNode, NodeStyle } from '../types';
import { descendants } from './maps';
import { alignNodes, visualSize, type NodeDimensions } from './movement';
import { pickNodeStyle } from './node-style';
import { styleModels } from './style-models';

export type VisualScope = 'selection' | 'siblings' | 'level' | 'branch' | 'map';
export type VisualOperation = 'align-left' | 'align-center' | 'align-right' | 'restore-alignment' | 'width-auto' | 'height-auto' | 'size-auto' | 'match-width' | 'match-height' | 'match-both' | 'uniform-width' | 'uniform-height' | 'uniform-both' | 'smallest-width' | 'smallest-height' | 'smallest-both' | 'fixed-width' | 'fixed-height' | 'limit-min-width' | 'limit-max-width' | 'limit-min-height' | 'limit-max-height' | 'restore-level-size' | 'save-level-style' | 'restore-level-style' | 'copy-style' | `fixed-size:${number}:${number}` | `model:${string}`;
export type VisualStyleGroup = 'fill' | 'contour' | 'shape' | 'padding' | 'text' | 'dimensions';

/** Detached topics have no hierarchical level; their own formatting is independent. */
export function nodeDepth(nodes: MindNode[], id: string): number | null {
  const byId = new Map(nodes.map(node => [node.id, node]));
  let current = byId.get(id);
  if (!current || current.floating) return null;
  let depth = 0;
  const seen = new Set<string>();
  while (current?.parentId) {
    if (seen.has(current.id)) return null;
    seen.add(current.id);
    current = byId.get(current.parentId);
    if (!current) return null;
    depth++;
  }
  return depth;
}

export function visualScopeIds(map: MindMap, selectedIds: string[], scope: VisualScope): string[] {
  const anchor = map.nodes.find(node => node.id === selectedIds.at(-1));
  if (!anchor) return [];
  if (scope === 'selection') return [...new Set(selectedIds)].filter(id => map.nodes.some(node => node.id === id));
  if (scope === 'map') return map.nodes.map(node => node.id);
  if (scope === 'branch') return [...descendants(map.nodes, anchor.id)];
  if (scope === 'siblings') return map.nodes.filter(node => node.parentId === anchor.parentId && node.floating === anchor.floating).map(node => node.id);
  const depth = nodeDepth(map.nodes, anchor.id);
  return depth === null ? [anchor.id] : map.nodes.filter(node => nodeDepth(map.nodes, node.id) === depth).map(node => node.id);
}

function levelStyleForDepth(map: MindMap, depth: number | null): NonNullable<MindMap['levelStyles']>[number] | undefined {
  if (depth === null) return undefined;
  return map.levelStyles?.find(entry => entry.depth === depth) || [...(map.levelStyles || [])].filter(entry => entry.repeatAfter && entry.depth < depth).sort((a, b) => b.depth - a.depth)[0];
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(value)));
export function sizeLimits(node: MindNode) {
  const minWidth = clamp(node.minWidth ?? 80, 80, 800);
  const maxWidth = clamp(node.maxWidth ?? 800, minWidth, 800);
  const minHeight = clamp(node.minHeight ?? 36, 36, 500);
  const maxHeight = clamp(node.maxHeight ?? 500, minHeight, 500);
  return { minWidth, maxWidth, minHeight, maxHeight };
}
const styleProperties = new Set<keyof NodeStyle>(['background','border','color','shape','icon','fontSize','fontFamily','bold','italic','underline','strike','textAlign','textVerticalAlign','wrapText','textTransform','width','height','minWidth','maxWidth','minHeight','maxHeight','padding','paddingTop','paddingRight','paddingBottom','paddingLeft','cornerRadius','borderWidth','borderStyle']);
const groupKeys: Record<VisualStyleGroup, (keyof NodeStyle)[]> = {
  fill: ['background'], contour: ['border','borderWidth','borderStyle','cornerRadius'], shape: ['shape'],
  padding: ['padding','paddingTop','paddingRight','paddingBottom','paddingLeft'],
  text: ['color','fontSize','fontFamily','bold','italic','underline','strike','textAlign','textVerticalAlign','wrapText','textTransform'],
  dimensions: ['width','height','minWidth','maxWidth','minHeight','maxHeight'],
};

function siblingGroups(map: MindMap, ids: string[]): string[][] {
  const groups = new Map<string, string[]>();
  for (const id of ids) {
    const node = map.nodes.find(item => item.id === id);
    if (!node) continue;
    const key = node.parentId ?? `root:${node.id}`;
    groups.set(key, [...(groups.get(key) || []), id]);
  }
  return [...groups.values()];
}

function stylePatch(node: MindNode, style: Partial<NodeStyle>, autoWidth?: boolean, autoHeight?: boolean): Partial<MindNode> {
  const overrides = new Set(node.styleOverrides || []);
  const patch: Partial<MindNode> = {};
  for (const [key, value] of Object.entries(style)) if (!overrides.has(key as keyof NodeStyle)) (patch as Record<string, unknown>)[key] = value;
  if (autoWidth && !overrides.has('width')) patch.width = undefined;
  if (autoHeight && !overrides.has('height')) patch.height = undefined;
  if (node.sizeLocked) { delete patch.width; delete patch.height; }
  return patch;
}

export function markStyleOverrides(node: MindNode, patch: Partial<MindNode>, map: MindMap): MindNode {
  if (node.sizeLocked && patch.sizeLocked !== false) {
    patch = { ...patch };
    delete patch.width;
    delete patch.height;
  }
  for (const key of ['minWidth','maxWidth','minHeight','maxHeight'] as const) {
    if (patch[key] !== undefined) patch = { ...patch, [key]: clamp(patch[key], key.includes('Width') ? 80 : 36, key.includes('Width') ? 800 : 500) };
  }
  if (patch.minWidth !== undefined && patch.minWidth > (patch.maxWidth ?? node.maxWidth ?? 800)) patch = { ...patch, maxWidth: patch.minWidth };
  if (patch.maxWidth !== undefined && patch.maxWidth < (patch.minWidth ?? node.minWidth ?? 80)) patch = { ...patch, minWidth: patch.maxWidth };
  if (patch.minHeight !== undefined && patch.minHeight > (patch.maxHeight ?? node.maxHeight ?? 500)) patch = { ...patch, maxHeight: patch.minHeight };
  if (patch.maxHeight !== undefined && patch.maxHeight < (patch.minHeight ?? node.minHeight ?? 36)) patch = { ...patch, minHeight: patch.maxHeight };
  const limits = sizeLimits({ ...node, ...patch });
  if (!node.sizeLocked && (patch.minWidth !== undefined || patch.maxWidth !== undefined) && node.width !== undefined && !Object.hasOwn(patch, 'width')) patch = { ...patch, width: clamp(node.width, limits.minWidth, limits.maxWidth) };
  if (!node.sizeLocked && (patch.minHeight !== undefined || patch.maxHeight !== undefined) && node.height !== undefined && !Object.hasOwn(patch, 'height')) patch = { ...patch, height: clamp(node.height, limits.minHeight, limits.maxHeight) };
  if (patch.width !== undefined) patch = { ...patch, width: clamp(patch.width, limits.minWidth, limits.maxWidth) };
  if (patch.height !== undefined) patch = { ...patch, height: clamp(patch.height, limits.minHeight, limits.maxHeight) };
  const depth = nodeDepth(map.nodes, node.id);
  if (!levelStyleForDepth(map, depth)) return { ...node, ...patch };
  const overrides = new Set(node.styleOverrides || []);
  for (const key of Object.keys(patch)) if (styleProperties.has(key as keyof NodeStyle)) overrides.add(key as keyof NodeStyle);
  return { ...node, ...patch, styleOverrides: [...overrides] };
}

export function patchVisualNodes(map: MindMap, ids: string[], patch: Partial<MindNode>, dimensions?: NodeDimensions): MindMap {
  const affected = new Set(ids);
  const widthChanged = Object.hasOwn(patch, 'width');
  const heightChanged = Object.hasOwn(patch, 'height');
  const limitsChanged = ['minWidth','maxWidth','minHeight','maxHeight'].some(key => Object.hasOwn(patch, key));
  const next: MindMap = { ...map, nodes: map.nodes.map(node => {
    if (!affected.has(node.id)) return node;
    let sizedPatch = patch;
    if (node.lockAspectRatio && !node.sizeLocked && widthChanged !== heightChanged) {
      const old = visualSize(node, dimensions);
      const limits = sizeLimits(node);
      if (widthChanged && patch.width !== undefined) sizedPatch = { ...patch, height: clamp(patch.width * old.height / old.width, limits.minHeight, limits.maxHeight) };
      if (heightChanged && patch.height !== undefined) sizedPatch = { ...patch, width: clamp(patch.height * old.width / old.height, limits.minWidth, limits.maxWidth) };
    }
    const updated = markStyleOverrides(node, sizedPatch, map);
    if (updated.width === node.width || node.positionLocked || node.sizeLocked || !node.parentId) return updated;
    const alignment = map.nodes.find(item => item.id === node.parentId)?.childAlignment || 'left';
    const oldWidth = visualSize(node, dimensions).width;
    const newWidth = updated.width ?? oldWidth;
    return { ...updated, x: alignment === 'center' ? node.x + (oldWidth - newWidth) / 2 : alignment === 'right' ? node.x + oldWidth - newWidth : node.x };
  }) };
  return widthChanged || heightChanged || limitsChanged ? spreadSiblingOverlaps(next, ids, dimensions).map : next;
}

export function applySiblingAlignments(map: MindMap, parentIds?: Set<string>, dimensions?: NodeDimensions): MindMap {
  let result = map;
  for (const parent of map.nodes.filter(node => node.childAlignment && (!parentIds || parentIds.has(node.id)))) {
    const ids = map.nodes.filter(node => node.parentId === parent.id).map(node => node.id);
    if (ids.length > 1) result = alignNodes(result, ids, parent.childAlignment === 'left' ? 'left' : parent.childAlignment === 'right' ? 'right' : 'center-x', dimensions);
  }
  return result;
}

/** Resolve local sibling collisions after size changes without laying out the whole map. */
export function spreadSiblingOverlaps(map: MindMap, affectedIds: string[], dimensions?: NodeDimensions): { map: MindMap; blocked: boolean } {
  if (map.layout === 'free' || map.avoidOverlap === false) return { map, blocked: false };
  const affected = new Set(affectedIds);
  const parents = new Set(map.nodes.filter(node => affected.has(node.id) && node.parentId).map(node => node.parentId!));
  let nodes = map.nodes.map(node => ({ ...node }));
  let blocked = false;
  const size = (node: MindNode) => {
    const measured = visualSize(node, dimensions);
    return { width: affected.has(node.id) && node.width !== undefined ? node.width : measured.width, height: affected.has(node.id) && node.height !== undefined ? node.height : measured.height };
  };
  for (const parentId of parents) {
    const siblings = nodes.filter(node => node.parentId === parentId).sort((a, b) => a.y - b.y);
    for (let index = 1; index < siblings.length; index++) {
      const previous = nodes.find(node => node.id === siblings[index - 1].id)!;
      const current = nodes.find(node => node.id === siblings[index].id)!;
      const a = size(previous), b = size(current);
      const horizontalOverlap = previous.x < current.x + b.width + 12 && previous.x + a.width + 12 > current.x;
      const dy = previous.y + a.height + 12 - current.y;
      if (!horizontalOverlap || dy <= 0) continue;
      const branch = descendants(nodes, current.id);
      if ([...branch].some(id => nodes.find(node => node.id === id)?.positionLocked)) { blocked = true; continue; }
      nodes = nodes.map(node => branch.has(node.id) ? { ...node, y: node.y + dy } : node);
    }
  }
  return { map: { ...map, nodes }, blocked };
}

export function applyVisualStandard(map: MindMap, selectedIds: string[], scope: VisualScope, operation: VisualOperation, dimensions?: NodeDimensions, value?: number, styleGroups?: VisualStyleGroup[]): MindMap {
  const ids = visualScopeIds(map, selectedIds, scope);
  if (!ids.length) return map;
  if (operation.startsWith('model:')) {
    const model = styleModels.find(item => item.id === operation.slice(6));
    if (!model) return map;
    const levelStyles = [
      { depth: 0, style: model.root, autoWidth: true, autoHeight: true },
      { depth: 1, style: model.branch, autoWidth: true, autoHeight: true },
      { depth: 2, style: model.leaf, autoWidth: true, autoHeight: true, repeatAfter: true },
    ];
    return { ...map, levelStyles, nodes: map.nodes.map(node => {
      const depth = nodeDepth(map.nodes, node.id);
      const style = depth === 0 ? model.root : depth === 1 ? model.branch : model.leaf;
      return { ...node, ...style, width: node.sizeLocked ? node.width : undefined, height: node.sizeLocked ? node.height : undefined, sizeMode: node.sizeLocked ? node.sizeMode : 'auto', styleOverrides: [] };
    }) };
  }
  if (operation.startsWith('align-') || operation === 'restore-alignment') {
    const alignment = operation === 'align-center' ? 'center' : operation === 'align-right' ? 'right' : 'left';
    const groups = scope === 'selection' ? [ids] : siblingGroups(map, ids);
    let result = map;
    for (const group of groups) {
      if (group.length >= 2) {
        const aligned = alignNodes(result, group, alignment === 'left' ? 'left' : alignment === 'right' ? 'right' : 'center-x', dimensions);
        if (aligned === result && group.some(id => result.nodes.find(node => node.id === id)?.positionLocked)) continue;
        result = aligned;
      }
      const parentId = map.nodes.find(node => node.id === group[0])?.parentId;
      const allSiblings = map.nodes.filter(node => node.parentId === parentId);
      if (parentId && allSiblings.every(node => group.includes(node.id))) result = { ...result, nodes: result.nodes.map(node => node.id === parentId ? { ...node, childAlignment: operation === 'restore-alignment' ? undefined : alignment } : node) };
    }
    return result;
  }
  const anchor = map.nodes.find(node => node.id === selectedIds.at(-1))!;
  if (operation === 'copy-style') {
    const keys = new Set((styleGroups || ['fill','contour','shape','padding','text']).flatMap(group => groupKeys[group]));
    if (!keys.size) return map;
    const source = pickNodeStyle(anchor);
    const patch = Object.fromEntries(Object.entries(source).filter(([key]) => keys.has(key as keyof NodeStyle))) as Partial<MindNode>;
    const affected = new Set(ids);
    return patchVisualNodes(map, [...affected].filter(id => id !== anchor.id), patch, dimensions);
  }
  if (operation === 'restore-level-style') {
    const affected = new Set(ids);
    return { ...map, nodes: map.nodes.map(node => {
      const level = levelStyleForDepth(map, nodeDepth(map.nodes, node.id));
      return affected.has(node.id) && level ? { ...node, ...stylePatch({ ...node, styleOverrides: [] }, level.style, level.autoWidth, level.autoHeight), styleOverrides: [] } : node;
    }) };
  }
  if (operation === 'save-level-style') {
    const depth = nodeDepth(map.nodes, anchor.id);
    if (depth === null) return map;
    const { icon: _icon, ...style } = pickNodeStyle(anchor, 'both');
    void _icon;
    const autoWidth = anchor.width === undefined, autoHeight = anchor.height === undefined;
    const levelStyles = [...(map.levelStyles || []).filter(entry => entry.depth !== depth), { depth, style, autoWidth, autoHeight }];
    const targets = new Set(visualScopeIds(map, selectedIds, 'level'));
    return { ...map, levelStyles, nodes: map.nodes.map(node => targets.has(node.id) ? { ...node, ...stylePatch(node, style, autoWidth, autoHeight) } : node) };
  }
  if (operation === 'restore-level-size') {
    const affected = new Set(ids);
    return { ...map, nodes: map.nodes.map(node => {
      if (!affected.has(node.id) || node.sizeLocked) return node;
      const style = levelStyleForDepth(map, nodeDepth(map.nodes, node.id));
      return { ...node, width: style?.autoWidth ? undefined : style?.style.width, height: style?.autoHeight ? undefined : style?.style.height, sizeMode: style?.style.width || style?.style.height ? 'custom' : 'auto', styleOverrides: (node.styleOverrides || []).filter(key => key !== 'width' && key !== 'height') };
    }) };
  }
  if (operation.startsWith('limit-')) {
    const key = ({ 'limit-min-width': 'minWidth', 'limit-max-width': 'maxWidth', 'limit-min-height': 'minHeight', 'limit-max-height': 'maxHeight' } as const)[operation as 'limit-min-width'];
    if (!key || value === undefined) return map;
    const affected = new Set(ids);
    return { ...map, nodes: map.nodes.map(node => {
      if (!affected.has(node.id)) return node;
      const minimum = key.includes('Width') ? 80 : 36;
      const maximum = key.includes('Width') ? 800 : 500;
      const candidate = clamp(value, minimum, maximum);
      const limits = sizeLimits(node);
      const opposite = key === 'minWidth' ? limits.maxWidth : key === 'maxWidth' ? limits.minWidth : key === 'minHeight' ? limits.maxHeight : limits.minHeight;
      const adjusted = key.startsWith('min') ? Math.min(candidate, opposite) : Math.max(candidate, opposite);
      const updated = markStyleOverrides(node, { [key]: adjusted }, map);
      if (updated.width === node.width || node.positionLocked || !node.parentId) return updated;
      const oldWidth = visualSize(node, dimensions).width;
      const alignment = map.nodes.find(item => item.id === node.parentId)?.childAlignment || 'left';
      return { ...updated, x: alignment === 'center' ? node.x + (oldWidth - updated.width!) / 2 : alignment === 'right' ? node.x + oldWidth - updated.width! : node.x };
    }) };
  }
  const targets = map.nodes.filter(node => ids.includes(node.id));
  const widths = targets.map(node => visualSize(node, dimensions).width);
  const heights = targets.map(node => visualSize(node, dimensions).height);
  const anchorSize = visualSize(anchor, dimensions);
  const exact = operation.startsWith('fixed-size:') ? operation.split(':').slice(1).map(Number) : null;
  const width = exact ? exact[0] : operation === 'match-width' || operation === 'match-both' ? anchorSize.width : operation === 'fixed-width' ? clamp(value || 145, 80, 800) : operation.startsWith('smallest') ? Math.min(...widths) : Math.max(...widths);
  const height = exact ? exact[1] : operation === 'match-height' || operation === 'match-both' ? anchorSize.height : operation === 'fixed-height' ? clamp(value || 50, 36, 500) : operation.startsWith('smallest') ? Math.min(...heights) : Math.max(...heights);
  const setWidth = Boolean(exact) || operation.includes('width') || operation.endsWith('both') || operation === 'size-auto';
  const setHeight = Boolean(exact) || operation.includes('height') || operation.endsWith('both') || operation === 'size-auto';
  const autoWidth = operation === 'width-auto' || operation === 'size-auto';
  const autoHeight = operation === 'height-auto' || operation === 'size-auto';
  const affected = new Set(ids);
  const before = new Map(map.nodes.map(node => [node.id, { x: node.x, size: visualSize(node, dimensions) }]));
  const result: MindMap = { ...map, nodes: map.nodes.map(node => {
    if (!affected.has(node.id) || node.sizeLocked) return node;
    const limits = sizeLimits(node);
    const patch: Partial<MindNode> = { ...(setWidth ? { width: autoWidth ? undefined : clamp(width, limits.minWidth, limits.maxWidth) } : {}), ...(setHeight ? { height: autoHeight ? undefined : clamp(height, limits.minHeight, limits.maxHeight) } : {}), sizeMode: autoWidth && autoHeight ? 'auto' : scope === 'selection' && ids.length === 1 ? 'custom' : 'uniform' };
    return markStyleOverrides(node, patch, map);
  }) };
  // A width change uses the prior left, center or right reference of its sibling group.
  return { ...result, nodes: result.nodes.map(node => {
    if (!affected.has(node.id) || !setWidth || node.positionLocked || node.sizeLocked || !node.parentId) return node;
    const parent = map.nodes.find(item => item.id === node.parentId);
    const alignment = parent?.childAlignment || 'left';
    const old = before.get(node.id)!;
    const newWidth = node.width ?? old.size.width;
    return { ...node, x: alignment === 'center' ? old.x + (old.size.width - newWidth) / 2 : alignment === 'right' ? old.x + old.size.width - newWidth : old.x };
  }) };
}

/** Apply level templates only to genuinely new nodes; manual edits keep priority. */
export function styleNewNodes(previous: MindMap, next: MindMap): MindMap {
  if (!next.levelStyles?.length) return next;
  const oldIds = new Set(previous.nodes.map(node => node.id));
  return { ...next, nodes: next.nodes.map(node => {
    if (oldIds.has(node.id)) return node;
    const depth = nodeDepth(next.nodes, node.id);
    const level = levelStyleForDepth(next, depth);
    const style: Partial<NodeStyle> | undefined = level?.style;
    return style ? { ...node, ...stylePatch(node, style, level?.autoWidth, level?.autoHeight), styleOverrides: node.styleOverrides || [] } : node;
  }) };
}
