'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ReactFlow, Background, BackgroundVariant, Controls, ConnectionLineType, MarkerType, ReactFlowProvider, ViewportPortal, useReactFlow, type Connection, type NodeChange, type Node, type NodePositionChange } from '@xyflow/react';
import MindNodeView, { type FlowMindNode } from './MindNodeView';
import StyledEdge from './StyledEdge';
import type { NodeAction } from './NodeQuickToolbar';
import type { LineStyle, MindMap, MindNode } from '../types';
import { descendants, visibleNodes } from '../lib/maps';

type Props = { map: MindMap; selectedId: string | null; onSelect: (id: string | null) => void; onSelectEdge?: (id: string) => void; onChange: (map: MindMap) => void; onAdd: (id: string) => void; onEdit: (id: string, text: string) => void; onToggle: (id: string) => void; onAction?: (id: string, action: NodeAction) => void; onPatch?: (id: string, patch: Partial<MindNode>) => void; onImage?: (id: string, file: File) => void; onDrivePick?: (id: string, kind: 'image' | 'link') => void; alwaysToolbar?: boolean; onToggleAlwaysToolbar?: (value: boolean) => void; grid: boolean; readOnly?: boolean; flowRef?: React.MutableRefObject<{ zoomIn: () => void; zoomOut: () => void; fit: () => void } | null> };
const nodeTypes = { mind: MindNodeView };
const edgeTypes = { styled: StyledEdge };
const edgeMarker = (symbol: LineStyle['end'], color: string) => symbol === 'none' ? undefined : symbol === 'circle' ? 'url(#mindora-circle)' : symbol === 'diamond' ? 'url(#mindora-diamond)' : { type: MarkerType.ArrowClosed, color, width: 14, height: 14 };
const edgeDash = (style?: LineStyle) => style?.pattern === 'dashed' ? '8 5' : style?.pattern === 'dotted' ? '2 5' : undefined;
function InnerCanvas({ map, selectedId, onSelect, onSelectEdge, onChange, onAdd, onEdit, onToggle, onAction, onPatch, onImage, onDrivePick, alwaysToolbar = true, onToggleAlwaysToolbar, grid, readOnly, flowRef }: Props) {
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
  const nodes = useMemo<FlowMindNode[]>(() => { const childCounts = new Map<string, number>(); for (const node of map.nodes) if (node.parentId) childCounts.set(node.parentId, (childCounts.get(node.parentId) || 0) + 1); return visible.map(item => ({ id: item.id, type: 'mind', position: { x: item.x, y: item.y }, selected: item.id === selectedId, draggable: !readOnly, data: { item, childCount: childCounts.get(item.id) || 0, selected: item.id === selectedId, mapLayout: map.layout, toolbarVisible: alwaysToolbar || contextNodeId === item.id, alwaysToolbar, onToggleAlwaysToolbar, readOnly, onAdd, onEdit, onToggle, onAction, onPatch, onImage, onDrivePick } })); }, [visible, map.nodes, map.layout, selectedId, contextNodeId, alwaysToolbar, onToggleAlwaysToolbar, readOnly, onAdd, onEdit, onToggle, onAction, onPatch, onImage, onDrivePick]);
  const edges = useMemo(() => { const byId = new Map(visible.map(node => [node.id, node])); const tree = visible.filter(n => n.parentId && byId.has(n.parentId)).map(n => {
    const parent = byId.get(n.parentId!)!; const dx = n.x - parent.x; const dy = n.y - parent.y;
    const vertical = Math.abs(dy) > Math.abs(dx) * 1.1;
    const sourceHandle = vertical ? (dy < 0 ? 'source-top' : 'source-bottom') : (dx < 0 ? 'source-left' : 'source-right');
    const targetHandle = vertical ? (dy < 0 ? 'target-bottom' : 'target-top') : (dx < 0 ? 'target-right' : 'target-left');
    const line = n.connectionStyle; const color = line?.color || '#b9b4db';
    return { id: `${n.parentId}-${n.id}`, source: n.parentId!, target: n.id, sourceHandle, targetHandle, type: 'styled', data: { line: { ...line, color } }, animated: false, style: { stroke: color, strokeWidth: line?.width ?? 2, strokeDasharray: edgeDash(line) }, markerStart: edgeMarker(line?.start ?? 'none', color), markerEnd: edgeMarker(line?.end ?? 'arrow', color) };
  }); const relationships = (map.relationships || []).filter(link => byId.has(link.source) && byId.has(link.target)).map(link => { const line = link.style; const color = line?.color || '#41baa3'; return { id: link.id, source: link.source, target: link.target, type: 'styled', data: { line: { pattern: 'dashed' as const, ...line, color } }, label: link.label, style: { stroke: color, strokeWidth: line?.width ?? 2, strokeDasharray: edgeDash(line) ?? '6 4' }, markerStart: edgeMarker(line?.start ?? 'none', color), markerEnd: edgeMarker(line?.end ?? 'arrow', color) }; }); return [...tree, ...relationships]; }, [visible, map.relationships]);
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
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={onNodesChange} onConnect={onConnect} onNodeClick={(_e, node) => { setContextNodeId(null); onSelect(node.id); }} onEdgeClick={(_event, edge) => { if (readOnly) return; if (map.relationships?.some(link => link.id === edge.id)) onSelectEdge?.(edge.id); else onSelect(edge.target); }} onNodeContextMenu={(event, node) => { if (readOnly) return; event.preventDefault(); setContextNodeId(node.id); onSelect(node.id); }} onPaneClick={() => { setContextNodeId(null); onSelect(null); }} fitView fitViewOptions={{ padding: 0.3, maxZoom: 1 }} minZoom={0.18} maxZoom={2.5} panOnDrag={spaceHeld ? [0, 1, 2] : [1, 2]} zoomOnScroll selectionOnDrag={!spaceHeld && !readOnly} nodesConnectable={!readOnly} nodesDraggable={!readOnly} elementsSelectable connectionLineType={ConnectionLineType.SmoothStep}>
      <svg aria-hidden="true" width="0" height="0"><defs><marker id="mindora-circle" markerWidth="12" markerHeight="12" refX="6" refY="6" orient="auto" markerUnits="userSpaceOnUse"><circle cx="6" cy="6" r="4" fill="context-stroke"/></marker><marker id="mindora-diamond" markerWidth="12" markerHeight="12" refX="6" refY="6" orient="auto" markerUnits="userSpaceOnUse"><path d="M6 1 L11 6 L6 11 L1 6 Z" fill="context-stroke"/></marker></defs></svg>
      {grid && <Background variant={BackgroundVariant.Dots} gap={22} size={1.1} color="#dadde9" />}
      <ViewportPortal>{annotations.map(({ node, x, y, width, height }) => <div key={node.id} className="branch-annotation" style={{ left: x, top: y, width, height }}>{node.boundary && <div className="branch-boundary"/>}{node.summary && <div className="branch-summary">{node.summary}</div>}</div>)}</ViewportPortal>
      <Controls position="bottom-left" showInteractive={false}/>
    </ReactFlow>
    <button className="custom-minimap" onClick={() => fitView({ padding: 0.3, duration: 350 })} title="Ajustar mapa à tela"><svg viewBox={`${mini.x} ${mini.y} ${mini.width} ${mini.height}`} preserveAspectRatio="xMidYMid meet">{visible.map(n => { const p = visible.find(item => item.id === n.parentId); return p ? <line key={`e-${n.id}`} x1={p.x + 72} y1={p.y + 25} x2={n.x + 72} y2={n.y + 25} stroke="#bcb5de" strokeWidth="8"/> : null; })}{visible.map(n => <rect key={n.id} x={n.x} y={n.y} width={n.parentId ? 145 : 180} height={n.parentId ? 50 : 62} rx="13" fill={n.parentId ? '#b3a5ed' : '#7057e8'}/>)}</svg></button>
  </div>;
}
export default function MapCanvas(props: Props) { return <ReactFlowProvider><InnerCanvas {...props}/></ReactFlowProvider>; }
