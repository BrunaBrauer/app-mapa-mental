import type { MindMap, MindNode, LayoutMode } from '../types';

export const uid = () => crypto.randomUUID();
export const rootNode = (text = 'Ideia central'): MindNode => ({ id: uid(), parentId: null, text, x: 0, y: 0, icon: '', background: '#ffffff', border: '#000000', color: '#20243b', fontSize: 18, bold: true });
export function createMap(title = 'Mapa sem título'): MindMap { return { id: uid(), title, layout: 'horizontal', nodes: [rootNode()], updatedAt: Date.now() }; }

const templateData = {
  projeto: [['Objetivos', 'Escopo', 'Resultados'], ['Planejamento', 'Cronograma', 'Recursos'], ['Execução', 'Tarefas', 'Responsáveis'], ['Avaliação', 'Indicadores', 'Próximos passos']],
  brainstorming: [['Ideias', 'Possibilidade A', 'Possibilidade B'], ['Público', 'Necessidades', 'Jornada'], ['Oportunidades', 'Tendências', 'Parcerias'], ['Próximas ações', 'Testar', 'Priorizar']],
  swot: [['Forças', 'Vantagens', 'Recursos'], ['Fraquezas', 'Limites', 'Gargalos'], ['Oportunidades', 'Mercado', 'Tendências'], ['Ameaças', 'Concorrência', 'Mudanças']],
} as const;
export type TemplateKey = keyof typeof templateData;
export function createTemplate(kind: TemplateKey): MindMap {
  const title = { projeto: 'Planejamento de projeto', brainstorming: 'Brainstorming', swot: 'Análise SWOT' }[kind];
  const map = createMap(title); map.nodes[0].text = title;
  templateData[kind].forEach(group => {
    const parent: MindNode = { id: uid(), parentId: map.nodes[0].id, text: group[0], x: 0, y: 0 };
    map.nodes.push(parent);
    group.slice(1).forEach(text => map.nodes.push({ id: uid(), parentId: parent.id, text, x: 0, y: 0 }));
  });
  map.nodes = autoLayout(map.nodes, 'horizontal'); return map;
}

