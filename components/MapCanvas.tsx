'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, Background, BackgroundVariant, Controls, ConnectionLineType, ConnectionMode, MarkerType, ReactFlowProvider, SelectionMode, ViewportPortal, useReactFlow, type Connection, type NodeChange, type Node, type NodePositionChange } from '@xyflow/react';
import MindNodeView, { type FlowMindNode } from './MindNodeView';
import type { ImportedFont } from '../lib/fonts';
import StyledEdge from './StyledEdge';
import type { NodeAction, NodePanel } from './NodeQuickToolbar';
import type { LineStyle, MindMap, MindNode } from '../types';
import { descendants, visibleNodes } from '../lib/maps';
import { collectNodeDimensions, effectiveAvoidOverlap, movementModes, projectDrag, reorganizeBranch, snapMoveAwayFromOverlap } from '../lib/movement';
import { alignedHandles } from '../lib/edge-geometry';
import type { MovementMode } from '../types';

type Props = { map: MindMap; selectedId: string | null; selectedIds?: string[]; globalMovementMode?: MovementMode; globalAvoidOverlap?: boolean; temporaryBranchId?: string | null; onTemporaryBranchDone?: () => void; onMoveNotice?: (message: string) => void; onSelect: (id: string | null) => void; onSelectMany?: (ids: string[]) => void; onSelectEdge?: (id: string) => void; onChange: (map: MindMap) => void; onAdd: (id: string) => void; onEdit: (id: string, text: string) => void; onToggle: (id: string) => void; onAction?: (id: string, action: NodeAction) => void; onOpenQuick?: (id: string, panel: NodePanel) => void; onPatch?: (id: string, patch: Partial<MindNode>) => void; onImage?: (id: string, file: File) => void; onDrivePick?: (id: string, kind: 'image' | 'link') => void; fonts?: ImportedFont[]; onImportFont?: (id: string, file: File) => Promise<void>; onFavoriteIcons?: (icons: string[]) => void; quickPanel?: { id: string; panel: NodePanel; key: number } | null; alwaysToolbar?: boolean; onToggleAlwaysToolbar?: (value: boolean) => void; grid: boolean; readOnly?: boolean; flowRef?: React.MutableRefObject<{ zoomIn: () => void; zoomOut: () => void; fit: () => void } | null> };
const nodeTypes = { mind: MindNodeView };
const edgeTypes = { styled: StyledEdge };
const edgeMarker = (symbol: LineStyle['end'], color: string) => symbol === 'arrow' ? { type: MarkerType.ArrowClosed, color, width: 14, height: 14 } : undefined;
const edgeDash = (style?: LineStyle) => style?.pattern === 'dashed' ? '8 5' : style?.pattern === 'dotted' ? '2 5' : undefined;
function InnerCanvas({ map, selectedId, selectedIds = selectedId ? [selectedId] : [], globalMovementMode = 'hierarchical', globalAvoidOverlap = true, temporaryBranchId, onTemporaryBranchDone, onMoveNotice, onSelect, onSelectMany, onSelectEdge, onChange, onAdd, onEdit, onToggle, onAction, onOpenQuick, onPatch, onImage, onDrivePick, fonts, onImportFont, onFavoriteIcons, quickPanel, alwaysToolbar = true, onToggleAlwaysToolbar, grid, readOnly, flowRef }: Props) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [contextNodeId, setContextNodeId] = useState<string | null>(null);
  const dragPositions = useRef(new Map<string, { x: number; y: number; dragging: boolean }>());
  const automaticPreview = useRef(new Map<string, Map<string, { x: number; y: number }>>());
  const [livePositions, setLivePositions] = useState(() => new Map<string, { x: number; y: number; dragging: boolean; source: boolean }>());
  const selectionRef = useRef(selectedIds);
  useEffect(() => { selectionRef.current = selectedIds; }, [selectedIds]);
  useEffect(() => {
    if (!flowRef) return;
    flowRef.current = { zoomIn: () => zoomIn(), zoomOut: () => zoomOut(), fit: () => fitView({ padding: 0.22, duration: 400 }) };
    return () => { flowRef.current = null; };
  }, [flowRef, zoomIn, zoomOut, fitView]);
  const visible = useMemo(() => visibleNodes(map.nodes), [map.nodes]);
  const baseNodes = useMemo<FlowMindNode[]>(() => { const childCounts = new Map<string, number>(); for (const node of map.nodes) if (node.parentId) childCounts.set(node.parentId, (childCounts.get(node.parentId) || 0) + 1); const modes = movementModes(map, globalMovementMode); return visible.map(item => ({ id: item.id, type: 'mind', position: { x: item.x, y: item.y }, dragging: false, selected: selectedIds.includes(item.id), draggable: !readOnly && !item.positionLocked, data: { item, childCount: childCounts.get(item.id) || 0, selected: selectedIds.includes(item.id), mapLayout: map.layout, effectiveMovement: modes.get(item.id) || globalMovementMode, inheritedAvoidOverlap: map.avoidOverlap ?? globalAvoidOverlap, toolbarVisible: selectedIds.length === 1 && (alwaysToolbar || contextNodeId === item.id || quickPanel?.id === item.id), alwaysToolbar, onToggleAlwaysToolbar, readOnly, onAdd, onEdit, onToggle, onAction, onOpenQuick, onPatch, onImage, onDrivePick, fonts, onImportFont, favoriteIcons: map.favoriteIcons || [], onFavoriteIcons, presets: map.stylePresets || [], requestedPanel: quickPanel?.id === item.id ? quickPanel : null } })); }, [visible, map, globalMovementMode, globalAvoidOverlap, selectedIds, contextNodeId, quickPanel, alwaysToolbar, onToggleAlwaysToolbar, readOnly, onAdd, onEdit, onToggle, onAction, onOpenQuick, onPatch, onImage, onDrivePick, fonts, onImportFont, onFavoriteIcons]);
  // Preserve unchanged node/data references during pointer movement.
  const nodes = useMemo(() => baseNodes.map(node => {
    const position = livePositions.get(node.id);
    return position ? { ...node, position: { x: position.x, y: position.y }, dragging: position.dragging && position.source, data: { ...node.data, dragParticipant: position.dragging && !position.source } } : node;
  }), [baseNodes, livePositions]);
  const edges = useMemo(() => { const byId = new Map(visible.map(node => { const live = livePositions.get(node.id); return [node.id, live ? { ...node, x: live.x, y: live.y } : node] as const; })); const tree = visible.filter(n => n.parentId && byId.has(n.parentId)).map(n => {
    const parent = byId.get(n.parentId!)!; const target = byId.get(n.id)!;
    const { sourceHandle, targetHandle } = alignedHandles(parent, target);
    const line = n.connectionStyle; const color = line?.color || '#b9b4db';
    return { id: `${n.parentId}-${n.id}`, source: n.parentId!, target: n.id, sourceHandle, targetHandle, type: 'styled', data: { line: { ...line, color } }, animated: false, style: { stroke: color, strokeWidth: line?.width ?? 2, strokeDasharray: edgeDash(line) }, markerStart: edgeMarker(line?.start ?? 'none', color), markerEnd: edgeMarker(line?.end ?? 'arrow', color) };
  }); const relationships = (map.relationships || []).filter(link => byId.has(link.source) && byId.has(link.target)).map(link => { const line = link.style; const color = line?.color || '#41baa3'; const source = byId.get(link.source)!; const target = byId.get(link.target)!; const aligned = alignedHandles(source, target); const sourceHandle = link.sourceHandle || aligned.sourceHandle; const targetHandle = link.targetHandle || aligned.targetHandle; return { id: link.id, source: link.source, target: link.target, sourceHandle, targetHandle, type: 'styled', data: { line: { pattern: 'dashed' as const, ...line, color } }, label: link.label, style: { stroke: color, strokeWidth: line?.width ?? 2, strokeDasharray: edgeDash(line) ?? '6 4' }, markerStart: edgeMarker(line?.start ?? 'none', color), markerEnd: edgeMarker(line?.end ?? 'arrow', color) }; }); return [...tree, ...relationships]; }, [visible, map.relationships, livePositions]);
  const annotations = useMemo(() => visible.filter(n => n.boundary || n.summary).map(node => {
    const branchIds = descendants(map.nodes, node.id); const branch = visible.filter(item => branchIds.has(item.id));
    const x = Math.min(...branch.map(item => item.x)) - 28; const y = Math.min(...branch.map(item => item.y)) - 28;
    const right = Math.max(...branch.map(item => item.x + 230)) + 28; const bottom = Math.max(...branch.map(item => item.y + 85)) + 28;
    return { node, x, y, width: right - x, height: bottom - y };
  }), [visible, map.nodes]);
  const onNodesChange = useCallback((changes: NodeChange<Node>[]) => {
    if (readOnly) return;
    const selection = changes.filter(change => change.type === 'select');
    if (selection.length) {
      const previous = selectionRef.current;
      const next = new Set(previous);
      for (const change of selection) { if (change.selected) next.add(change.id); else next.delete(change.id); }
      if (next.size !== previous.length || previous.some(id => !next.has(id))) {
        selectionRef.current = [...next];
        onSelectMany?.(selectionRef.current);
      }
    }
    const moved = changes.filter((c): c is NodePositionChange => c.type === 'position' && Boolean(c.position));
    if (!moved.length) return;
    // React Flow reports only the dragged nodes. Project the same delta onto
    // descendants in memory so the whole branch and its edges move each frame.
    const requested = new Map(dragPositions.current);
    for (const change of moved) requested.set(change.id, { ...change.position!, dragging: Boolean(change.dragging) });
    dragPositions.current = requested;
    const projected = projectDrag(map, requested, globalMovementMode, temporaryBranchId);
    const isDragging = moved.some(change => change.dragging);
    const previewPositions = new Map(projected.positions);
    if (isDragging) for (const rootId of projected.automaticRoots) {
      let preview = automaticPreview.current.get(rootId);
      if (!preview) {
        const organized = reorganizeBranch(map, rootId, effectiveAvoidOverlap(map, rootId, globalAvoidOverlap), collectNodeDimensions());
        const branch = descendants(map.nodes, rootId);
        preview = new Map(organized.nodes.filter(node => branch.has(node.id)).map(node => [node.id, { x: node.x, y: node.y }]));
        automaticPreview.current.set(rootId, preview);
      }
      const root = map.nodes.find(node => node.id === rootId)!;
      const requestedRoot = requested.get(rootId)!;
      for (const id of projected.positions.keys()) {
        const planned = preview.get(id);
        if (planned) previewPositions.set(id, { x: planned.x + requestedRoot.x - root.x, y: planned.y + requestedRoot.y - root.y });
      }
    }
    setLivePositions(new Map([...previewPositions].map(([id, position]) => [id, { ...position, dragging: isDragging, source: requested.has(id) }])));
    if (isDragging) return;
    if (projected.blocked) onMoveNotice?.(projected.blocked);
    else if (projected.positions.size) {
      let next: MindMap = { ...map, nodes: map.nodes.map(node => { const position = projected.positions.get(node.id); return position ? { ...node, x: position.x, y: position.y } : node; }) };
      const changed = next.nodes.some((node, index) => node.x !== map.nodes[index].x || node.y !== map.nodes[index].y);
      if (changed) {
        const dimensions = collectNodeDimensions();
        for (const id of projected.automaticRoots) next = reorganizeBranch(next, id, effectiveAvoidOverlap(next, id, globalAvoidOverlap), dimensions);
        const movedIds = new Set(projected.positions.keys());
        const collisionPrevention = [...requested.keys()].some(id => effectiveAvoidOverlap(map, id, globalAvoidOverlap));
        const landing = collisionPrevention ? snapMoveAwayFromOverlap(next, movedIds, dimensions) : { map: next, adjusted: false, blocked: false };
        if (landing.blocked) { onMoveNotice?.('Não há espaço livre próximo para este ramo. A posição anterior foi mantida.'); }
        else {
          next = landing.map;
          if (landing.adjusted) onMoveNotice?.('O ramo foi deslocado até uma posição livre para evitar sobreposição.');
          onChange(next);
        }
      }
    }
    if (temporaryBranchId && requested.has(temporaryBranchId)) onTemporaryBranchDone?.();
    dragPositions.current = new Map();
    automaticPreview.current.clear();
    setLivePositions(new Map());
  }, [map, onChange, onSelectMany, readOnly, globalMovementMode, globalAvoidOverlap, temporaryBranchId, onTemporaryBranchDone, onMoveNotice]);
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
    <ReactFlow proOptions={{ hideAttribution: true }} autoPanOnNodeFocus={false} nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={onNodesChange} onConnect={onConnect} onConnectEnd={onConnectEnd} onNodeClick={(event, node) => { setContextNodeId(null); if (!event.ctrlKey && !event.metaKey && !event.shiftKey) onSelect(node.id); }} onEdgeClick={(_event, edge) => { if (readOnly) return; if (map.relationships?.some(link => link.id === edge.id)) onSelectEdge?.(edge.id); else onSelect(edge.target); }} onNodeContextMenu={(event, node) => { if (readOnly) return; event.preventDefault(); setContextNodeId(node.id); onOpenQuick?.(node.id, 'movement'); }} onPaneClick={(event) => { if (event.ctrlKey || event.metaKey) return; setContextNodeId(null); onSelect(null); }} fitView fitViewOptions={{ padding: 0.3, maxZoom: 1 }} minZoom={0.18} maxZoom={2.5} panOnDrag={spaceHeld ? [0, 1, 2] : [1, 2]} zoomOnScroll zoomOnDoubleClick={false} selectionOnDrag={false} selectionKeyCode={readOnly ? null : ["Control", "Meta", "Shift"]} multiSelectionKeyCode={["Control", "Meta"]} selectionMode={SelectionMode.Partial} deleteKeyCode={null} nodeDragThreshold={3} nodesConnectable={!readOnly} connectionMode={ConnectionMode.Loose} nodesDraggable={!readOnly} elementsSelectable={!readOnly} connectionLineType={ConnectionLineType.SmoothStep}>
      {grid && <Background variant={BackgroundVariant.Dots} gap={22} size={1.1} color="#dadde9" />}
      <ViewportPortal>{annotations.map(({ node, x, y, width, height }) => <div key={node.id} className="branch-annotation" style={{ left: x, top: y, width, height }}>{node.boundary && <div className="branch-boundary"/>}{node.summary && <div className="branch-summary">{node.summary}</div>}</div>)}</ViewportPortal>
      <Controls position="bottom-left" showInteractive={false}/>
    </ReactFlow>

  </div>;
}
export default function MapCanvas(props: Props) { return <ReactFlowProvider key={props.map.id}><InnerCanvas {...props}/></ReactFlowProvider>; }
