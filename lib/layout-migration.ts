import type { LayoutMode, MindMap } from '../types';

const equivalents: Partial<Record<LayoutMode, LayoutMode>> = {
  right: 'horizontal', left: 'horizontal', balanced: 'bilateral',
  down: 'vertical', up: 'vertical', 'split-down': 'bilateral',
  org: 'vertical', 'org-left': 'vertical',
  'fishbone-left': 'fishbone', 'timeline-left': 'timeline',
  free: 'network',
};

export function migrateLayout(mode: LayoutMode): LayoutMode {
  return equivalents[mode] || mode;
}

export function migrateMapLayouts(map: MindMap): MindMap {
  const layout = migrateLayout(map.layout);
  let changed = layout !== map.layout;
  const nodes = map.nodes.map(node => {
    if (!node.branchLayout) return node;
    const branchLayout = migrateLayout(node.branchLayout);
    if (branchLayout === node.branchLayout) return node;
    changed = true;
    return { ...node, branchLayout };
  });
  return changed ? { ...map, layout, nodes } : map;
}