// Each visible leaf receives a row; parents are centered above their descendants.
export function autoLayout(nodes: MindNode[], mode: LayoutMode, spacing = { x: 260, y: 112 }): MindNode[] {
  const next = nodes.map(n => ({ ...n })); if (mode === 'free' || mode === 'network' || mode === 'treemap' || !next.length) return next;
  if (mode === 'concept') return autoLayout(next, 'radial', spacing);
  if (mode === 'horizontal') {
    const placed = autoLayout(next, 'right', spacing);
    const byId = new Map(placed.map(node => [node.id, node]));
    const depth = (node: MindNode) => { let level = 0; let parent = node.parentId; const seen = new Set([node.id]); while (parent && byId.has(parent) && !seen.has(parent)) { seen.add(parent); level++; parent = byId.get(parent)!.parentId; } return level; };
    const widths = new Map<number, number>();
    for (const node of visibleNodes(placed).filter(node => !node.floating)) widths.set(depth(node), Math.max(widths.get(depth(node)) || 0, node.width ?? (node.parentId ? 145 : 182)));
    const columns = new Map<number, number>([[0, 0]]);
    for (let level = 1; level <= widths.size; level++) columns.set(level, (columns.get(level - 1) || 0) + (widths.get(level - 1) || 145) + 72);
    return placed.map(node => node.floating ? node : { ...node, x: columns.get(depth(node)) ?? node.x });
  }
  const flowchart = mode === 'flowchart';
  if (mode === 'vertical' || flowchart) mode = 'down';
  if (mode === 'bilateral') mode = 'balanced';
  const root = next.find(n => !n.parentId && !n.floating) ?? next[0]; root.x = 0; root.y = 0;
  const byParent = new Map<string, MindNode[]>();
  next.forEach(node => { if (node.parentId) { const siblings = byParent.get(node.parentId); if (siblings) siblings.push(node); else byParent.set(node.parentId, [node]); } });
  const kids = (id: string) => {
    const children = [...(byParent.get(id) || [])];
    const order = (node: MindNode) => node.flowAnswer === 'yes' ? 0 : node.flowAnswer === 'no' ? 1 : 2;
    return flowchart ? children.sort((a, b) => order(a) - order(b)) : children;
  };
  const branches = root.collapsed ? [] : kids(root.id);
  if (mode === 'timeline') branches.sort((a, b) => (a.timelineDate || '9999-12-31').localeCompare(b.timelineDate || '9999-12-31'));
  if (mode === 'swimlane') {
    root.x = 0; root.y = 0;
    branches.forEach((branch, lane) => {
      const seen = new Set<string>(); let row = 0;
      branch.x = 250 + lane * 300 + 36; branch.y = 12;
      const place = (parent: MindNode, depth: number) => {
        if (seen.has(parent.id)) return;
        seen.add(parent.id);
        if (parent !== branch) { parent.x = 250 + lane * 300 + 36 + Math.min(depth - 1, 3) * 12; parent.y = 150 + row++ * 130; }
        if (!parent.collapsed) kids(parent.id).forEach(child => place(child, depth + 1));
      };
      place(branch, 0);
    });
    return next;
  }
  if (mode === 'matrix') {
    const rows = root.matrixRows?.length || 2;
    const columns = root.matrixColumns?.length || 2;
    const assigned = visibleNodes(next).filter(node => node.id !== root.id && !node.floating);
    const cells = new Map<string, MindNode[]>();
    assigned.forEach((node, index) => {
      const row = Math.min(rows - 1, node.matrixRow ?? Math.floor(index / columns) % rows);
      const column = Math.min(columns - 1, node.matrixColumn ?? index % columns);
      const key = `${row}:${column}`;
      const cell = cells.get(key);
      if (cell) cell.push(node); else cells.set(key, [node]);
    });
    const cellHeight = Math.max(180, ...[...cells.values()].map(cell => cell.length * 84 + 60));
    root.x = 0; root.y = 0;
    const gridLeft = (root.width ?? 182) / 2 - columns * 280 / 2;
    cells.forEach((items, key) => {
      const [row, column] = key.split(':').map(Number);
      items.forEach((node, index) => { node.x = gridLeft + column * 280 + 30; node.y = 180 + row * cellHeight + 48 + index * 84; });
    });
    return next;
  }
  if (mode === 'cycle' || mode === 'concentric') {
    const levels: MindNode[][] = [];
    const seen = new Set([root.id]);
    let parents = [root];
    while (parents.length) {
      const children = parents.flatMap(parent => parent.collapsed ? [] : kids(parent.id)).filter(node => !seen.has(node.id));
      if (!children.length) break;
      children.forEach(node => seen.add(node.id));
      levels.push(children);
      parents = children;
    }
    const radii: number[] = [];
    levels.forEach((level, index) => {
      const widest = Math.max(...level.map(node => node.width ?? 160));
      const circumference = level.length * (widest + 48);
      radii.push(Math.max((radii[index - 1] ?? 0) + spacing.x, circumference / (2 * Math.PI), spacing.x));
    });
    const centerX = (root.width ?? 182) / 2;
    const centerY = (root.height ?? 72) / 2;
    const place = (node: MindNode, depth: number, angle: number) => {
      const radius = radii[depth - 1];
      node.x = centerX + Math.cos(angle) * radius - (node.width ?? 160) / 2;
      node.y = centerY + Math.sin(angle) * radius - (node.height ?? 64) / 2;
    };
    if (mode === 'concentric') {
      levels.forEach((level, depth) => level.forEach((node, index) => place(node, depth + 1, -Math.PI / 2 + 2 * Math.PI * index / level.length)));
    } else {
      const stages = levels[0] || [];
      const spread = 2 * Math.PI / Math.max(1, stages.length);
      const placeDescendants = (parent: MindNode, depth: number, center: number, span: number) => {
        const children = parent.collapsed ? [] : kids(parent.id).filter(node => seen.has(node.id));
        children.forEach((child, index) => {
          const angle = center + span * (index - (children.length - 1) / 2) / Math.max(1, children.length);
          place(child, depth, angle);
          placeDescendants(child, depth + 1, angle, span / Math.max(1, children.length));
        });
      };
      stages.forEach((stage, index) => {
        const angle = -Math.PI / 2 + spread * index;
        place(stage, 1, angle);
        placeDescendants(stage, 2, angle, spread);
      });
    }
    return next;
  }
  if (mode === 'down' || mode === 'up' || mode === 'org' || mode === 'org-left') {
    const vertical = mode !== 'org-left';
    const direction = mode === 'up' || mode === 'org-left' ? -1 : 1;
    const slotGap = vertical ? spacing.x * (mode === 'org' ? 1.18 : 1) : spacing.y * 1.3;
    let slot = 0;
    const seen = new Set([root.id]);
    const place = (node: MindNode, depth: number): number => {
      if (seen.has(node.id)) return slot * slotGap;
      seen.add(node.id);
      const children = node.collapsed ? [] : kids(node.id).filter(child => !seen.has(child.id));
      const position = children.length ? (() => { const values = children.map(child => place(child, depth + 1)); return (values[0] + values[values.length - 1]) / 2; })() : slot++ * slotGap;
      if (vertical) { node.x = position; node.y = direction * depth * (flowchart ? Math.max(180, spacing.y * 1.8) : spacing.x * (mode === 'org' ? .82 : 1)); }
      else { node.x = direction * depth * spacing.x * .85; node.y = position; }
      return position;
    };
    branches.forEach(branch => place(branch, 1));
    const offset = ((slot - 1) * slotGap) / 2;
    next.forEach(node => { if (seen.has(node.id) && node.id !== root.id) { if (vertical) node.x -= offset; else node.y -= offset; } });
    return next;
  }
  if (mode === 'radial') {
    const weights = new Map<string, number>();
    const count = (node: MindNode, path = new Set<string>()): number => {
      if (path.has(node.id)) return 1;
      const nextPath = new Set([...path, node.id]);
      const value = Math.max(1, (node.collapsed ? [] : kids(node.id)).reduce((sum, child) => sum + count(child, nextPath), 0));
      weights.set(node.id, value); return value;
    };
    const total = Math.max(1, branches.reduce((sum, node) => sum + count(node), 0));
    const seen = new Set([root.id]);
    const place = (node: MindNode, depth: number, start: number, span: number) => {
      if (seen.has(node.id)) return;
      seen.add(node.id);
      const angle = start + span / 2;
      const radius = root.radialRadius ?? spacing.x;
      const rotation = (root.radialStartAngle ?? 0) * Math.PI / 180;
      node.x = Math.cos(angle + rotation) * depth * radius;
      node.y = Math.sin(angle + rotation) * depth * Math.max(150, radius * .7);
      let cursor = start;
      (node.collapsed ? [] : kids(node.id)).forEach(child => { const part = span * (weights.get(child.id) || 1) / (weights.get(node.id) || 1); place(child, depth + 1, cursor, part); cursor += part; });
    };
    let cursor = -Math.PI;
    branches.forEach(node => { const span = 2 * Math.PI * (weights.get(node.id) || 1) / total; place(node, 1, cursor, span); cursor += span; });
    return next;
  }
  if (mode === 'split-down') {
    const seen = new Set([root.id]);
    branches.forEach((branch, index) => {
      const direction = index % 2 ? -1 : 1;
      const lane = Math.floor(index / 2) + 1;
      let slot = 0;
      const place = (node: MindNode, depth: number) => {
        if (seen.has(node.id)) return;
        seen.add(node.id);
        node.x = direction * (lane * spacing.x + (depth - 1) * spacing.x * .4);
        node.y = depth * spacing.x + slot++ * spacing.y;
        (node.collapsed ? [] : kids(node.id)).forEach(child => place(child, depth + 1));
      };
      place(branch, 1);
    });
    return next;
  }
  if (mode === 'fishbone' || mode === 'timeline' || mode === 'fishbone-left' || mode === 'timeline-left') {
    const mirrored = mode.endsWith('-left');
    const timeline = mode.startsWith('timeline');
    const horizontal = mirrored ? -1 : 1;
    const seen = new Set([root.id]);
    branches.forEach((branch, index) => {
      const direction = index % 2 === 0 ? -1 : 1;
      const x = (index + 1) * spacing.x;
      branch.x = horizontal * x; branch.y = direction * spacing.y * (timeline ? 1 : 1.25);
      seen.add(branch.id);
      let row = 0;
      const place = (node: MindNode, depth: number) => {
        (node.collapsed ? [] : kids(node.id)).forEach(child => {
          if (seen.has(child.id)) return;
          seen.add(child.id);
          child.x = horizontal * (x + (timeline ? depth * spacing.x * .58 : (row % 2 ? 1 : -1) * spacing.x * .42));
          child.y = direction * spacing.y * (1.25 + depth + row * .75);
          row++; place(child, depth + 1);
        });
      };
      place(branch, 1);
    });
    return next;
  }
  const left = mode === 'right' ? [] : mode === 'left' ? branches : branches.filter((_, i) => i % 2 === 1);
  const right = branches.filter(n => !left.includes(n));
  const placeSide = (items: MindNode[], dir: number) => {
    let row = 0; const placed = new Set<string>();
    const place = (node: MindNode, depth: number, seen: Set<string>): number => {
      if (seen.has(node.id)) return row * spacing.y;
      seen.add(node.id); placed.add(node.id); node.x = dir * depth * spacing.x;
      const children = node.collapsed ? [] : kids(node.id).filter(n => !seen.has(n.id));
      if (!children.length) { node.y = row * spacing.y; row++; }
      else { const ys = children.map(child => place(child, depth + 1, new Set(seen))); node.y = (ys[0] + ys[ys.length - 1]) / 2; }
      return node.y;
    };
    items.forEach(n => place(n, 1, new Set([root.id])));
    const shift = ((row - 1) * spacing.y) / 2; placed.forEach(id => { const n = next.find(item => item.id === id)!; n.y -= shift; });
  };
  placeSide(right, 1); placeSide(left, -1); return next;
}
export function layoutBranch(nodes: MindNode[], id: string, mode: LayoutMode, spacing = { x: 260, y: 112 }): MindNode[] {
  if (mode === 'free' || mode === 'network') return nodes.map(node => ({ ...node }));
  const ids = descendants(nodes, id);
  const anchor = nodes.find(node => node.id === id);
  if (!anchor) return nodes;
  const branch = nodes.filter(node => ids.has(node.id)).map(node => node.id === id ? { ...node, parentId: null } : node);
  const placed = new Map(autoLayout(branch, mode, spacing).map(node => [node.id, node]));
  return nodes.map(node => { const position = placed.get(node.id); return position && !node.positionLocked ? { ...node, x: anchor.x + position.x, y: anchor.y + position.y } : node; });
}
export function layoutMap(nodes: MindNode[], mode: LayoutMode, spacing = { x: 260, y: 112 }): MindNode[] {
  let result = autoLayout(nodes, mode, spacing);
  // Preserve manually positioned branches when another part of the map is reorganized.
  nodes.filter(node => node.branchLayout === 'free' || node.branchLayout === 'network').forEach(branch => {
    const originals = new Map(nodes.filter(node => descendants(nodes, branch.id).has(node.id)).map(node => [node.id, node]));
    result = result.map(node => originals.has(node.id) ? { ...node, x: originals.get(node.id)!.x, y: originals.get(node.id)!.y } : node);
  });
  nodes.filter(node => node.branchLayout && node.branchLayout !== 'free' && node.branchLayout !== 'network').forEach(node => { result = layoutBranch(result, node.id, node.branchLayout!, spacing); });
  const originalPositions = new Map(nodes.filter(node => node.positionLocked).map(node => [node.id, { x: node.x, y: node.y }]));
  return result.map(node => originalPositions.has(node.id) ? { ...node, ...originalPositions.get(node.id)! } : node);
}
export function descendants(nodes: MindNode[], id: string): Set<string> {
  const found = new Set([id]); let changed = true;
  while (changed) { changed = false; for (const n of nodes) if (n.parentId && found.has(n.parentId) && !found.has(n.id)) { found.add(n.id); changed = true; } }
  return found;
}
export function visibleNodes(nodes: MindNode[]): MindNode[] {
  const byId = new Map(nodes.map(n => [n.id, n]));
  return nodes.filter(n => { let parent = n.parentId; const seen = new Set<string>(); while (parent) { if (seen.has(parent)) return false; seen.add(parent); const p = byId.get(parent); if (!p || p.collapsed) return false; parent = p.parentId; } return true; });
}
export function branchCounts(nodes: MindNode[]): Map<string, { direct: number; total: number }> {
  const children = new Map<string, string[]>();
  for (const node of nodes) if (node.parentId) children.set(node.parentId, [...(children.get(node.parentId) || []), node.id]);
  const totals = new Map<string, number>();
  const count = (id: string, path: Set<string>): number => {
    if (totals.has(id)) return totals.get(id)!;
    if (path.has(id)) return 0;
    const nextPath = new Set(path).add(id);
    const total = (children.get(id) || []).reduce((sum, childId) => sum + 1 + count(childId, nextPath), 0);
    totals.set(id, total);
    return total;
  };
  return new Map(nodes.map(node => [node.id, { direct: children.get(node.id)?.length || 0, total: count(node.id, new Set()) }]));
}
export function toggleBranch(nodes: MindNode[], id: string): MindNode[] {
  if (!nodes.some(node => node.parentId === id)) return nodes;
  // Only the clicked node changes; descendant collapse flags remain intact for reopening.
  return nodes.map(node => node.id === id ? { ...node, collapsed: !node.collapsed } : node);
}
export type BranchDirection = 'left' | 'right' | 'top' | 'bottom';
export function branchDirection(node: MindNode, children: MindNode[], layout: LayoutMode): BranchDirection {
  const mode = node.branchLayout || layout;
  if (['horizontal','right','fishbone','timeline'].includes(mode)) return 'right';
  if (['left','org-left','fishbone-left','timeline-left'].includes(mode)) return 'left';
  if (['vertical','down','org','flowchart','swimlane','matrix','treemap','split-down'].includes(mode)) return 'bottom';
  if (mode === 'up') return 'top';
  if (!children.length) return 'right';
  const dx = children.reduce((sum, child) => sum + child.x - node.x, 0) / children.length;
  const dy = children.reduce((sum, child) => sum + child.y - node.y, 0) / children.length;
  return Math.abs(dx) >= Math.abs(dy) ? dx < 0 ? 'left' : 'right' : dy < 0 ? 'top' : 'bottom';
}
export function treemapRects(nodes: MindNode[]): Map<string, { x: number; y: number; width: number; height: number; depth: number }> {
  const visible = visibleNodes(nodes);
  const root = visible.find(node => !node.parentId && !node.floating);
  const rects = new Map<string, { x: number; y: number; width: number; height: number; depth: number }>();
  if (!root) return rects;
  rects.set(root.id, { x: 440, y: -128, width: 320, height: 76, depth: 0 });
  const byParent = new Map<string, MindNode[]>();
  visible.forEach(node => { if (node.parentId) { const siblings = byParent.get(node.parentId); if (siblings) siblings.push(node); else byParent.set(node.parentId, [node]); } });
  const children = (id: string) => byParent.get(id) || [];
  const place = (siblings: MindNode[], x: number, y: number, width: number, height: number, depth: number) => {
    const total = siblings.reduce((sum, node) => sum + (node.treemapValue ?? 1), 0);
    let offset = 0;
    siblings.forEach((node, index) => {
      const fraction = index === siblings.length - 1 ? 1 - offset : (node.treemapValue ?? 1) / total;
      const horizontal = depth % 2 === 1;
      const rect = horizontal
        ? { x: x + width * offset, y, width: width * fraction, height, depth }
        : { x, y: y + height * offset, width, height: height * fraction, depth };
      rects.set(node.id, rect);
      offset += fraction;
      const nested = children(node.id);
      if (nested.length) place(nested, rect.x + 6, rect.y + 46, Math.max(0, rect.width - 12), Math.max(0, rect.height - 52), depth + 1);
    });
  };
  place(children(root.id), 0, 0, 1200, 720, 1);
  return rects;
}
export function toMarkdown(map: MindMap): string {
  const lines = [`# ${map.title}`, '']; const root = map.nodes.find(n => !n.parentId);
  const richLabel = (node: MindNode) => {
    if (!node.richText?.length) return node.text;
    const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
    return node.richText.map(run => {
      let value = escape(run.text);
      if (run.bold) value = `<strong>${value}</strong>`;
      if (run.italic) value = `<em>${value}</em>`;
      if (run.underline) value = `<u>${value}</u>`;
      if (run.strike) value = `<s>${value}</s>`;
      if (run.color && /^#[0-9a-f]{6}$/i.test(run.color)) value = `<span style="color:${run.color}">${value}</span>`;
      if (run.highlight && /^#[0-9a-f]{6}$/i.test(run.highlight)) value = `<mark style="background-color:${run.highlight}">${value}</mark>`;
      return value;
    }).join('');
  };
  const taskLine = (node: MindNode) => node.task ? `[${node.task.done ? 'x' : ' '}] ${richLabel(node)}` : richLabel(node);
  const details = (node: MindNode, depth: number) => {
    if (node.label) lines.push(`${'  '.repeat(depth)}Rótulo: ${node.label}`);
    if (node.equation) lines.push(`${'  '.repeat(depth)}Equação: ${node.equation}`);
    if (node.summary) lines.push(`${'  '.repeat(depth)}Resumo: ${node.summary}`);
    if (node.note) lines.push(`${'  '.repeat(depth)}${node.note.replace(/\n/g, ' ')}`);
    if (node.task?.due) lines.push(`${'  '.repeat(depth)}Prazo: ${node.task.due}`);
    if (node.mediaUrl) lines.push(`${'  '.repeat(depth)}[${node.mediaType === 'audio' ? 'Áudio' : 'Vídeo'}](${node.mediaUrl})`);
    node.comments?.forEach(comment => lines.push(`${'  '.repeat(depth)}Comentário: ${comment.text.replace(/\n/g, ' ')}`));
  };
  const visit = (id: string, depth: number, seen: Set<string>) => {
    map.nodes.filter(n => n.parentId === id && !seen.has(n.id)).forEach(n => {
      lines.push(`${'  '.repeat(depth)}- ${taskLine(n)}${n.url ? ` ([link](${n.url}))` : ''}`);
      details(n, depth + 1);
      visit(n.id, depth + 1, new Set([...seen, n.id]));
    });
  };
  if (root) { lines.push(`- ${taskLine(root)}`); details(root, 1); visit(root.id, 1, new Set([root.id])); }
  return lines.join('\n') + '\n';
}
