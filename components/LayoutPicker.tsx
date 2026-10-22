import { useMemo } from 'react';
import type { LayoutMode, MindNode } from '../types';
import { autoLayout } from '../lib/maps';

export const layoutOptions: { mode: LayoutMode; label: string }[] = [
  { mode: 'right', label: 'À direita' },
  { mode: 'balanced', label: 'Mapa mental' },
  { mode: 'left', label: 'À esquerda' },
  { mode: 'radial', label: 'Radial' },
  { mode: 'down', label: 'De cima para baixo' },
  { mode: 'up', label: 'De baixo para cima' },
  { mode: 'split-down', label: 'Cascata bilateral' },
  { mode: 'org', label: 'Organograma' },
  { mode: 'org-left', label: 'Organograma à esquerda' },
  { mode: 'fishbone', label: 'Espinha de peixe' },
  { mode: 'fishbone-left', label: 'Espinha invertida' },
  { mode: 'timeline', label: 'Linha do tempo' },
  { mode: 'timeline-left', label: 'Linha do tempo inversa' },
  { mode: 'free', label: 'Livre' },
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
  const nodes = useMemo(() => mode === 'free' ? sample : autoLayout(sample, mode, { x: 180, y: 100 }), [mode]);
  const byId = new Map(nodes.map(node => [node.id, node]));
  const minX = Math.min(...nodes.map(node => node.x));
  const maxX = Math.max(...nodes.map(node => node.x));
  const minY = Math.min(...nodes.map(node => node.y));
  const maxY = Math.max(...nodes.map(node => node.y));
  const scale = Math.min(62 / Math.max(1, maxX - minX), 31 / Math.max(1, maxY - minY));
  const x = (node: MindNode) => 9 + (node.x - minX) * scale;
  const y = (node: MindNode) => 8 + (node.y - minY) * scale;
  return <svg className="layout-mini" viewBox="0 0 82 48" aria-hidden="true">
    {nodes.map(node => { const parent = node.parentId ? byId.get(node.parentId) : null; return parent ? <line key={`l-${node.id}`} x1={x(parent)} y1={y(parent)} x2={x(node)} y2={y(node)} /> : null; })}
    {nodes.map(node => <rect key={node.id} x={x(node) - (node.parentId ? 4 : 5)} y={y(node) - 3} width={node.parentId ? 8 : 10} height="6" rx="1.5" className={node.parentId ? '' : 'layout-mini-root'} />)}
  </svg>;
}

export default function LayoutPicker({ selected, onChoose }: { selected: LayoutMode; onChoose: (mode: LayoutMode) => void }) {
  return <div className="layout-picker" role="group" aria-label="Escolher layout do ramo">
    {layoutOptions.map(({ mode, label }) => <button key={mode} type="button" className={selected === mode ? 'active' : ''} aria-label={label} aria-pressed={selected === mode} title={label} onClick={() => onChoose(mode)}><LayoutMini mode={mode}/><span>{label}</span></button>)}
  </div>;
}
