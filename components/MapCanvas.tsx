'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ReactFlow, Background, BackgroundVariant, Controls, ConnectionLineType, ConnectionMode, MarkerType, ReactFlowProvider, ViewportPortal, useReactFlow, type Connection, type NodeChange, type Node, type NodePositionChange } from '@xyflow/react';
import MindNodeView, { type FlowMindNode } from './MindNodeView';
import type { ImportedFont } from '../lib/fonts';
import StyledEdge from './StyledEdge';
import type { NodeAction } from './NodeQuickToolbar';
import type { LineStyle, MindMap, MindNode } from '../types';
import { descendants, visibleNodes } from '../lib/maps';

type Props = { map: MindMap; selectedId: string | null; onSelect: (id: string | null) => void; onSelectEdge?: (id: string) => void; onChange: (map: MindMap) => void; onAdd: (id: string) => void; onEdit: (id: string, text: string) => void; onToggle: (id: string) => void; onAction?: (id: string, action: NodeAction) => void; onOpenQuick?: (id: string, panel: 'notes' | 'comments') => void; onPatch?: (id: string, patch: Partial<MindNode>) => void; onImage?: (id: string, file: File) => void; onDrivePick?: (id: string, kind: 'image' | 'link') => void; fonts?: ImportedFont[]; onImportFont?: (id: string, file: File) => Promise<void>; onFavoriteIcons?: (icons: string[]) => void; quickPanel?: { id: string; panel: 'notes' | 'comments'; key: number } | null; alwaysToolbar?: boolean; onToggleAlwaysToolbar?: (value: boolean) => void; grid: boolean; readOnly?: boolean; flowRef?: React.MutableRefObject<{ zoomIn: () => void; zoomOut: () => void; fit: () => void } | null> };
const nodeTypes = { mind: MindNodeView };
const edgeTypes = { styled: StyledEdge };
const edgeMarker = (symbol: LineStyle['end'], color: string) => symbol === 'arrow' ? { type: MarkerType.ArrowClosed, color, width: 14, height: 14 } : undefined;
const edgeDash = (style?: LineStyle) => style?.pattern === 'dashed' ? '8 5' : style?.pattern === 'dotted' ? '2 5' : undefined;
function InnerCanvas({ map, selectedId, onSelect, onSelectEdge, onChange, onAdd, onEdit, onToggle, onAction, onOpenQuick, onPatch, onImage, onDrivePick, fonts, onImportFont, onFavoriteIcons, quickPanel, alwaysToolbar = true, onToggleAlwaysToolbar, grid, readOnly, flowRef }: Props) {
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
  const nodes = useMemo<FlowMindNode[]>(() => { const childCounts = new Map<string, number>(); for (const node of map.nodes) if (node.parentId) childCounts.set(node.parentId, (childCounts.get(node.parentId) || 0) + 1); return visible.map(item => ({ id: item.id, type: 'mind', position: { x: item.x, y: item.y }, selected: item.id === selectedId, draggable: !readOnly, data: { item, childCount: childCounts.get(item.id) || 0, selected: item.id === selectedId, mapLayout: map.layout, toolbarVisible: alwaysToolbar || contextNodeId === item.id || quickPanel?.id === item.id, alwaysToolbar, onToggleAlwaysToolbar, readOnly, onAdd, onEdit, onToggle, onAction, onOpenQuick, onPatch, onImage, onDrivePick, fonts, onImportFont, favoriteIcons: map.favoriteIcons || [], onFavoriteIcons, requestedPanel: quickPanel?.id === item.id ? quickPanel : null } })); }, [visible, map.nodes, map.layout, map.favoriteIcons, selectedId, contextNodeId, quickPanel, alwaysToolbar, onToggleAlwaysToolbar, readOnly, onAdd, onEdit, onToggle, onAction, onOpenQuick, onPatch, onImage, onDrivePick, fonts, onImportFont, onFavoriteIcons]);
  const edges = useMemo(() => { const byId = new Map(visible.map(node => [node.id, node])); const tree = visible.filter(n => n.parentId && byId.has(n.parentId)).map(n => {
    const parent = byId.get(n.parentId!)!; const dx = n.x - parent.x; const dy = n.y - parent.y;
    const vertical = Math.abs(dy) > Math.abs(dx) * 1.1;
    const sourceHandle = vertical ? (dy < 0 ? 'source-top' : 'source-bottom') : (dx < 0 ? 'source-left' : 'source-right');
    const targetHandle = vertical ? (dy < 0 ? 'source-bottom' : 'source-top') : (dx < 0 ? 'source-right' : 'source-left');
    const line = n.connectionStyle; const color = line?.color || '#b9b4db';
    return { id: `${n.parentId}-${n.id}`, source: n.parentId!, target: n.id, sourceHandle, targetHandle, type: 'styled', data: { line: { ...line, color } }, animated: false, style: { stroke: color, strokeWidth: line?.width ?? 2, strokeDasharray: edgeDash(line) }, markerStart: edgeMarker(line?.start ?? 'none', color), markerEnd: edgeMarker(line?.end ?? 'arrow', color) };
  }); const relationships = (map.relationships || []).filter(link => byId.has(link.source) && byId.has(link.target)).map(link => { const line = link.style; const color = line?.color || '#41baa3'; const source = byId.get(link.source)!; const target = byId.get(link.target)!; const dx = target.x - source.x; const dy = target.y - source.y; const vertical = Math.abs(dy) > Math.abs(dx); const sourceHandle = link.sourceHandle || (vertical ? (dy < 0 ? 'source-top' : 'source-bottom') : (dx < 0 ? 'source-left' : 'source-right')); const targetHandle = link.targetHandle || (vertical ? (dy < 0 ? 'source-bottom' : 'source-top') : (dx < 0 ? 'source-right' : 'source-left')); return { id: link.id, source: link.source, target: link.target, sourceHandle, targetHandle, type: 'styled', data: { line: { pattern: 'dashed' as const, ...line, color } }, label: link.label, style: { stroke: color, strokeWidth: line?.width ?? 2, strokeDasharray: edgeDash(line) ?? '6 4' }, markerStart: edgeMarker(line?.start ?? 'none', color), markerEnd: edgeMarker(line?.end ?? 'arrow', color) }; }); return [...tree, ...relationships]; }, [visible, map.relationships]);
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
    // O gesto nos conectores cria uma relação livre sem alterar a árvore.
    if (map.relationships?.some(link => link.source === connection.source && link.target === connection.target && link.sourceHandle === connection.sourceHandle && link.targetHandle === connection.targetHandle)) return;
    onChange({ ...map, relationships: [...(map.relationships || []), { id: crypto.randomUUID(), source: connection.source, target: connection.target, sourceHandle: connection.sourceHandle || undefined, targetHandle: connection.targetHandle || undefined }] });
  }, [map, onChange, readOnly]);
  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent, state: { isValid: boolean | null; fromNode: { id: string } | null; fromHandle: { id?: string | null } | null }) => {
    if (readOnly || state.isValid || !state.fromNode) return;
    const pointer = 'changedTouches' in event ? event.changedTouches[0] : event;
    const element = document.elementFromPoint(pointer.clientX, pointer.clientY);
    const targetElement = element?.closest<HTMLElement>('.react-flow__node[data-id]');
    const targetId = targetElement?.dataset.id;
    if (!targetId || targetId === state.fromNode.id || !map.nodes.some(node => node.id === targetId)) return;
    const bounds = targetElement.getBoundingClientRect();
    const distances = [
      ['source-left', Math.abs(pointer.clientX - bounds.left)],
      ['source-right', Math.abs(pointer.clientX - bounds.right)],
      ['source-top', Math.abs(pointer.clientY - bounds.top)],
      ['source-bottom', Math.abs(pointer.clientY - bounds.bottom)],
    ] as const;
    const targetHandle = [...distances].sort((a, b) => a[1] - b[1])[0][0];
    const sourceHandle = state.fromHandle?.id || 'source-right';
    if (map.relationships?.some(link => link.source === state.fromNode!.id && link.target === targetId && link.sourceHandle === sourceHandle && link.targetHandle === targetHandle)) return;
    onChange({ ...map, relationships: [...(map.relationships || []), { id: crypto.randomUUID(), source: state.fromNode.id, target: targetId, sourceHandle, targetHandle }] });
  }, [map, onChange, readOnly]);
  return <div className="canvas-surface" onKeyDown={e => { if (e.code === 'Space' && !['INPUT','TEXTAREA'].includes((e.target as HTMLElement).tagName)) { setSpaceHeld(true); e.preventDefault(); } }} onKeyUp={e => { if (e.code === 'Space') setSpaceHeld(false); }} tabIndex={0}>
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={onNodesChange} onConnect={onConnect} onConnectEnd={onConnectEnd} onNodeClick={(_e, node) => { setContextNodeId(null); onSelect(node.id); }} onEdgeClick={(_event, edge) => { if (readOnly) return; if (map.relationships?.some(link => link.id === edge.id)) onSelectEdge?.(edge.id); else onSelect(edge.target); }} onNodeContextMenu={(event, node) => { if (readOnly) return; event.preventDefault(); setContextNodeId(node.id); onSelect(node.id); }} onPaneClick={() => { setContextNodeId(null); onSelect(null); }} fitView fitViewOptions={{ padding: 0.3, maxZoom: 1 }} minZoom={0.18} maxZoom={2.5} panOnDrag={spaceHeld ? [0, 1, 2] : [1, 2]} zoomOnScroll selectionOnDrag={!spaceHeld && !readOnly} nodesConnectable={!readOnly} connectionMode={ConnectionMode.Loose} nodesDraggable={!readOnly} elementsSelectable connectionLineType={ConnectionLineType.SmoothStep}>
      {grid && <Background variant={BackgroundVariant.Dots} gap={22} size={1.1} color="#dadde9" />}
      <ViewportPortal>{annotations.map(({ node, x, y, width, height }) => <div key={node.id} className="branch-annotation" style={{ left: x, top: y, width, height }}>{node.boundary && <div className="branch-boundary"/>}{node.summary && <div className="branch-summary">{node.summary}</div>}</div>)}</ViewportPortal>
      <Controls position="bottom-left" showInteractive={false}/>
    </ReactFlow>
  </div>;
}
export default function MapCanvas(props: Props) { return <ReactFlowProvider><InnerCanvas {...props}/></ReactFlowProvider>; }
