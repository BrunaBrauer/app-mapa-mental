'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, Background, BackgroundVariant, Controls, ConnectionLineType, ConnectionMode, MarkerType, ReactFlowProvider, SelectionMode, ViewportPortal, useReactFlow, useViewport, type Connection, type NodeChange, type Node, type NodePositionChange } from '@xyflow/react';
import MindNodeView, { type FlowMindNode } from './MindNodeView';
import type { ImportedFont } from '../lib/fonts';
import StyledEdge from './StyledEdge';
import type { NodeAction, NodePanel } from './NodeQuickToolbar';
import type { LineStyle, MindMap, MindNode, TagDefinition } from '../types';
import { branchCounts, branchDirection, descendants, layoutMap, layoutSize, matrixGeometry, packTreeLayout, swimlaneGeometry, treemapRects, visibleNodes } from '../lib/maps';
import { createBoundaryGeometry } from '../lib/boundary-geometry';
import type { BoundarySelection } from '../lib/boundaries';
import { collectNodeDimensions, effectiveAvoidOverlap, movementModes, projectDrag, reparentBranches, reorderAlignedSibling, reorganizeBranch, snapMoveAwayFromOverlap, visualSize } from '../lib/movement';
import { alignedHandles } from '../lib/edge-geometry';
import { applySiblingAlignments } from '../lib/visual-standardization';
import type { VisualOperation, VisualScope, VisualStyleGroup } from '../lib/visual-standardization';
import type { MovementMode } from '../types';

