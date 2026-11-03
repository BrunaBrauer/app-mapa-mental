'use client';
/* eslint-disable @next/next/no-img-element -- Images are compressed data URLs embedded in the exported map. */
import { memo, useEffect, useRef, useState } from 'react';
import { Handle, NodeResizeControl, Position, type Node, type NodeProps } from '@xyflow/react';
import { Link2, LockKeyhole, MessageSquareQuote, Plus, StickyNote } from 'lucide-react';
import NodeQuickToolbar, { type NodeAction, type NodePanel } from './NodeQuickToolbar';
import RichTextEditor, { type RichTextEditorHandle } from './RichTextEditor';
import type { LayoutMode, MindMap, MindNode, MovementMode, NodeStyle } from '../types';
import type { ImportedFont } from '../lib/fonts';
import type { VisualOperation, VisualScope, VisualStyleGroup } from '../lib/visual-standardization';
import { sizeLimits } from '../lib/visual-standardization';
import type { BranchDirection } from '../lib/maps';

export type NodeData = { item: MindNode; map: MindMap; childCount: number; hiddenDescendantCount: number; collapseSide: BranchDirection; selected: boolean; mapLayout: LayoutMode; effectiveMovement: MovementMode; inheritedAvoidOverlap: boolean; dragParticipant?: boolean; toolbarVisible?: boolean; alwaysToolbar?: boolean; onToggleAlwaysToolbar?: (value: boolean) => void; readOnly?: boolean; onAdd: (id: string) => void; onEdit: (id: string, text: string) => void; onToggle: (id: string) => void; onAction?: (id: string, action: NodeAction) => void; onVisual?: (ids: string[], scope: VisualScope, operation: VisualOperation, value?: number, styleGroups?: VisualStyleGroup[]) => void; onOpenQuick?: (id: string, panel: NodePanel) => void; onPatch?: (id: string, patch: Partial<MindNode>) => void; onImage?: (id: string, file: File) => void; onDrivePick?: (id: string, kind: 'image' | 'link') => void; fonts?: ImportedFont[]; onImportFont?: (id: string, file: File) => Promise<void>; favoriteIcons?: string[]; onFavoriteIcons?: (icons: string[]) => void; presets?: { id: string; name: string; style: Partial<NodeStyle> }[]; requestedPanel?: { panel: NodePanel; key: number } | null };
export type FlowMindNode = Node<NodeData, 'mind'>;
function MindNodeView({ data }: NodeProps<FlowMindNode>) {
  const { item } = data; const [editing, setEditing] = useState(false);
  const [resizing, setResizing] = useState<{ width: number; height: number } | null>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const inlineEditor = useRef<RichTextEditorHandle>(null);
  const [contentOverflow, setContentOverflow] = useState(false);
  useEffect(() => {
    const label = labelRef.current;
    if (!label) return;
    if (item.height === undefined && item.maxHeight === undefined && item.wrapText !== false) {
      return;
    }
    const check = () => setContentOverflow(label.scrollHeight > label.clientHeight + 1 || label.scrollWidth > label.clientWidth + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(label);
    return () => observer.disconnect();
  }, [item.text, item.richText, item.fontSize, item.fontFamily, item.lineSpacing, item.letterSpacing, item.padding, item.paddingTop, item.paddingBottom, item.wrapText, item.width, item.height, item.maxHeight]);
  const startEditing = () => { setEditing(true); data.onOpenQuick?.(item.id, 'style'); };
  const isRoot = !item.parentId && !item.floating;
  const shape = data.mapLayout === 'treemap' ? 'rectangle' : data.mapLayout === 'flowchart' && item.flowDecision ? 'diamond' : item.shape ?? 'rounded';
  const polygons: Record<string, string> = {
    diamond: '50,0 100,50 50,100 0,50', hexagon: '22,0 78,0 100,50 78,100 22,100 0,50',
    'tag-right': '0,0 82,0 100,50 82,100 0,100', 'tag-left': '18,0 100,0 100,100 18,100 0,50',
    'arrow-right': '0,18 70,18 70,0 100,50 70,100 70,82 0,82', 'arrow-left': '30,0 30,18 100,18 100,82 30,82 30,100 0,50',
    'arrow-up': '50,0 100,35 80,35 80,100 20,100 20,35 0,35', 'arrow-down': '20,0 80,0 80,65 100,65 50,100 0,65 20,65',
    'bookmark-right': '0,0 100,0 83,50 100,100 0,100', 'bookmark-left': '0,0 100,0 100,100 0,100 17,50',
  };
  const polygon = polygons[shape];
  const background = item.background ?? '#ffffff';
  const border = item.border ?? '#000000';
  const icon = item.icon ?? '';
  const decoration = [item.underline && 'underline', item.strike && 'line-through'].filter(Boolean).join(' ') || 'none';
  const width = resizing?.width ?? item.width;
  const height = resizing?.height ?? item.height;
  const limits = sizeLimits(item);
  return <>{data.selected && data.toolbarVisible && !data.readOnly && !item.sizeLocked && data.mapLayout !== 'treemap' && <NodeResizeControl position="bottom-right" minWidth={limits.minWidth} maxWidth={limits.maxWidth} minHeight={limits.minHeight} maxHeight={limits.maxHeight} keepAspectRatio={Boolean(item.lockAspectRatio)} color="#7057e8" className="nodrag" onResize={(_event, size) => setResizing({ width: size.width, height: size.height })} onResizeEnd={(_event, size) => { setResizing(null); data.onPatch?.(item.id, { width: Math.round(size.width), height: Math.round(size.height), sizeMode: 'custom' }); }}><span className="node-resize-grip" title="Arraste para redimensionar"/></NodeResizeControl>}<div className={`mind-node shape-${shape} ${data.mapLayout === 'treemap' ? 'treemap-node' : ''} ${isRoot ? 'root-node' : ''} ${data.selected ? 'node-selected' : ''} ${data.dragParticipant ? 'node-drag-linked' : ''} ${item.positionLocked ? 'node-position-locked' : ''}`} style={{ background: polygon || shape === 'underline' || shape === 'transparent' ? 'transparent' : background, borderColor: polygon || shape === 'transparent' || border === 'transparent' ? 'transparent' : border, borderWidth: polygon || shape === 'transparent' || shape === 'underline' || border === 'transparent' ? 0 : (item.borderStyle === 'double' ? Math.max(3, item.borderWidth ?? 2) : (item.borderWidth ?? 2)), borderBottomWidth: shape === 'underline' && border !== 'transparent' ? (item.borderWidth ?? 2) : undefined, borderStyle: item.borderStyle ?? 'solid', borderRadius: item.cornerRadius, width, minWidth: width ?? item.minWidth, maxWidth: width ?? item.maxWidth, height, minHeight: height ?? item.minHeight, maxHeight: height ?? item.maxHeight, padding: item.padding === undefined ? undefined : `${item.padding}px`, paddingTop: item.paddingTop, paddingRight: item.paddingRight, paddingBottom: item.paddingBottom, paddingLeft: item.paddingLeft, alignItems: item.textVerticalAlign === 'top' ? 'flex-start' : item.textVerticalAlign === 'bottom' ? 'flex-end' : 'center', color: item.color ?? '#20243b', fontSize: item.fontSize || (isRoot ? 18 : 14), fontFamily: item.fontFamily || '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif', lineHeight: item.lineSpacing ?? 1.3, letterSpacing: `${item.letterSpacing ?? 0}px`, textAlign: item.textAlign || 'left', fontWeight: item.bold ? 700 : 600, fontStyle: item.italic ? 'italic' : 'normal' }} onDoubleClick={e => { e.stopPropagation(); if (!data.readOnly) startEditing(); }}>
    {/* O SVG desenha formas angulares sem cortar conectores e botões do React Flow. */}
    {polygon && <svg className="node-shape-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points={polygon} fill={background} stroke={border === 'transparent' ? 'none' : border} strokeWidth={border === 'transparent' ? 0 : (item.borderWidth ?? 2)} strokeDasharray={item.borderStyle === 'dashed' ? '7 4' : item.borderStyle === 'dotted' ? '2 3' : undefined} vectorEffect="non-scaling-stroke"/></svg>}
    <Handle type="source" id="source-left" position={Position.Left} className="node-handle" />
    <Handle type="source" id="source-right" position={Position.Right} className="node-handle" />
    <Handle type="source" id="source-top" position={Position.Top} className="node-handle" />
    <Handle type="source" id="source-bottom" position={Position.Bottom} className="node-handle" />
    <Handle type="target" id="target-left" position={Position.Left} className="node-handle node-handle-target" />
    <Handle type="target" id="target-right" position={Position.Right} className="node-handle node-handle-target" />
    <Handle type="target" id="target-top" position={Position.Top} className="node-handle node-handle-target" />
    <Handle type="target" id="target-bottom" position={Position.Bottom} className="node-handle node-handle-target" />
    <div className="node-body">{item.positionLocked && <span className="node-lock" title="Posição bloqueada" aria-label="Posição bloqueada"><LockKeyhole size={13}/></span>}{item.task && <span className="node-task-mark" aria-label={item.task.done ? 'Tarefa concluída' : 'Tarefa pendente'}>{item.task.done ? '☑' : '☐'}</span>}{icon && <span className="node-emoji">{icon}</span>}{editing ? <RichTextEditor ref={inlineEditor} compact autoFocus nodeId={item.id} text={item.text} runs={item.richText} onChange={(text, richText) => data.onPatch?.(item.id, { text, richText })} onDone={relatedTarget => { if (!(relatedTarget instanceof Element && relatedTarget.closest('.node-quick-toolbar'))) setEditing(false); }}/> : <span ref={labelRef} className="node-label" title={item.text} style={{ textDecoration: item.richText?.length ? 'none' : decoration, textAlign: item.textAlign || 'left', textTransform: item.textTransform || 'none', lineHeight: item.lineSpacing ?? 1.3, letterSpacing: `${item.letterSpacing ?? 0}px`, whiteSpace: item.wrapText === false ? 'nowrap' : undefined, overflowY: height || item.maxHeight ? 'auto' : undefined, maxHeight: height || item.maxHeight ? Math.max(16, (height ?? item.maxHeight!) - (item.paddingTop ?? item.padding ?? 10) - (item.paddingBottom ?? item.padding ?? 10) - 4) : undefined }}>{item.richText?.length ? item.richText.map((run, index) => <span key={index} style={{ fontWeight: run.bold === undefined ? undefined : run.bold ? 700 : 400, fontStyle: run.italic === undefined ? undefined : run.italic ? 'italic' : 'normal', textDecorationLine: [(run.underline ?? item.underline) && 'underline', (run.strike ?? item.strike) && 'line-through'].filter(Boolean).join(' ') || 'none', textUnderlineOffset: run.underline ? '4px' : undefined, backgroundColor: run.highlight, color: run.color, fontSize: run.fontSize, fontFamily: run.fontFamily, lineHeight: run.lineSpacing, letterSpacing: run.letterSpacing === undefined ? undefined : `${run.letterSpacing}px`, textTransform: run.textTransform }}>{run.text}</span>) : item.text}</span>}{contentOverflow && !editing && (height !== undefined || item.maxHeight !== undefined || item.wrapText === false) && <span className="node-size-warning nodrag" role="status" title="O conteúdo não cabe nas dimensões configuradas. Aumente o tamanho ou ajuste ao conteúdo." aria-label="Conteúdo maior que a caixa">!</span>}{item.note && <button className="node-attachment nodrag" title="Editar nota" aria-label="Editar nota" onClick={e => { e.stopPropagation(); data.onOpenQuick?.(item.id, 'notes'); }}><StickyNote size={14}/></button>}{Boolean(item.comments?.length) && <button className="node-attachment nodrag" title="Editar comentários" aria-label="Editar comentários" onClick={e => { e.stopPropagation(); data.onOpenQuick?.(item.id, 'comments'); }}><MessageSquareQuote size={14}/><span>{item.comments!.length}</span></button>}{item.url && <a className="node-attachment nodrag" title="Abrir link" aria-label="Abrir link" href={/^https?:\/\//i.test(item.url) ? item.url : `https://${item.url}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}><Link2 size={14}/></a>}</div>
    {item.image && <img className="node-image" src={item.image} alt={`Imagem de ${item.text}`} draggable={false} style={{ maxWidth: width ? Math.max(20, width - 28) : undefined, maxHeight: height ? Math.max(0, height - 48) : undefined }}/>}
    {data.mapLayout === 'timeline' && item.timelineDate && <span className="node-extra-label">{item.timelineDate}</span>}{item.label && <span className="node-extra-label">{item.label}</span>}{item.equation && <code className="node-equation">{item.equation}</code>}{item.mediaUrl && <a className="node-media-link nodrag" href={item.mediaUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>{item.mediaType === 'audio' ? '♫ Abrir áudio' : '▶ Abrir vídeo'}</a>}
    {(!data.readOnly || data.childCount > 0) && <div className={`node-branch-actions node-branch-actions-${data.collapseSide}`}>
      {!data.readOnly && <button type="button" className="node-add nodrag" title="Adicionar subnó" aria-label="Adicionar subnó" onClick={e => { e.stopPropagation(); data.onAdd(item.id); }}><Plus size={14}/></button>}
      {data.childCount > 0 && <button type="button" className="node-collapse nodrag" title={item.collapsed ? `Expandir ${data.childCount} filhos diretos; ${data.hiddenDescendantCount} descendentes ocultos` : 'Recolher ramificação'} aria-label={item.collapsed ? `Expandir ${data.childCount} filhos diretos; ${data.hiddenDescendantCount} descendentes ocultos` : 'Recolher ramificação'} aria-expanded={!item.collapsed} onClick={e => { e.stopPropagation(); data.onToggle(item.id); }}>{item.collapsed && <span>{data.childCount}</span>}<span aria-hidden="true" className={`node-collapse-chevron node-collapse-chevron-${data.collapseSide}-${item.collapsed ? 'expand' : 'collapse'}`}>❯</span></button>}
    </div>}
    {data.selected && data.toolbarVisible && !data.readOnly && data.onAction && data.onPatch && data.onImage && data.onDrivePick && <NodeQuickToolbar node={item} map={data.map} isRoot={isRoot} mapLayout={data.mapLayout} effectiveMovement={data.effectiveMovement} inheritedAvoidOverlap={data.inheritedAvoidOverlap} alwaysToolbar={data.alwaysToolbar ?? true} onToggleAlwaysToolbar={data.onToggleAlwaysToolbar} onAction={action => data.onAction!(item.id, action)} onVisual={(scope, operation, value, styleGroups) => data.onVisual?.([item.id], scope, operation, value, styleGroups)} onPatch={patch => data.onPatch!(item.id, patch)} onImage={file => data.onImage!(item.id, file)} onDrivePick={kind => data.onDrivePick!(item.id, kind)} fonts={data.fonts} onImportFont={file => data.onImportFont?.(item.id, file) ?? Promise.resolve()} favoriteIcons={data.favoriteIcons} onFavoriteIcons={data.onFavoriteIcons} presets={data.presets} requestedPanel={data.requestedPanel} editing={editing} inlineEditor={inlineEditor}/>}
  </div></>;
}
export default memo(MindNodeView);
