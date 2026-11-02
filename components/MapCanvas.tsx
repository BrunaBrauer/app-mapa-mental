'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, Background, BackgroundVariant, Controls, ConnectionLineType, ConnectionMode, MarkerType, ReactFlowProvider, SelectionMode, ViewportPortal, useReactFlow, type Connection, type NodeChange, type Node, type NodePositionChange } from '@xyflow/react';
import MindNodeView, { type FlowMindNode } from './MindNodeView';
import type { ImportedFont } from '../lib/fonts';
import StyledEdge from './StyledEdge';
import type { NodeAction, NodePanel } from './NodeQuickToolbar';
import type { LineStyle, MindMap, MindNode } from '../types';
import { descendants, treemapRects, visibleNodes } from '../lib/maps';
import { collectNodeDimensions, effectiveAvoidOverlap, movementModes, projectDrag, reorderAlignedSibling, reorganizeBranch, snapMoveAwayFromOverlap, visualSize } from '../lib/movement';
import { alignedHandles } from '../lib/edge-geometry';
import { applySiblingAlignments } from '../lib/visual-standardization';
import type { VisualOperation, VisualScope, VisualStyleGroup } from '../lib/visual-standardization';
import type { MovementMode } from '../types';

type Props = { map: MindMap; selectedId: string | null; selectedIds?: string[]; globalMovementMode?: MovementMode; globalAvoidOverlap?: boolean; temporaryBranchId?: string | null; onTemporaryBranchDone?: () => void; onMoveNotice?: (message: string) => void; onSelect: (id: string | null) => void; onSelectMany?: (ids: string[]) => void; onSelectEdge?: (id: string) => void; onChange: (map: MindMap) => void; onAdd: (id: string) => void; onEdit: (id: string, text: string) => void; onToggle: (id: string) => void; onAction?: (id: string, action: NodeAction) => void; onVisual?: (ids: string[], scope: VisualScope, operation: VisualOperation, value?: number, styleGroups?: VisualStyleGroup[]) => void; onOpenQuick?: (id: string, panel: NodePanel) => void; onPatch?: (id: string, patch: Partial<MindNode>) => void; onImage?: (id: string, file: File) => void; onDrivePick?: (id: string, kind: 'image' | 'link') => void; fonts?: ImportedFont[]; onImportFont?: (id: string, file: File) => Promise<void>; onFavoriteIcons?: (icons: string[]) => void; quickPanel?: { id: string; panel: NodePanel; key: number } | null; alwaysToolbar?: boolean; onToggleAlwaysToolbar?: (value: boolean) => void; grid: boolean; readOnly?: boolean; flowRef?: React.MutableRefObject<{ zoomIn: () => void; zoomOut: () => void; fit: () => void } | null> };
const nodeTypes = { mind: MindNodeView };
const edgeTypes = { styled: StyledEdge };
const edgeMarker = (symbol: LineStyle['end'], color: string) => symbol === 'arrow' ? { type: MarkerType.ArrowClosed, color, width: 14, height: 14 } : undefined;
const edgeDash = (style?: LineStyle) => style?.pattern === 'dashed' ? '8 5' : style?.pattern === 'dotted' ? '2 5' : undefined;
function InnerCanvas({ map, selectedId, selectedIds = selectedId ? [selectedId] : [], globalMovementMode = 'hierarchical', globalAvoidOverlap = true, temporaryBranchId, onTemporaryBranchDone, onMoveNotice, onSelect, onSelectMany, onSelectEdge, onChange, onAdd, onEdit, onToggle, onAction, onVisual, onOpenQuick, onPatch, onImage, onDrivePick, fonts, onImportFont, onFavoriteIcons, quickPanel, alwaysToolbar = true, onToggleAlwaysToolbar, grid, readOnly, flowRef }: Props) {
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
  const displayVisible = useMemo(() => {
    if (map.layout !== 'treemap') return visible;
    const rects = treemapRects(map.nodes);
    return visible.map(node => { const rect = rects.get(node.id); return rect ? { ...node, ...rect } : node; })
      .sort((a, b) => (rects.get(a.id)?.depth ?? 0) - (rects.get(b.id)?.depth ?? 0));
  }, [visible, map.layout, map.nodes]);
  const baseNodes = useMemo<FlowMindNode[]>(() => { const childCounts = new Map<string, number>(); for (const node of map.nodes) if (node.parentId) childCounts.set(node.parentId, (childCounts.get(node.parentId) || 0) + 1); const modes = movementModes(map, globalMovementMode); return displayVisible.map(item => ({ id: item.id, type: 'mind', position: { x: item.x, y: item.y }, dragging: false, selected: selectedIds.includes(item.id), draggable: !readOnly && !item.positionLocked && map.layout !== 'treemap' && map.layout !== 'matrix', data: { item, map, childCount: childCounts.get(item.id) || 0, selected: selectedIds.includes(item.id), mapLayout: map.layout, effectiveMovement: modes.get(item.id) || globalMovementMode, inheritedAvoidOverlap: map.avoidOverlap ?? globalAvoidOverlap, toolbarVisible: selectedIds.length === 1 && (alwaysToolbar || contextNodeId === item.id || quickPanel?.id === item.id), alwaysToolbar, onToggleAlwaysToolbar, readOnly, onAdd, onEdit, onToggle, onAction, onVisual, onOpenQuick, onPatch, onImage, onDrivePick, fonts, onImportFont, favoriteIcons: map.favoriteIcons || [], onFavoriteIcons, presets: map.stylePresets || [], requestedPanel: quickPanel?.id === item.id ? quickPanel : null } })); }, [displayVisible, map, globalMovementMode, globalAvoidOverlap, selectedIds, contextNodeId, quickPanel, alwaysToolbar, onToggleAlwaysToolbar, readOnly, onAdd, onEdit, onToggle, onAction, onVisual, onOpenQuick, onPatch, onImage, onDrivePick, fonts, onImportFont, onFavoriteIcons]);
  // Preserve unchanged node/data references during pointer movement.
  const nodes = useMemo(() => baseNodes.map(node => {
    const position = livePositions.get(node.id);
    return position ? { ...node, position: { x: position.x, y: position.y }, dragging: position.dragging && position.source, data: { ...node.data, dragParticipant: position.dragging && !position.source } } : node;
  }), [baseNodes, livePositions]);
  const edges = useMemo(() => {
    const byId = new Map(displayVisible.map(node => { const live = livePositions.get(node.id); return [node.id, live ? { ...node, x: live.x, y: live.y } : node] as const; }));
    const root = displayVisible.find(node => !node.parentId && !node.floating);
    const stages = map.layout === 'cycle' && root ? displayVisible.filter(node => node.parentId === root.id) : [];
    const tree = displayVisible.filter(n => n.parentId && byId.has(n.parentId)
      && !['matrix', 'treemap', 'swimlane'].includes(map.layout)
      && !(n.parentId === root?.id && (stages.length >= 2 || map.layout === 'fishbone' || map.layout === 'timeline'))).map(n => {
    const parent = byId.get(n.parentId!)!; const target = byId.get(n.id)!;
    const { sourceHandle, targetHandle } = map.layout === 'horizontal'
      ? { sourceHandle: 'source-right', targetHandle: 'target-left' }
      : map.layout === 'vertical' || map.layout === 'flowchart'
        ? { sourceHandle: 'source-bottom', targetHandle: 'target-top' }
        : alignedHandles(parent, target);
    const line = n.connectionStyle; const color = line?.color || '#b9b4db';
    const label = map.layout === 'flowchart' && parent.flowDecision ? n.flowAnswer === 'yes' ? 'Sim' : n.flowAnswer === 'no' ? 'Não' : undefined
      : map.layout === 'concept' ? n.conceptRelation || 'relaciona-se' : undefined;
    return { id: `${n.parentId}-${n.id}`, source: n.parentId!, target: n.id, sourceHandle, targetHandle, type: 'styled', label, data: { line: { ...line, color } }, animated: false, style: { stroke: color, strokeWidth: line?.width ?? 2, strokeDasharray: edgeDash(line) }, markerStart: edgeMarker(line?.start ?? 'none', color), markerEnd: edgeMarker(line?.end ?? 'arrow', color) };
    });
    const cycle = stages.length < 2 ? [] : stages.map((stage, index) => {
      const target = stages[(index + 1) % stages.length];
      const sourcePosition = byId.get(stage.id)!;
      const targetPosition = byId.get(target.id)!;
      const sourceSize = visualSize(sourcePosition);
      const targetSize = visualSize(targetPosition);
      const sourceCenter = { x: sourcePosition.x + sourceSize.width / 2, y: sourcePosition.y + sourceSize.height / 2 };
      const targetCenter = { x: targetPosition.x + targetSize.width / 2, y: targetPosition.y + targetSize.height / 2 };
      const rootPosition = byId.get(root!.id)!;
      const rootSize = visualSize(rootPosition);
      const center = { x: rootPosition.x + rootSize.width / 2, y: rootPosition.y + rootSize.height / 2 };
      const tangent = (point: typeof center, source: boolean) => {
        const dx = point.x - center.x;
        const dy = point.y - center.y;
        const tx = source ? -dy : dy;
        const ty = source ? dx : -dx;
        return Math.abs(tx) > Math.abs(ty) ? (tx > 0 ? 'right' : 'left') : (ty > 0 ? 'bottom' : 'top');
      };
      const color = '#8a7af0';
      return { id: `cycle:${stage.id}:${target.id}`, source: stage.id, target: target.id,
        sourceHandle: `source-${tangent(sourceCenter, true)}`, targetHandle: `target-${tangent(targetCenter, false)}`,
        type: 'styled', data: { line: { color, width: 2, curve: 'smooth' as const } },
        markerEnd: edgeMarker('arrow', color), style: { stroke: color, strokeWidth: 2 } };
    });
    const laneEdges = (() => {
      if (map.layout !== 'swimlane' || !root) return [];
      const byParent = new Map<string, MindNode[]>();
      displayVisible.forEach(node => { if (node.parentId) { const children = byParent.get(node.parentId); if (children) children.push(node); else byParent.set(node.parentId, [node]); } });
      return (byParent.get(root.id) || []).flatMap(lane => {
        const steps: MindNode[] = [];
        const pending = [lane];
        while (pending.length) { const step = pending.pop()!; steps.push(step); pending.push(...(byParent.get(step.id) || [])); }
        steps.sort((a, b) => a.y - b.y);
        return steps.slice(1).map((step, index) => ({ id: `lane:${lane.id}:${step.id}`, source: steps[index].id, target: step.id,
          sourceHandle: 'source-bottom', targetHandle: 'target-top', type: 'styled', data: { line: { color: '#8a7af0', width: 2 } },
          markerEnd: edgeMarker('arrow', '#8a7af0'), style: { stroke: '#8a7af0', strokeWidth: 2 } }));
      });
    })();
    const relationships = (map.relationships || []).filter(link => byId.has(link.source) && byId.has(link.target)).map(link => { const line = link.style; const color = line?.color || '#41baa3'; const source = byId.get(link.source)!; const target = byId.get(link.target)!; const aligned = alignedHandles(source, target); const sourceHandle = link.sourceHandle || aligned.sourceHandle; const targetHandle = link.targetHandle || aligned.targetHandle; return { id: link.id, source: link.source, target: link.target, sourceHandle, targetHandle, type: 'styled', data: { line: { pattern: 'dashed' as const, ...line, color } }, label: link.label || (map.layout === 'concept' ? 'relaciona-se' : undefined), style: { stroke: color, strokeWidth: line?.width ?? 2, strokeDasharray: edgeDash(line) ?? '6 4' }, markerStart: edgeMarker(line?.start ?? 'none', color), markerEnd: edgeMarker(line?.end ?? 'arrow', color) }; });
    return [...tree, ...cycle, ...laneEdges, ...relationships];
  }, [displayVisible, map.layout, map.relationships, livePositions]);
  const annotations = useMemo(() => map.layout === 'treemap' ? [] : visible.filter(n => n.boundary || n.summary).map(node => {
    const branchIds = descendants(map.nodes, node.id); const branch = visible.filter(item => branchIds.has(item.id));
    const x = Math.min(...branch.map(item => item.x)) - 28; const y = Math.min(...branch.map(item => item.y)) - 28;
    const right = Math.max(...branch.map(item => item.x + 230)) + 28; const bottom = Math.max(...branch.map(item => item.y + 85)) + 28;
    return { node, x, y, width: right - x, height: bottom - y };
  }), [visible, map.nodes, map.layout]);
  const diagramBackdrop = useMemo(() => {
    const root = visible.find(node => !node.parentId && !node.floating);
    if (!root) return null;
    const branches = visible.filter(node => node.parentId === root.id);
    if (map.layout === 'swimlane') {
      const height = Math.max(300, ...visible.filter(node => node.parentId).map(node => node.y + 120));
      return branches.map((branch, index) => <div key={branch.id} className="swimlane-backdrop" style={{ left: root.x + 250 + index * 300, top: root.y - 35, width: 280, height: height + 35 }}><span>{branch.text}</span></div>);
    }
    if (map.layout === 'matrix') {
      const rows = root.matrixRows?.length ? root.matrixRows : ['Linha 1', 'Linha 2'];
      const columns = root.matrixColumns?.length ? root.matrixColumns : ['Coluna 1', 'Coluna 2'];
      const assigned = visible.filter(node => node.id !== root.id && !node.floating);
      const counts = new Map<string, number>();
      assigned.forEach((node, index) => {
        const row = Math.min(rows.length - 1, node.matrixRow ?? Math.floor(index / columns.length) % rows.length);
        const column = Math.min(columns.length - 1, node.matrixColumn ?? index % columns.length);
        const key = `${row}:${column}`; counts.set(key, (counts.get(key) || 0) + 1);
      });
      const height = Math.max(180, ...[...counts.values()].map(count => count * 84 + 60));
      const left = root.x + (root.width ?? 182) / 2 - columns.length * 280 / 2;
      const top = root.y + 180;
      return <>{columns.map((label, column) => <div key={`column-${column}`} className="matrix-axis matrix-column" style={{ left: left + column * 280, top: top - 35, width: 280 }}>{label}</div>)}
        {rows.map((label, row) => <div key={`row-${row}`} className="matrix-axis matrix-row" style={{ left: left - 132, top: top + row * height + 8, height: height - 16 }}>{label}</div>)}
        {rows.flatMap((_, row) => columns.map((_, column) => <div key={`${row}:${column}`} className="matrix-cell" style={{ left: left + column * 280, top: top + row * height, width: 280, height }}/>))}</>;
    }
    if (map.layout === 'fishbone' || map.layout === 'timeline') {
      const rootSize = visualSize(root);
      const axisY = root.y + rootSize.height / 2;
      const startX = root.x + rootSize.width;
      const endX = Math.max(startX + 160, ...branches.map(node => node.x + visualSize(node).width / 2 + 40));
      return <svg className="diagram-axis" style={{ left: 0, top: 0 }} width="1" height="1" aria-hidden="true"><defs><marker id="diagram-axis-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#8a7af0"/></marker></defs><path d={`M ${startX} ${axisY} L ${endX} ${axisY}`} markerEnd="url(#diagram-axis-arrow)"/>{branches.map(node => { const size = visualSize(node); const x = node.x + size.width / 2; const y = node.y + (node.y < axisY ? size.height : 0); return <path key={node.id} d={`M ${x} ${axisY} L ${x} ${y}`}/>; })}</svg>;
    }
    return null;
  }, [visible, map.layout]);
  const concentricRings = useMemo(() => {
    if (map.layout !== 'concentric') return [];
    const root = displayVisible.find(node => !node.parentId && !node.floating);
    if (!root) return [];
    const byId = new Map(displayVisible.map(node => [node.id, node]));
    const position = (node: MindNode) => livePositions.get(node.id) || node;
    const center = (node: MindNode) => { const size = visualSize(node); const point = position(node); return { x: point.x + size.width / 2, y: point.y + size.height / 2 }; };
    const origin = center(root);
    const radii = new Map<number, number>();
    visible.forEach(node => {
      if (node.id === root.id || node.floating) return;
      let depth = 0; let parent = node.parentId;
      const seen = new Set([node.id]);
      while (parent && byId.has(parent) && !seen.has(parent)) { seen.add(parent); depth++; parent = byId.get(parent)!.parentId; }
      const point = center(node);
      radii.set(depth, Math.max(radii.get(depth) || 0, Math.hypot(point.x - origin.x, point.y - origin.y)));
    });
    return [...radii].sort(([a], [b]) => a - b).map(([depth, distance]) => {
      const radius = Math.max(60, distance - 42);
      return { depth, x: origin.x - radius, y: origin.y - radius, diameter: radius * 2 };
    });
  }, [visible, displayVisible, map.layout, livePositions]);
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
        const organized = applySiblingAlignments(reorganizeBranch(map, rootId, effectiveAvoidOverlap(map, rootId, globalAvoidOverlap), collectNodeDimensions()), descendants(map.nodes, rootId));
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
        const reorderId = map.siblingReorder && requested.size === 1 ? [...requested.keys()][0] : null;
        const siblingOrder = reorderId ? reorderAlignedSibling(next, reorderId, dimensions) : null;
        if (siblingOrder?.blocked) onMoveNotice?.('Um dos subnós deste grupo está com a posição bloqueada. Desbloqueie-o antes de reordenar.');
        else if (siblingOrder?.parentId) {
          next = applySiblingAlignments(reorganizeBranch(siblingOrder.map, siblingOrder.parentId, false, dimensions), descendants(siblingOrder.map.nodes, siblingOrder.parentId));
          if (siblingOrder.reordered) onMoveNotice?.('Ordem dos subnós atualizada, mantendo o alinhamento.');
        }
        if (!siblingOrder?.parentId && !siblingOrder?.blocked) for (const id of projected.automaticRoots) next = applySiblingAlignments(reorganizeBranch(next, id, effectiveAvoidOverlap(next, id, globalAvoidOverlap), dimensions), descendants(next.nodes, id));
        const movedIds = new Set(projected.positions.keys());
        const collisionPrevention = [...requested.keys()].some(id => effectiveAvoidOverlap(map, id, globalAvoidOverlap));
        const landing = siblingOrder?.blocked ? { map, adjusted: false, blocked: false } : siblingOrder?.parentId ? { map: next, adjusted: false, blocked: false } : collisionPrevention ? snapMoveAwayFromOverlap(next, movedIds, dimensions) : { map: next, adjusted: false, blocked: false };
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
    onChange({ ...map, relationships: [...(map.relationships || []), { id: crypto.randomUUID(), source: connection.source, target: connection.target, sourceHandle: connection.sourceHandle || undefined, targetHandle: connection.targetHandle || undefined, label: map.layout === 'concept' ? 'relaciona-se' : undefined }] });
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
    onChange({ ...map, relationships: [...(map.relationships || []), { id: crypto.randomUUID(), source: state.fromNode.id, target: targetId, sourceHandle, targetHandle, label: map.layout === 'concept' ? 'relaciona-se' : undefined }] });
  }, [map, onChange, readOnly]);
  return <div className="canvas-surface" onKeyDown={e => { const target = e.target as HTMLElement; if (e.code === 'Space' && !target.closest('input,textarea,select,[contenteditable="true"]')) { setSpaceHeld(true); e.preventDefault(); } }} onKeyUp={e => { if (e.code === 'Space') setSpaceHeld(false); }} onBlur={() => setSpaceHeld(false)} tabIndex={0}>
    <ReactFlow proOptions={{ hideAttribution: true }} autoPanOnNodeFocus={false} autoPanOnNodeDrag={false} panActivationKeyCode={null} nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={onNodesChange} onConnect={onConnect} onConnectEnd={onConnectEnd} onNodeClick={(event, node) => { setContextNodeId(null); if (!event.ctrlKey && !event.metaKey && !event.shiftKey) onSelect(node.id); }} onEdgeClick={(_event, edge) => { if (readOnly) return; if (map.relationships?.some(link => link.id === edge.id)) onSelectEdge?.(edge.id); else onSelect(edge.target); }} onNodeContextMenu={(event, node) => { if (readOnly) return; event.preventDefault(); setContextNodeId(node.id); onOpenQuick?.(node.id, 'movement'); }} onPaneClick={(event) => { if (event.ctrlKey || event.metaKey) return; setContextNodeId(null); onSelect(null); }} fitView fitViewOptions={{ padding: 0.3, maxZoom: 1 }} minZoom={0.18} maxZoom={2.5} panOnDrag={spaceHeld ? [0, 1, 2] : [1, 2]} zoomOnScroll zoomOnDoubleClick={false} selectionOnDrag={false} selectionKeyCode={readOnly ? null : ["Control", "Meta", "Shift"]} multiSelectionKeyCode={["Control", "Meta"]} selectionMode={SelectionMode.Partial} deleteKeyCode={null} nodeDragThreshold={3} nodesConnectable={!readOnly} connectionMode={ConnectionMode.Loose} nodesDraggable={!readOnly} elementsSelectable={!readOnly} connectionLineType={ConnectionLineType.SmoothStep}>
      {grid && <Background variant={BackgroundVariant.Dots} gap={22} size={1.1} color="#dadde9" />}
      <ViewportPortal>{diagramBackdrop}{concentricRings.map(ring => <div key={`ring-${ring.depth}`} className="concentric-ring" style={{ left: ring.x, top: ring.y, width: ring.diameter, height: ring.diameter }}/>)}</ViewportPortal>
      <ViewportPortal>{annotations.map(({ node, x, y, width, height }) => <div key={node.id} className="branch-annotation" style={{ left: x, top: y, width, height }}>{node.boundary && <div className="branch-boundary"/>}{node.summary && <div className="branch-summary">{node.summary}</div>}</div>)}</ViewportPortal>
      <Controls position="bottom-left" showInteractive={false}/>
    </ReactFlow>

  </div>;
}
export default function MapCanvas(props: Props) { return <ReactFlowProvider key={props.map.id}><InnerCanvas {...props}/></ReactFlowProvider>; }
