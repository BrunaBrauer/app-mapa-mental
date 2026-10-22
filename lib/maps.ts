import type { MindMap, MindNode, LayoutMode } from '../types';

export const uid = () => crypto.randomUUID();
export const rootNode = (text = 'Ideia central'): MindNode => ({ id: uid(), parentId: null, text, x: 0, y: 0, background: '#7057e8', border: '#7057e8', color: '#fff', fontSize: 18, bold: true });
export function createMap(title = 'Mapa sem título'): MindMap { return { id: uid(), title, layout: 'right', nodes: [rootNode()], updatedAt: Date.now() }; }

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
  map.nodes = autoLayout(map.nodes, 'right'); return map;
}

// Each visible leaf receives a row; parents are centered above their descendants.
export function autoLayout(nodes: MindNode[], mode: LayoutMode, spacing = { x: 260, y: 112 }): MindNode[] {
  const next = nodes.map(n => ({ ...n })); if (mode === 'free' || !next.length) return next;
  const root = next.find(n => !n.parentId && !n.floating) ?? next[0]; root.x = 0; root.y = 0;
  const kids = (id: string) => next.filter(n => n.parentId === id);
  const branches = kids(root.id);
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
      if (vertical) { node.x = position; node.y = direction * depth * spacing.x * (mode === 'org' ? .82 : 1); }
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
      node.x = Math.cos(angle) * depth * spacing.x;
      node.y = Math.sin(angle) * depth * Math.max(150, spacing.y * 1.55);
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
  if (mode === 'free') return nodes.map(node => ({ ...node }));
  const ids = descendants(nodes, id);
  const anchor = nodes.find(node => node.id === id);
  if (!anchor) return nodes;
  const branch = nodes.filter(node => ids.has(node.id)).map(node => node.id === id ? { ...node, parentId: null } : node);
  const placed = new Map(autoLayout(branch, mode, spacing).map(node => [node.id, node]));
  return nodes.map(node => { const position = placed.get(node.id); return position ? { ...node, x: anchor.x + position.x, y: anchor.y + position.y } : node; });
}
export function layoutMap(nodes: MindNode[], mode: LayoutMode, spacing = { x: 260, y: 112 }): MindNode[] {
  let result = autoLayout(nodes, mode, spacing);
  // Preserve manually positioned branches when another part of the map is reorganized.
  nodes.filter(node => node.branchLayout === 'free').forEach(branch => {
    const originals = new Map(nodes.filter(node => descendants(nodes, branch.id).has(node.id)).map(node => [node.id, node]));
    result = result.map(node => originals.has(node.id) ? { ...node, x: originals.get(node.id)!.x, y: originals.get(node.id)!.y } : node);
  });
  nodes.filter(node => node.branchLayout && node.branchLayout !== 'free').forEach(node => { result = layoutBranch(result, node.id, node.branchLayout!, spacing); });
  return result;
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
