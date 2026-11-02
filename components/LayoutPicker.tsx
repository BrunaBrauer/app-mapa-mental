import { useMemo } from 'react';
import type { LayoutMode, MindNode } from '../types';
import { autoLayout, treemapRects } from '../lib/maps';

export const layoutOptions: { mode: LayoutMode; label: string }[] = [
  { mode: 'radial', label: 'Radial' },
  { mode: 'horizontal', label: 'Horizontal' },
  { mode: 'vertical', label: 'Vertical' },
  { mode: 'bilateral', label: 'Bilateral' },
  { mode: 'fishbone', label: 'Espinha de peixe' },
  { mode: 'flowchart', label: 'Fluxograma' },
  { mode: 'swimlane', label: 'Raias' },
  { mode: 'cycle', label: 'Cíclico' },
  { mode: 'concept', label: 'Mapa conceitual' },
  { mode: 'network', label: 'Rede' },
  { mode: 'matrix', label: 'Matriz' },
  { mode: 'timeline', label: 'Linha do tempo' },
  { mode: 'concentric', label: 'Concêntrico' },
  { mode: 'treemap', label: 'Treemap' },
];

const sample: MindNode[] = [
  { id: 'r', parentId: null, text: '', x: 0, y: 0 },
  { id: 'a', parentId: 'r', text: '', x: 260, y: -100 },
  { id: 'b', parentId: 'r', text: '', x: -260, y: 100, side: 'left' },
  { id: 'c', parentId: 'r', text: '', x: 260, y: 130 },
  { id: 'd', parentId: 'a', text: '', x: 490, y: -145 },
  { id: 'e', parentId: 'a', text: '', x: 490, y: -45 },
  { id: 'f', parentId: 'c', text: '', x: 490, y: 145 },
];

function LayoutMini({ mode }: { mode: LayoutMode }) {
  const nodes = useMemo(() => mode === 'network' ? sample : autoLayout(sample, mode, { x: 180, y: 100 }), [mode]);
  const byId = new Map(nodes.map(node => [node.id, node]));
  const minX = Math.min(...nodes.map(node => node.x));
  const maxX = Math.max(...nodes.map(node => node.x));
  const minY = Math.min(...nodes.map(node => node.y));
  const maxY = Math.max(...nodes.map(node => node.y));
  const scale = Math.min(62 / Math.max(1, maxX - minX), 31 / Math.max(1, maxY - minY));
  const x = (node: MindNode) => 9 + (node.x - minX) * scale;
  const y = (node: MindNode) => 8 + (node.y - minY) * scale;
  const center = nodes.find(node => !node.parentId)!;
  const stages = nodes.filter(node => node.parentId === center.id);
  const rings = mode === 'concentric' ? [stages, nodes.filter(node => stages.some(parent => parent.id === node.parentId))].filter(level => level.length).map(level => Math.max(...level.map(node => Math.hypot(x(node) - x(center), y(node) - y(center))))) : [];
  if (mode === 'treemap') {
    const rects = treemapRects(sample);
    return <svg className="layout-mini" viewBox="0 0 82 48" aria-hidden="true">{sample.filter(node => node.parentId).map(node => { const rect = rects.get(node.id)!; return <rect key={node.id} x={5 + rect.x * .06} y={5 + rect.y * .05} width={Math.max(2, rect.width * .06)} height={Math.max(2, rect.height * .05)} fill="none" stroke="currentColor"/>; })}</svg>;
  }
  if (mode === 'matrix') return <svg className="layout-mini" viewBox="0 0 82 48" aria-hidden="true">{[0, 1].flatMap(row => [0, 1].map(column => <rect key={`${row}:${column}`} x={8 + column * 32} y={4 + row * 20} width="31" height="19" fill="none" stroke="currentColor"/>))}</svg>;
  if (mode === 'swimlane') return <svg className="layout-mini" viewBox="0 0 82 48" aria-hidden="true">{[0, 1, 2].map(lane => <g key={lane}><rect x={3 + lane * 26} y="2" width="24" height="44" fill="none" stroke="currentColor"/><rect x={9 + lane * 26} y="8" width="12" height="5" rx="1"/><rect x={9 + lane * 26} y="22" width="12" height="5" rx="1"/></g>)}</svg>;
  return <svg className="layout-mini" viewBox="0 0 82 48" aria-hidden="true">
    {rings.map((radius, index) => <circle key={index} cx={x(center)} cy={y(center)} r={radius} fill="none" stroke="currentColor" opacity=".45"/>)}
    {nodes.map(node => { const parent = node.parentId ? byId.get(node.parentId) : null; return parent && !(mode === 'cycle' && parent.id === center.id) ? <line key={`l-${node.id}`} x1={x(parent)} y1={y(parent)} x2={x(node)} y2={y(node)} /> : null; })}
    {mode === 'cycle' && stages.length > 1 && stages.map((stage, index) => <line key={`cycle-${stage.id}`} x1={x(stage)} y1={y(stage)} x2={x(stages[(index + 1) % stages.length])} y2={y(stages[(index + 1) % stages.length])}/>)}
    {nodes.map(node => <rect key={node.id} x={x(node) - (node.parentId ? 4 : 5)} y={y(node) - 3} width={node.parentId ? 8 : 10} height="6" rx="1.5" className={node.parentId ? '' : 'layout-mini-root'} />)}
  </svg>;
}

export default function LayoutPicker({ selected, onChoose, isRoot = false }: { selected: LayoutMode; onChoose: (mode: LayoutMode) => void; isRoot?: boolean }) {
  return <div className="layout-picker" role="group" aria-label={isRoot ? 'Escolher layout do mapa' : 'Escolher layout do ramo'}>
    {layoutOptions.filter(({ mode }) => isRoot || !['swimlane', 'cycle', 'concept', 'matrix', 'concentric', 'flowchart', 'treemap'].includes(mode)).map(({ mode, label }) => <button key={mode} type="button" className={selected === mode ? 'active' : ''} aria-label={label} aria-pressed={selected === mode} title={label} onClick={() => onChoose(mode)}><LayoutMini mode={mode}/><span>{label}</span></button>)}
  </div>;
}