type Props = { map: MindMap; previewNodes?: MindNode[]; resizingGroup?: boolean; onResizeStart?: () => void; onResizePreview?: (dx: number, dy: number) => void; onResizeEnd?: (dx: number, dy: number) => void; onResizeCancel?: () => void; selectedId: string | null; selectedIds?: string[]; selectedBoundary?: BoundarySelection | null; onSelectBoundary?: (selection: BoundarySelection) => void; globalMovementMode?: MovementMode; globalAvoidOverlap?: boolean; temporaryBranchId?: string | null; onTemporaryBranchDone?: () => void; onMoveNotice?: (message: string) => void; onSelect: (id: string | null) => void; onSelectMany?: (ids: string[]) => void; onSelectEdge?: (id: string) => void; onChange: (map: MindMap) => void; onGeometryChange?: (map: MindMap) => void; onAdd: (id: string) => void; onEdit: (id: string, text: string) => void; onToggle: (id: string) => void; onAction?: (id: string, action: NodeAction) => void; onOpenLinkedMaps?: (id: string) => void; onVisual?: (ids: string[], scope: VisualScope, operation: VisualOperation, value?: number, styleGroups?: VisualStyleGroup[]) => void; onOpenQuick?: (id: string, panel: NodePanel) => void; onPatch?: (id: string, patch: Partial<MindNode>) => void; onImage?: (id: string, file: File) => void; onDrivePick?: (id: string, kind: 'image' | 'link') => void; onTagToggle?: (nodeId: string, tagId: string, target: 'node' | 'boundary') => void; onCreateTag?: (nodeId: string, name: string, color: string, target: 'node' | 'boundary') => Promise<boolean>; tags?: TagDefinition[]; fonts?: ImportedFont[]; onImportFont?: (id: string, file: File) => Promise<void>; onFavoriteIcons?: (icons: string[]) => void; quickPanel?: { id: string; panel: NodePanel; key: number } | null; alwaysToolbar?: boolean; onToggleAlwaysToolbar?: (value: boolean) => void; grid: boolean; readOnly?: boolean; flowRef?: React.MutableRefObject<{ zoomIn: () => void; zoomOut: () => void; fit: () => void } | null> };
const nodeTypes = { mind: MindNodeView };
const edgeTypes = { styled: StyledEdge };
const edgeMarker = (symbol: LineStyle['end'], color: string) => symbol === 'arrow' ? { type: MarkerType.ArrowClosed, color, width: 14, height: 14 } : undefined;
const edgeDash = (style?: LineStyle) => style?.pattern === 'dashed' ? '8 5' : style?.pattern === 'dotted' ? '2 5' : undefined;
function InnerCanvas({ map, previewNodes, resizingGroup = false, onResizeStart, onResizePreview, onResizeEnd, onResizeCancel, selectedId, selectedIds = selectedId ? [selectedId] : [], selectedBoundary, onSelectBoundary, globalMovementMode = 'hierarchical', globalAvoidOverlap = true, temporaryBranchId, onTemporaryBranchDone, onMoveNotice, onSelect, onSelectMany, onSelectEdge, onChange, onGeometryChange, onAdd, onEdit, onToggle, onAction, onOpenLinkedMaps, onVisual, onOpenQuick, onPatch, onImage, onDrivePick, onTagToggle, onCreateTag, tags, fonts, onImportFont, onFavoriteIcons, quickPanel, alwaysToolbar = true, onToggleAlwaysToolbar, grid, readOnly, flowRef }: Props) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const viewport = useViewport();
  const groupResizeDrag = useRef<{ x: number; y: number; zoom: number; axis: 'width' | 'height' | null; dx: number; dy: number } | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [contextNodeId, setContextNodeId] = useState<string | null>(null);
  const dragPositions = useRef(new Map<string, { x: number; y: number; dragging: boolean }>());
  const dropTarget = useRef<{ id: string; element: HTMLElement } | null>(null);
  const dropCleanup = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearDropTarget = useCallback(() => { dropTarget.current?.element.classList.remove('reparent-drop-target'); dropTarget.current = null; }, []);
  useEffect(() => () => { if (dropCleanup.current) clearTimeout(dropCleanup.current); clearDropTarget(); }, [clearDropTarget]);
  const inspectDropTarget = useCallback((clientX: number, clientY: number, sourceIds: string[]) => {
    const forbidden = new Set(sourceIds.flatMap(id => [...descendants(map.nodes, id)]));
    const candidate = document.elementsFromPoint(clientX, clientY).map(element => element.closest<HTMLElement>('.react-flow__node[data-id]'))
      .find(element => element?.dataset.id && !forbidden.has(element.dataset.id) && map.nodes.some(node => node.id === element.dataset.id && !node.floating));
    if (candidate?.dataset.id === dropTarget.current?.id) return;
    clearDropTarget();
    if (candidate?.dataset.id) { candidate.classList.add('reparent-drop-target'); dropTarget.current = { id: candidate.dataset.id, element: candidate }; }
  }, [map.nodes, clearDropTarget]);
  const measuredSizes = useRef(new Map<string, { width: number; height: number }>());
  const [renderedSizes, setRenderedSizes] = useState(() => new Map<string, { width: number; height: number }>());
  const measuredMapId = useRef(map.id);
  const geometryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestMap = useRef(map);
  const geometryChange = useRef(onGeometryChange);
  useEffect(() => { latestMap.current = map; geometryChange.current = onGeometryChange; }, [map, onGeometryChange]);
  useEffect(() => { if (geometryTimer.current) clearTimeout(geometryTimer.current); geometryTimer.current = null; }, [map.id]);
  useEffect(() => () => { if (geometryTimer.current) clearTimeout(geometryTimer.current); }, []);
  const onMeasured = useCallback((id: string, size: { width: number; height: number }) => {
    if (resizingGroup) return;
    if (measuredMapId.current !== map.id) { measuredSizes.current.clear(); measuredMapId.current = map.id; }
    const previous = measuredSizes.current.get(id);
    measuredSizes.current.set(id, size);
    if (!previous || Math.abs(previous.width - size.width) >= 1 || Math.abs(previous.height - size.height) >= 1) {
      setRenderedSizes(current => new Map(current).set(id, size));
    }
    const expected = !previous && latestMap.current.nodes.find(node => node.id === id);
    const before = previous || (expected ? layoutSize(expected) : size);
    if (Math.abs(before.width - size.width) < 2 && Math.abs(before.height - size.height) < 2) return;
    if (geometryTimer.current) clearTimeout(geometryTimer.current);
    geometryTimer.current = setTimeout(() => {
      geometryTimer.current = null;
      const current = latestMap.current;
      if (!geometryChange.current || ['free', 'network', 'treemap'].includes(current.layout)) return;
      const nodes = ['matrix', 'swimlane', 'radial', 'concentric', 'cycle', 'fishbone', 'timeline'].includes(current.layout)
        ? layoutMap(current.nodes, current.layout, current.spacing)
        : packTreeLayout(current.nodes, current.layout, measuredSizes.current, current.spacing);
      if (nodes.some((node, index) => Math.abs(node.x - current.nodes[index].x) > 1 || Math.abs(node.y - current.nodes[index].y) > 1)) geometryChange.current({ ...current, nodes });
    }, 120);
  }, [map.id, resizingGroup]);
  const automaticPreview = useRef(new Map<string, Map<string, { x: number; y: number }>>());
  const [livePositions, setLivePositions] = useState(() => new Map<string, { x: number; y: number; dragging: boolean; source: boolean }>());
  const selectionRef = useRef(selectedIds);
  useEffect(() => { selectionRef.current = selectedIds; }, [selectedIds]);
  useEffect(() => {
    if (!flowRef) return;
    flowRef.current = { zoomIn: () => zoomIn(), zoomOut: () => zoomOut(), fit: () => fitView({ padding: 0.22, duration: 400 }) };
    return () => { flowRef.current = null; };
  }, [flowRef, zoomIn, zoomOut, fitView]);
  const visible = useMemo(() => visibleNodes(previewNodes || map.nodes), [previewNodes, map.nodes]);
  const displayVisible = useMemo(() => {
    if (map.layout !== 'treemap') return visible;
    const rects = treemapRects(map.nodes);
    return visible.map(node => { const rect = rects.get(node.id); return rect ? { ...node, ...rect } : node; })
      .sort((a, b) => (rects.get(a.id)?.depth ?? 0) - (rects.get(b.id)?.depth ?? 0));
  }, [visible, map.layout, map.nodes]);
  const groupSelection = useMemo(() => {
    if (selectedIds.length < 2 || readOnly) return null;
    const ids = new Set(selectedIds);
    const selected = displayVisible.filter(node => ids.has(node.id));
    if (selected.length < 2) return null;
    const left = Math.min(...selected.map(node => node.x));
    const top = Math.min(...selected.map(node => node.y));
    const right = Math.max(...selected.map(node => node.x + visualSize(node, resizingGroup ? undefined : renderedSizes).width));
    const bottom = Math.max(...selected.map(node => node.y + visualSize(node, resizingGroup ? undefined : renderedSizes).height));
    return { left: left * viewport.zoom + viewport.x, top: top * viewport.zoom + viewport.y, width: (right - left) * viewport.zoom, height: (bottom - top) * viewport.zoom, resizable: selected.some(node => !node.sizeLocked) };
  }, [selectedIds, displayVisible, readOnly, resizingGroup, renderedSizes, viewport]);
  const stopGroupResize = (cancel = false) => {
    const drag = groupResizeDrag.current;
    if (!drag) return;
    groupResizeDrag.current = null;
    if (cancel) onResizeCancel?.(); else onResizeEnd?.(drag.dx, drag.dy);
  };
  const baseNodes = useMemo<FlowMindNode[]>(() => {
    const children = new Map<string, MindNode[]>();
    for (const node of map.nodes) if (node.parentId) children.set(node.parentId, [...(children.get(node.parentId) || []), node]);
    const counts = branchCounts(map.nodes);
    const modes = movementModes(map, globalMovementMode);
    return displayVisible.map(item => ({
      id: item.id, type: 'mind', position: { x: item.x, y: item.y }, dragging: false,
      selected: selectedIds.includes(item.id),
      draggable: !readOnly && !item.positionLocked && map.layout !== 'treemap' && map.layout !== 'matrix',
      data: {
        item, map, childCount: counts.get(item.id)?.direct || 0,
        hiddenDescendantCount: item.collapsed ? counts.get(item.id)?.total || 0 : 0,
        collapseSide: branchDirection(item, children.get(item.id) || [], map.layout),
        selected: selectedIds.includes(item.id), mapLayout: map.layout,
        effectiveMovement: modes.get(item.id) || globalMovementMode,
        inheritedAvoidOverlap: map.avoidOverlap ?? globalAvoidOverlap,
        toolbarVisible: selectedIds.length === 1 && (alwaysToolbar || contextNodeId === item.id || quickPanel?.id === item.id),
        alwaysToolbar, onToggleAlwaysToolbar, readOnly, onAdd, onEdit, onToggle, onMeasured: onGeometryChange ? onMeasured : undefined, onAction, onVisual,
        onOpenQuick, onOpenLinkedMaps, onPatch, onImage, onDrivePick, fonts, onImportFont,
        favoriteIcons: map.favoriteIcons || [], onFavoriteIcons, presets: map.stylePresets || [], tags: tags || map.tagDefinitions || [], onTagToggle, onCreateTag,
        requestedPanel: quickPanel?.id === item.id ? quickPanel : null,
      },
    }));
  }, [displayVisible, map, globalMovementMode, globalAvoidOverlap, selectedIds, contextNodeId, quickPanel, alwaysToolbar, onToggleAlwaysToolbar, readOnly, onAdd, onEdit, onToggle, onMeasured, onGeometryChange, onAction, onOpenLinkedMaps, onVisual, onOpenQuick, onPatch, onImage, onDrivePick, onTagToggle, onCreateTag, tags, fonts, onImportFont, onFavoriteIcons]);
  // Preserve unchanged node/data references during pointer movement.
  const nodes = useMemo(() => baseNodes.map(node => {
    const position = livePositions.get(node.id);
    return position ? { ...node, position: { x: position.x, y: position.y }, dragging: position.dragging && position.source, data: { ...node.data, dragParticipant: position.dragging && !position.source } } : node;
  }), [baseNodes, livePositions]);
  const edges = useMemo(() => {
    const byId = new Map(displayVisible.map(node => { const live = livePositions.get(node.id); return [node.id, live ? { ...node, x: live.x, y: live.y } : node] as const; }));
    const directCounts = new Map<string, number>();
    for (const node of displayVisible) if (node.parentId) directCounts.set(node.parentId, (directCounts.get(node.parentId) || 0) + 1);
    const root = displayVisible.find(node => !node.parentId && !node.floating);
    const stages = map.layout === 'cycle' && root ? displayVisible.filter(node => node.parentId === root.id) : [];
    const tree = displayVisible.filter(n => n.parentId && byId.has(n.parentId)
      && !['matrix', 'treemap', 'swimlane'].includes(map.layout)
      && !(n.parentId === root?.id && (stages.length >= 2 || map.layout === 'fishbone' || map.layout === 'timeline'))).map(n => {
    const parent = byId.get(n.parentId!)!; const target = byId.get(n.id)!;
    const edgeLayout = parent.branchLayout || map.layout;
    const treeLayout = ['horizontal', 'right', 'left', 'balanced', 'bilateral', 'vertical', 'down', 'up', 'org', 'org-left', 'flowchart', 'split-down'].includes(edgeLayout);
    const direction = treeLayout ? branchDirection(parent, [target], edgeLayout) : null;
    const singleUnderlinedChild = target.shape === 'underline' && directCounts.get(parent.id) === 1;
    const underlinedSide = singleUnderlinedChild && target.x >= parent.x + visualSize(parent).width ? 'right'
      : singleUnderlinedChild && target.x + visualSize(target).width <= parent.x ? 'left' : null;
    const { sourceHandle, targetHandle } = underlinedSide
      ? { sourceHandle: `source-${underlinedSide}`, targetHandle: underlinedSide === 'right' ? 'target-left' : 'target-right' }
      : direction === 'right' ? { sourceHandle: 'source-right', targetHandle: 'target-left' }
      : direction === 'left' ? { sourceHandle: 'source-left', targetHandle: 'target-right' }
      : direction === 'bottom' ? { sourceHandle: 'source-bottom', targetHandle: 'target-top' }
      : direction === 'top' ? { sourceHandle: 'source-top', targetHandle: 'target-bottom' }
      : alignedHandles(parent, target);
    const line = n.connectionStyle;
    const underline = target.shape === 'underline' || parent.shape === 'underline';
    const underlineColor = target.shape === 'underline' ? target.border : parent.shape === 'underline' ? parent.border : undefined;
    const color = line?.color || (underlineColor === 'transparent' ? undefined : underlineColor) || '#000000';
    const edgeLine = { ...line, color, width: line?.width ?? (underline ? target.borderWidth ?? parent.borderWidth ?? 2 : 2), pattern: line?.pattern ?? (target.shape === 'underline' ? target.borderStyle : undefined) };
    const label = map.layout === 'flowchart' && parent.flowDecision ? n.flowAnswer === 'yes' ? 'Sim' : n.flowAnswer === 'no' ? 'Não' : undefined
      : map.layout === 'concept' ? n.conceptRelation || 'relaciona-se' : undefined;
    return { id: `${n.parentId}-${n.id}`, source: n.parentId!, target: n.id, sourceHandle, targetHandle, type: 'styled', label, data: { line: edgeLine, route: underlinedSide ? 'inline-underline' as const : direction === 'left' || direction === 'right' ? 'horizontal-tree' as const : direction === 'top' || direction === 'bottom' ? 'vertical-tree' as const : undefined }, animated: false, style: { stroke: color, strokeWidth: edgeLine.width, strokeDasharray: edgeDash(edgeLine) }, markerStart: edgeMarker(line?.start ?? 'none', color), markerEnd: edgeMarker(line?.end ?? 'none', color) };
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
    const relationships = (map.relationships || []).filter(link => byId.has(link.source) && byId.has(link.target)).map(link => { const line = link.style; const color = line?.color || '#41baa3'; const source = byId.get(link.source)!; const target = byId.get(link.target)!; const aligned = alignedHandles(source, target); const sourceHandle = link.sourceHandle || aligned.sourceHandle; const targetHandle = link.targetHandle || aligned.targetHandle; return { id: link.id, source: link.source, target: link.target, sourceHandle, targetHandle, type: 'styled', data: { line: { pattern: 'dashed' as const, ...line, color } }, label: link.label || (map.layout === 'concept' ? 'relaciona-se' : undefined), style: { stroke: color, strokeWidth: line?.width ?? 2, strokeDasharray: edgeDash(line) ?? '6 4' }, markerStart: edgeMarker(line?.start ?? 'none', color), markerEnd: edgeMarker(line?.end ?? 'none', color) }; });
    return [...tree, ...cycle, ...laneEdges, ...relationships];
  }, [displayVisible, map.layout, map.relationships, livePositions]);
  const annotations = useMemo(() => {
    if (map.layout === 'treemap') return [];
    const legacy = visible.filter(node => node.boundary || node.summary).map(node => ({ id: node.id, kind: 'node' as const, anchorIds: [node.id], boundary: Boolean(node.boundary), summary: node.summary, tagIds: node.boundaryTagIds || [] }));
    const groups = (map.boundaryGroups || []).map(group => ({ id: group.id, kind: 'group' as const, anchorIds: group.nodeIds, boundary: true, summary: undefined, tagIds: group.tagIds || [] }));
    const boxes = visible.map(node => { const live = livePositions.get(node.id); const size = renderedSizes.get(node.id) || layoutSize(node); return { id: node.id, parentId: node.parentId, x: live?.x ?? node.x, y: live?.y ?? node.y, width: size.width, height: size.height }; });
    return [...legacy, ...groups].flatMap(group => {
      const ids = new Set(group.anchorIds.flatMap(id => [...descendants(map.nodes, id)]));
      const branch = boxes.filter(item => ids.has(item.id));
      if (!branch.length) return [];
      const geometry = group.boundary ? createBoundaryGeometry(boxes, ids) : null;
      const x = geometry?.x ?? Math.min(...branch.map(item => item.x)) - 12;
      const y = geometry?.y ?? Math.min(...branch.map(item => item.y)) - 12;
      const right = geometry ? geometry.x + geometry.width : Math.max(...branch.map(item => item.x + item.width)) + 12;
      const bottom = geometry ? geometry.y + geometry.height : Math.max(...branch.map(item => item.y + item.height)) + 12;
      return [{ ...group, x, y, width: right - x, height: bottom - y, outline: geometry?.path, rectangular: geometry?.rectangular, parts: geometry?.parts }];
    });
  }, [visible, map.nodes, map.boundaryGroups, map.layout, livePositions, renderedSizes]);
  const diagramBackdrop = useMemo(() => {
    const root = visible.find(node => !node.parentId && !node.floating);
    if (!root) return null;
    const branches = visible.filter(node => node.parentId === root.id);
    if (map.layout === 'swimlane') {
      const { laneWidth } = swimlaneGeometry(map.nodes);
      const height = Math.max(300, ...visible.filter(node => node.parentId).map(node => node.y + 120));
      return branches.map((branch, index) => <div key={branch.id} className="swimlane-backdrop" style={{ left: root.x + 250 + index * laneWidth, top: root.y - 35, width: laneWidth - 20, height: height + 35 }}><span>{branch.text}</span></div>);
    }
    if (map.layout === 'matrix') {
      const rows = root.matrixRows?.length ? root.matrixRows : ['Linha 1', 'Linha 2'];
      const columns = root.matrixColumns?.length ? root.matrixColumns : ['Coluna 1', 'Coluna 2'];
      const geometry = matrixGeometry(map.nodes);
      if (!geometry) return null;
      const left = root.x + geometry.left;
      const top = root.y + geometry.top;
      return <>{columns.map((label, column) => <div key={`column-${column}`} className="matrix-axis matrix-column" style={{ left: left + column * geometry.cellWidth, top: top - 35, width: geometry.cellWidth }}>{label}</div>)}
        {rows.map((label, row) => <div key={`row-${row}`} className="matrix-axis matrix-row" style={{ left: left - 132, top: top + row * geometry.cellHeight + 8, height: geometry.cellHeight - 16 }}>{label}</div>)}
        {rows.flatMap((_, row) => columns.map((_, column) => <div key={`${row}:${column}`} className="matrix-cell" style={{ left: left + column * geometry.cellWidth, top: top + row * geometry.cellHeight, width: geometry.cellWidth, height: geometry.cellHeight }}/>))}</>;
    }
    if (map.layout === 'fishbone' || map.layout === 'timeline') {
      const rootSize = visualSize(root);
      const axisY = root.y + rootSize.height / 2;
      const startX = root.x + rootSize.width;
      const endX = Math.max(startX + 160, ...branches.map(node => node.x + visualSize(node).width / 2 + 40));
      return <svg className="diagram-axis" style={{ left: 0, top: 0 }} width="1" height="1" aria-hidden="true"><defs><marker id="diagram-axis-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#8a7af0"/></marker></defs><path d={`M ${startX} ${axisY} L ${endX} ${axisY}`} markerEnd="url(#diagram-axis-arrow)"/>{branches.map(node => { const size = visualSize(node); const x = node.x + size.width / 2; const y = node.y + (node.y < axisY ? size.height : 0); return <path key={node.id} d={`M ${x} ${axisY} L ${x} ${y}`}/>; })}</svg>;
    }
    return null;
  }, [visible, map.layout, map.nodes]);
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
      const draggedIds = [...requested.keys()];
      const selectedDrag = selectionRef.current.length > 1 && draggedIds.some(id => selectionRef.current.includes(id));
      const sourceIds = selectedDrag ? selectionRef.current : draggedIds;
      const targetId = dropTarget.current?.id;
      if (sourceIds.length && targetId) {
        // Individual movement can leave descendants behind; a hierarchy change
        // moves each selected branch as a whole, including those descendants.
        const offsets = new Map<string, { x: number; y: number }>();
        const selectedBranches = new Map(sourceIds.map(id => [id, descendants(map.nodes, id)]));
        for (const id of sourceIds.filter(candidate => !sourceIds.some(other => other !== candidate && selectedBranches.get(other)?.has(candidate)))) {
          const original = map.nodes.find(node => node.id === id);
          const dropped = next.nodes.find(node => node.id === id);
          if (original && dropped) for (const branchId of selectedBranches.get(id) || []) if (!projected.positions.has(branchId)) offsets.set(branchId, { x: dropped.x - original.x, y: dropped.y - original.y });
        }
        next = { ...next, nodes: next.nodes.map(node => { const shift = offsets.get(node.id); return shift ? { ...node, x: node.x + shift.x, y: node.y + shift.y } : node; }) };
        const result = reparentBranches(next, sourceIds, targetId);
        if (result.changed) {
          onChange(applySiblingAlignments(result.map));
          onMoveNotice?.(sourceIds.length > 1 ? 'Nós selecionados movidos para o novo nível. Use Desfazer para recuperar a hierarquia anterior.' : 'Ramo movido para o novo nível. Use Desfazer para recuperar a hierarquia anterior.');
          clearDropTarget(); dragPositions.current = new Map(); automaticPreview.current.clear(); setLivePositions(new Map());
          if (temporaryBranchId && sourceIds.includes(temporaryBranchId)) onTemporaryBranchDone?.();
          return;
        }
        if (result.reason) onMoveNotice?.(result.reason);
      }
      const changed = next.nodes.some((node, index) => node.x !== map.nodes[index].x || node.y !== map.nodes[index].y);
      if (changed) {
        const dimensions = collectNodeDimensions();
        const automaticLayout = map.layout !== 'free' && map.layout !== 'network';
        const reorderId = automaticLayout && map.siblingReorder !== false && requested.size === 1 ? [...requested.keys()][0] : null;
        const siblingOrder = reorderId ? reorderAlignedSibling(next, reorderId, dimensions) : null;
        if (siblingOrder?.blocked) onMoveNotice?.('Um dos subnós deste grupo está com a posição bloqueada. Desbloqueie-o antes de reordenar.');
        else if (siblingOrder?.parentId) {
          next = applySiblingAlignments(reorganizeBranch(siblingOrder.map, siblingOrder.parentId, false, dimensions), descendants(siblingOrder.map.nodes, siblingOrder.parentId));
          if (siblingOrder.reordered) onMoveNotice?.('Ordem dos subnós atualizada, mantendo o alinhamento.');
        }
        if (!siblingOrder?.parentId && !siblingOrder?.blocked) for (const id of projected.automaticRoots) next = applySiblingAlignments(reorganizeBranch(next, id, effectiveAvoidOverlap(next, id, globalAvoidOverlap), dimensions), descendants(next.nodes, id));
        const movedIds = new Set(projected.positions.keys());
        const collisionPrevention = !automaticLayout && [...requested.keys()].some(id => effectiveAvoidOverlap(map, id, globalAvoidOverlap));
        const landing = siblingOrder?.blocked ? { map, adjusted: false, blocked: false } : siblingOrder?.parentId ? { map: next, adjusted: false, blocked: false } : collisionPrevention ? snapMoveAwayFromOverlap(next, movedIds, dimensions) : { map: next, adjusted: false, blocked: false };
        if (landing.blocked) { onMoveNotice?.('Não há espaço livre próximo para este ramo. A posição anterior foi mantida.'); }
        else {
          next = landing.map;
          if (landing.adjusted) onMoveNotice?.('O ramo foi deslocado até uma posição livre para evitar sobreposição.');
          onChange(automaticLayout ? applySiblingAlignments({ ...next, nodes: layoutMap(next.nodes, next.layout, next.spacing) }) : next);
        }
      }
    }
    if (temporaryBranchId && requested.has(temporaryBranchId)) onTemporaryBranchDone?.();
    dragPositions.current = new Map();
    clearDropTarget();
    automaticPreview.current.clear();
    setLivePositions(new Map());
  }, [map, onChange, onSelectMany, readOnly, globalMovementMode, globalAvoidOverlap, temporaryBranchId, onTemporaryBranchDone, onMoveNotice, clearDropTarget]);
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
    <ReactFlow proOptions={{ hideAttribution: true }} autoPanOnNodeFocus={false} autoPanOnNodeDrag={false} panActivationKeyCode={null} nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={onNodesChange} onNodeDragStart={() => { if (dropCleanup.current) clearTimeout(dropCleanup.current); clearDropTarget(); }} onNodeDrag={(event, node) => { const pointer = 'changedTouches' in event ? event.changedTouches[0] : event; if (pointer) inspectDropTarget(pointer.clientX, pointer.clientY, selectionRef.current.length > 1 && selectionRef.current.includes(node.id) ? selectionRef.current : [node.id]); }} onNodeDragStop={(event, node) => { const pointer = 'changedTouches' in event ? event.changedTouches[0] : event; if (dragPositions.current.size && pointer) inspectDropTarget(pointer.clientX, pointer.clientY, selectionRef.current.length > 1 && selectionRef.current.includes(node.id) ? selectionRef.current : [node.id]); dropCleanup.current = setTimeout(clearDropTarget, 150); }} onConnect={onConnect} onConnectEnd={onConnectEnd} onNodeClick={(event, node) => { setContextNodeId(null); if (!event.ctrlKey && !event.metaKey && !event.shiftKey) onSelect(node.id); }} onEdgeClick={(_event, edge) => { if (readOnly) return; if (map.relationships?.some(link => link.id === edge.id)) onSelectEdge?.(edge.id); else onSelect(edge.target); }} onNodeContextMenu={(event, node) => { if (readOnly) return; event.preventDefault(); setContextNodeId(node.id); onOpenQuick?.(node.id, 'movement'); }} onPaneClick={(event) => { if (event.ctrlKey || event.metaKey) return; setContextNodeId(null); onSelect(null); }} fitView fitViewOptions={{ padding: 0.3, maxZoom: 1 }} minZoom={0.18} maxZoom={2.5} panOnDrag={spaceHeld ? [0, 1, 2] : [1, 2]} zoomOnScroll zoomOnDoubleClick={false} selectionOnDrag={false} selectionKeyCode={readOnly ? null : ["Control", "Meta", "Shift"]} multiSelectionKeyCode={["Control", "Meta"]} selectionMode={SelectionMode.Partial} deleteKeyCode={null} nodeDragThreshold={3} nodesConnectable={!readOnly} connectionMode={ConnectionMode.Loose} nodesDraggable={!readOnly} elementsSelectable={!readOnly} connectionLineType={ConnectionLineType.SmoothStep}>
      {grid && <Background variant={BackgroundVariant.Dots} gap={22} size={1.1} color="#dadde9" />}
      <ViewportPortal>{diagramBackdrop}{concentricRings.map(ring => <div key={`ring-${ring.depth}`} className="concentric-ring" style={{ left: ring.x, top: ring.y, width: ring.diameter, height: ring.diameter }}/>)}</ViewportPortal>
      <ViewportPortal>{annotations.map(({ id, kind, boundary, summary, tagIds, x, y, width, height, outline, rectangular, parts }) => {
        const selected = selectedBoundary?.id === id && selectedBoundary.kind === kind;
        const select = (event: React.MouseEvent<SVGElement>) => { event.stopPropagation(); onSelectBoundary?.({ id, kind }); };
        return <div key={`${kind}:${id}`} className={`branch-annotation ${selected ? 'selected' : ''}`} style={{ left: x, top: y, width, height }}>
          {boundary && (rectangular ? <div className="branch-boundary-frame"/> : outline && <svg className="branch-boundary-shape" width={width} height={height} aria-hidden="true"><g className="branch-boundary-fill">{parts?.map((part, index) => <rect key={index} x={part.x - x} y={part.y - y} width={part.width} height={part.height}/>)}</g><path className="branch-boundary-outer" d={outline}/><path className="branch-boundary-inner" d={outline}/></svg>)}
          {boundary && !readOnly && <svg className="branch-boundary-hit-area" width={width} height={height} aria-label="Selecionar limite">{rectangular ? <rect x={4} y={4} width={Math.max(0, width - 8)} height={Math.max(0, height - 8)} rx={8} onPointerDown={event => event.stopPropagation()} onClick={select}/> : outline && <path d={outline} onPointerDown={event => event.stopPropagation()} onClick={select}/>}</svg>}
          {Boolean(tagIds.length) && <div className="branch-tag-icons">{tagIds.map(tagId => { const tag = map.tagDefinitions?.find(item => item.id === tagId); return <span key={tagId} title={tag?.name || 'Etiqueta'} style={{ color: tag?.color || '#7057e8' }}>◆</span>; })}</div>}{summary && <div className="branch-summary">{summary}</div>}
        </div>;
      })}</ViewportPortal>
      <Controls position="bottom-left" showInteractive={false}/>
    </ReactFlow>
    {groupSelection && <>
      <div className="group-selection-frame" aria-hidden="true" style={{ left: groupSelection.left - 5, top: groupSelection.top - 5, width: groupSelection.width + 10, height: groupSelection.height + 10 }}/>
      <button type="button" className="group-selection-resize nodrag nopan"
        style={{ left: `clamp(12px, ${groupSelection.left + groupSelection.width + 5}px, calc(100% - 12px))`, top: `clamp(12px, ${groupSelection.top + groupSelection.height + 5}px, calc(100% - 12px))` }}
        disabled={!groupSelection.resizable}
        title={groupSelection.resizable ? 'Arraste horizontalmente para igualar larguras ou verticalmente para igualar alturas' : 'Desbloqueie o tamanho de pelo menos um nó'}
        aria-label="Redimensionar largura ou altura dos nós selecionados"
        onPointerDown={event => { if (!groupSelection.resizable) return; event.preventDefault(); event.stopPropagation(); groupResizeDrag.current = { x: event.clientX, y: event.clientY, zoom: viewport.zoom, axis: null, dx: 0, dy: 0 }; event.currentTarget.setPointerCapture(event.pointerId); onResizeStart?.(); }}
        onPointerMove={event => {
          const drag = groupResizeDrag.current;
          if (!drag) return;
          const moveX = event.clientX - drag.x;
          const moveY = event.clientY - drag.y;
          if (!drag.axis && Math.max(Math.abs(moveX), Math.abs(moveY)) < 4) return;
          if (!drag.axis) drag.axis = Math.abs(moveX) >= Math.abs(moveY) ? 'width' : 'height';
          drag.dx = drag.axis === 'width' ? Math.round(moveX / drag.zoom) : 0;
          drag.dy = drag.axis === 'height' ? Math.round(moveY / drag.zoom) : 0;
          onResizePreview?.(drag.dx, drag.dy);
        }}
        onPointerUp={() => stopGroupResize()} onPointerCancel={() => stopGroupResize(true)}><span aria-hidden="true">⤢</span></button>
    </>}
  </div>;
}
export default function MapCanvas(props: Props) { return <ReactFlowProvider key={props.map.id}><InnerCanvas {...props}/></ReactFlowProvider>; }
