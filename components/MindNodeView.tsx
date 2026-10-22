'use client';
/* eslint-disable @next/next/no-img-element -- Images are compressed data URLs embedded in the exported map. */
import { memo, useEffect, useRef, useState } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { ChevronDown, ChevronRight, Plus, StickyNote } from 'lucide-react';
import NodeQuickToolbar, { type NodeAction } from './NodeQuickToolbar';
import type { LayoutMode, MindNode } from '../types';

export type NodeData = { item: MindNode; childCount: number; selected: boolean; mapLayout: LayoutMode; toolbarVisible?: boolean; alwaysToolbar?: boolean; onToggleAlwaysToolbar?: (value: boolean) => void; readOnly?: boolean; onAdd: (id: string) => void; onEdit: (id: string, text: string) => void; onToggle: (id: string) => void; onAction?: (id: string, action: NodeAction) => void; onPatch?: (id: string, patch: Partial<MindNode>) => void; onImage?: (id: string, file: File) => void; onDrivePick?: (id: string, kind: 'image' | 'link') => void };
export type FlowMindNode = Node<NodeData, 'mind'>;
function MindNodeView({ data }: NodeProps<FlowMindNode>) {
  const { item } = data; const [editing, setEditing] = useState(false); const [draft, setDraft] = useState(item.text); const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) input.current?.focus(); }, [editing]);
  const startEditing = () => { setDraft(item.text); setEditing(true); };
  const finish = () => { data.onEdit(item.id, draft.trim() || 'Nova ideia'); setEditing(false); };
  const isRoot = !item.parentId && !item.floating;
  const shape = item.shape ?? 'rounded';
  const polygon = shape === 'diamond' ? '50,0 100,50 50,100 0,50' : shape === 'hexagon' ? '22,0 78,0 100,50 78,100 22,100 0,50' : null;
  const background = item.background ?? (isRoot ? '#7057e8' : '#fff');
  const border = item.border ?? (isRoot ? '#7057e8' : '#dcdfea');
  const icon = item.icon === undefined ? (isRoot ? '✦' : '●') : item.icon;
  const decoration = [item.underline && 'underline', item.strike && 'line-through'].filter(Boolean).join(' ') || 'none';
  return <div className={`mind-node shape-${shape} ${isRoot ? 'root-node' : ''} ${data.selected ? 'node-selected' : ''}`} style={{ background: polygon ? 'transparent' : background, borderColor: polygon || border === 'transparent' ? 'transparent' : border, borderWidth: polygon || border === 'transparent' ? 0 : 2, color: item.color ?? (isRoot ? '#fff' : '#20243b'), fontSize: item.fontSize || (isRoot ? 18 : 14), fontFamily: item.fontFamily || '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif', fontWeight: item.bold ? 700 : 600, fontStyle: item.italic ? 'italic' : 'normal' }} onDoubleClick={e => { e.stopPropagation(); if (!data.readOnly) startEditing(); }}>
    {/* O SVG desenha formas angulares sem cortar conectores e botões do React Flow. */}
    {polygon && <svg className="node-shape-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points={polygon} fill={background} stroke={border === 'transparent' ? 'none' : border} strokeWidth={border === 'transparent' ? 0 : 2} vectorEffect="non-scaling-stroke"/></svg>}
    <Handle type="target" id="target-left" position={Position.Left} className="node-handle" />
    <Handle type="target" id="target-right" position={Position.Right} className="node-handle" />
    <Handle type="source" id="source-left" position={Position.Left} className="node-handle" />
    <Handle type="source" id="source-right" position={Position.Right} className="node-handle" />
    <Handle type="target" id="target-top" position={Position.Top} className="node-handle" />
    <Handle type="target" id="target-bottom" position={Position.Bottom} className="node-handle" />
    <Handle type="source" id="source-top" position={Position.Top} className="node-handle" />
    <Handle type="source" id="source-bottom" position={Position.Bottom} className="node-handle" />
    <div className="node-body">{item.task && <span className="node-task-mark" aria-label={item.task.done ? 'Tarefa concluída' : 'Tarefa pendente'}>{item.task.done ? '☑' : '☐'}</span>}{icon && <span className="node-emoji">{icon}</span>}{editing ? <input ref={input} className="nodrag node-input" value={draft} onChange={e => setDraft(e.target.value)} onBlur={finish} onKeyDown={e => { if (e.key === 'Enter') finish(); if (e.key === 'Escape') { setEditing(false); setDraft(item.text); } }} /> : <span className="node-label" style={{ textDecoration: decoration, textAlign: item.textAlign || 'left', textTransform: item.textTransform || 'none' }}>{item.text}</span>}{item.note && <StickyNote size={13} opacity={0.55} />}{Boolean(item.comments?.length) && <span className="node-comment-count" title={`${item.comments!.length} comentários`}>💬{item.comments!.length}</span>}</div>
    {item.image && <img className="node-image" src={item.image} alt={`Imagem de ${item.text}`} draggable={false}/>}
    {item.label && <span className="node-extra-label">{item.label}</span>}{item.equation && <code className="node-equation">{item.equation}</code>}{item.mediaUrl && <a className="node-media-link nodrag" href={item.mediaUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>{item.mediaType === 'audio' ? '♫ Abrir áudio' : '▶ Abrir vídeo'}</a>}
    {!data.readOnly && <button className="node-add nodrag" title="Adicionar subnó" onClick={e => { e.stopPropagation(); data.onAdd(item.id); }}><Plus size={14}/></button>}
    {data.childCount > 0 && <button className="node-collapse nodrag" title={item.collapsed ? 'Expandir ramo' : 'Recolher ramo'} onClick={e => { e.stopPropagation(); data.onToggle(item.id); }}>{item.collapsed ? <ChevronRight size={12}/> : <ChevronDown size={12}/>}<span>{data.childCount}</span></button>}
    {data.selected && data.toolbarVisible && !data.readOnly && data.onAction && data.onPatch && data.onImage && data.onDrivePick && <NodeQuickToolbar node={item} isRoot={isRoot} mapLayout={data.mapLayout} alwaysToolbar={data.alwaysToolbar ?? true} onToggleAlwaysToolbar={data.onToggleAlwaysToolbar} onAction={action => data.onAction!(item.id, action)} onPatch={patch => data.onPatch!(item.id, patch)} onImage={file => data.onImage!(item.id, file)} onDrivePick={kind => data.onDrivePick!(item.id, kind)}/>}
  </div>;
}
export default memo(MindNodeView);
