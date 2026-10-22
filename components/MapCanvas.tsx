'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ReactFlow, Background, BackgroundVariant, Controls, ConnectionLineType, MarkerType, ReactFlowProvider, ViewportPortal, useReactFlow, type Connection, type NodeChange, type Node, type NodePositionChange } from '@xyflow/react';
import MindNodeView, { type FlowMindNode } from './MindNodeView';
import type { NodeAction } from './NodeQuickToolbar';
import type { MindMap, MindNode } from '../types';
import { descendants, visibleNodes } from '../lib/maps';

type Props = { map: MindMap; selectedId: string | null; onSelect: (id: string | null) => void; onChange: (map: MindMap) => void; onAdd: (id: string) => void; onEdit: (id: string, text: string) => void; onToggle: (id: string) => void; onAction?: (id: string, action: NodeAction) => void; onPatch?: (id: string, patch: Partial<MindNode>) => void; onImage?: (id: string, file: File) => void; onDrivePick?: (id: string, kind: 'image' | 'link') => void; alwaysToolbar?: boolean; onToggleAlwaysToolbar?: (value: boolean) => void; grid: boolean; readOnly?: boolean; flowRef?: React.MutableRefObject<{ zoomIn: () => void; zoomOut: () => void; fit: () => void } | null> };
const nodeTypes = { mind: MindNodeView };
function InnerCanvas({ map, selectedId, onSelect, onChange, onAdd, onEdit, onToggle, onAction, onPatch, onImage, onDrivePick, alwaysToolbar = true, onToggleAlwaysToolbar, grid, readOnly, flowRef }: Props) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [contextNodeId, setContextNodeId] = useState<string | null>(null);
  useEffect(() => {
    if (!flowRef) return;
    flowRef.current = { zoomIn: () => zoomIn(), zoomOut: () => zoomOut(), fit: () => fitView({ padding: 0.22, duration: 400 }) };
    return () => { flowRef.current = null; };
  }, [flowRef, zoomIn, zoomOut, fitView]);
  const visible = useMemo(() => visibleNodes(map.nodes), [map.nodes]);
  useEffect(() => { fitView({ padding: 0.3, maxZoom: 1, duration: 350 }); }, [map.id, visible.length, fitView]);
  const nodes = useMemo<FlowMindNode[]>(() => visible.map(item => ({ id: item.id, type: 'mind', position: { x: item.x, y: item.y }, selected: item.id === selectedId, draggable: !readOnly, data: { item, childCount: map.nodes.filter(n => n.parentId === item.id).length, selected: item.id === selectedId, mapLayout: map.layout, toolbarVisible: alwaysToolbar || contextNodeId === item.id, alwaysToolbar, onToggleAlwaysToolbar, readOnly, onAdd, onEdit, onToggle, onAction, onPatch, onImage, onDrivePick } })), [visible, map.nodes, map.layout, selectedId, contextNodeId, alwaysToolbar, onToggleAlwaysToolbar, readOnly, onAdd, onEdit, onToggle, onAction, onPatch, onImage, onDrivePick]);
  const edges = useMemo(() => { const tree = visible.filter(n => n.parentId && visible.some(p => p.id === n.parentId)).map(n => {
    const parent = map.nodes.find(p => p.id === n.parentId)!; const dx = n.x - parent.x; const dy = n.y - parent.y;
    const vertical = Math.abs(dy) > Math.abs(dx) * 1.1;
    const sourceHandle = vertical ? (dy < 0 ? 'source-top' : 'source-bottom') : (dx < 0 ? 'source-left' : 'source-right');
    const targetHandle = vertical ? (dy < 0 ? 'target-bottom' : 'target-top') : (dx < 0 ? 'target-right' : 'target-left');
    return { id: `${n.parentId}-${n.id}`, source: n.parentId!, target: n.id, sourceHandle, targetHandle, type: 'smoothstep', animated: false, style: { stroke: '#b9b4db', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#b9b4db', width: 14, height: 14 } };
  }); const relationships = (map.relationships || []).filter(link => visible.some(n => n.id === link.source) && visible.some(n => n.id === link.target)).map(link => ({ id: link.id, source: link.source, target: link.target, type: 'smoothstep', label: link.label, style: { stroke: '#41baa3', strokeWidth: 2, strokeDasharray: '6 4' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#41baa3', width: 14, height: 14 } })); return [...tree, ...relationships]; }, [visible, map.nodes, map.relationships]);
  const mini = useMemo(() => { const xs = visible.map(n => n.x); const ys = visible.map(n => n.y); const x = Math.min(...xs, 0) - 45; const y = Math.min(...ys, 0) - 50; const width = Math.max(...xs, 0) - x + 215; const height = Math.max(...ys, 0) - y + 120; return { x, y, width, height }; }, [visible]);
  const annotations = useMemo(() => visible.filter(n => n.boundary || n.summary).map(node => {
    const branchIds = descendants(map.nodes, node.id); const branch = visible.filter(item => branchIds.has(item.id));
    const x = Math.min(...branch.map(item => item.x)) - 28; const y = Math.min(...branch.map(item => item.y)) - 28;
    const right = Math.max(...branch.map(item => item.x + 230)) + 28; const bottom = Math.max(...branch.map(item => item.y + 85)) + 28;
    return { node, x, y, width: right - x, height: bottom - y };
  }), [visible, map.nodes]);
  const onNodesChange = useCallback((changes: NodeChange<Node>[]) => {
    if (readOnly) return;
    const moved = changes.filter((c): c is NodePositionChange => c.type === 'position' && Boolean(c.position) && !c.dragging);
    if (!moved.length) return;
    const positions = new Map(moved.map(c => [c.id, c.position!]));
    onChange({ ...map, layout: 'free', nodes: map.nodes.map(n => positions.has(n.id) ? { ...n, x: positions.get(n.id)!.x, y: positions.get(n.id)!.y } : n) });
  }, [map, onChange, readOnly]);
  const onConnect = useCallback((connection: Connection) => {
    if (readOnly || !connection.source || !connection.target || connection.source === connection.target) return;
    const target = map.nodes.find(n => n.id === connection.target); if (!target || !target.parentId || descendants(map.nodes, target.id).has(connection.source)) return;
    const source = map.nodes.find(n => n.id === connection.source)!;
    onChange({ ...map, nodes: map.nodes.map(n => n.id === target.id ? { ...n, parentId: source.id, side: n.x < source.x ? 'left' : 'right' } : n) });
  }, [map, onChange, readOnly]);
  return <div className="canvas-surface" onKeyDown={e => { if (e.code === 'Space' && !['INPUT','TEXTAREA'].includes((e.target as HTMLElement).tagName)) { setSpaceHeld(true); e.preventDefault(); } }} onKeyUp={e => { if (e.code === 'Space') setSpaceHeld(false); }} tabIndex={0}>
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onConnect={onConnect} onNodeClick={(_e, node) => { setContextNodeId(null); onSelect(node.id); }} onNodeContextMenu={(event, node) => { if (readOnly) return; event.preventDefault(); setContextNodeId(node.id); onSelect(node.id); }} onPaneClick={() => { setContextNodeId(null); onSelect(null); }} fitView fitViewOptions={{ padding: 0.3, maxZoom: 1 }} minZoom={0.18} maxZoom={2.5} panOnDrag={spaceHeld ? [0, 1, 2] : [1, 2]} zoomOnScroll selectionOnDrag={!spaceHeld && !readOnly} nodesConnectable={!readOnly} nodesDraggable={!readOnly} elementsSelectable connectionLineType={ConnectionLineType.SmoothStep}>
      {grid && <Background variant={BackgroundVariant.Dots} gap={22} size={1.1} color="#dadde9" />}
      <ViewportPortal>{annotations.map(({ node, x, y, width, height }) => <div key={node.id} className="branch-annotation" style={{ left: x, top: y, width, height }}>{node.boundary && <div className="branch-boundary"/>}{node.summary && <div className="branch-summary">{node.summary}</div>}</div>)}</ViewportPortal>
      <Controls position="bottom-left" showInteractive={false}/>
    </ReactFlow>
    <button className="custom-minimap" onClick={() => fitView({ padding: 0.3, duration: 350 })} title="Ajustar mapa à tela"><svg viewBox={`${mini.x} ${mini.y} ${mini.width} ${mini.height}`} preserveAspectRatio="xMidYMid meet">{visible.map(n => { const p = visible.find(item => item.id === n.parentId); return p ? <line key={`e-${n.id}`} x1={p.x + 72} y1={p.y + 25} x2={n.x + 72} y2={n.y + 25} stroke="#bcb5de" strokeWidth="8"/> : null; })}{visible.map(n => <rect key={n.id} x={n.x} y={n.y} width={n.parentId ? 145 : 180} height={n.parentId ? 50 : 62} rx="13" fill={n.parentId ? '#b3a5ed' : '#7057e8'}/>)}</svg></button>
  </div>;
}
export default function MapCanvas(props: Props) { return <ReactFlowProvider><InnerCanvas {...props}/></ReactFlowProvider>; }
