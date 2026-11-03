'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { Maximize, ZoomIn, ZoomOut, Sparkles } from 'lucide-react';
import MapCanvas from './MapCanvas';
import { layoutMap, toggleBranch } from '../lib/maps';
import type { MindMap } from '../types';
export default function ShareViewer({ map }: { map: MindMap }) {
  const [grid, setGrid] = useState(true);
  const [viewMap, setViewMap] = useState(map);
  const toggleVisibleBranch = (id: string) => setViewMap(current => {
    const nodes = toggleBranch(current.nodes, id);
    if (nodes === current.nodes) return current;
    return { ...current, nodes: layoutMap(nodes, current.layout) };
  });
  const flowRef = useRef<{ zoomIn: () => void; zoomOut: () => void; fit: () => void } | null>(null);
  return <div className="share-viewer"><header><Link href="/" className="brand"><span className="brand-symbol"><Sparkles size={19}/></span><span>nodum<span className="brand-dot">.</span></span></Link><span className="readonly-label">Visualização somente leitura</span></header><div className="share-title"><h1>{viewMap.title}</h1><p>{viewMap.nodes.length} ideias conectadas</p></div><div className="share-canvas"><MapCanvas map={viewMap} selectedId={null} onSelect={() => {}} onChange={() => {}} onAdd={() => {}} onEdit={() => {}} onToggle={toggleVisibleBranch} readOnly grid={grid} flowRef={flowRef}/></div><div className="share-controls"><button onClick={() => setGrid(!grid)}>{grid ? 'Ocultar grade' : 'Mostrar grade'}</button><button onClick={() => flowRef.current?.zoomOut()} title="Diminuir zoom"><ZoomOut size={17}/></button><button onClick={() => flowRef.current?.zoomIn()} title="Aumentar zoom"><ZoomIn size={17}/></button><button onClick={() => flowRef.current?.fit()} title="Ajustar à tela"><Maximize size={17}/></button></div></div>;
}
