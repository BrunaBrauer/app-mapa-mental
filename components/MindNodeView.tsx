'use client';
/* eslint-disable @next/next/no-img-element -- Images are compressed data URLs embedded in the exported map. */
import { memo, useState } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { ChevronDown, ChevronRight, Plus, StickyNote } from 'lucide-react';
import NodeQuickToolbar, { type NodeAction } from './NodeQuickToolbar';
import RichTextEditor from './RichTextEditor';
import type { LayoutMode, MindNode } from '../types';

export type NodeData = { item: MindNode; childCount: number; selected: boolean; mapLayout: LayoutMode; toolbarVisible?: boolean; alwaysToolbar?: boolean; onToggleAlwaysToolbar?: (value: boolean) => void; readOnly?: boolean; onAdd: (id: string) => void; onEdit: (id: string, text: string) => void; onToggle: (id: string) => void; onAction?: (id: string, action: NodeAction) => void; onPatch?: (id: string, patch: Partial<MindNode>) => void; onImage?: (id: string, file: File) => void; onDrivePick?: (id: string, kind: 'image' | 'link') => void };
export type FlowMindNode = Node<NodeData, 'mind'>;
function MindNodeView({ data }: NodeProps<FlowMindNode>) {
  const { item } = data; const [editing, setEditing] = useState(false);
  const startEditing = () => setEditing(true);
  const isRoot = !item.parentId && !item.floating;
  const shape = item.shape ?? 'rounded';
  const polygons: Record<string, string> = {
    diamond: '50,0 100,50 50,100 0,50', hexagon: '22,0 78,0 100,50 78,100 22,100 0,50',
    'tag-right': '0,0 82,0 100,50 82,100 0,100', 'tag-left': '18,0 100,0 100,100 18,100 0,50',
    'arrow-right': '0,18 70,18 70,0 100,50 70,100 70,82 0,82', 'arrow-left': '30,0 30,18 100,18 100,82 30,82 30,100 0,50',
    'arrow-up': '50,0 100,35 80,35 80,100 20,100 20,35 0,35', 'arrow-down': '20,0 80,0 80,65 100,65 50,100 0,65 20,65',
    'bookmark-right': '0,0 100,0 83,50 100,100 0,100', 'bookmark-left': '0,0 100,0 100,100 0,100 17,50',
  };
  const polygon = polygons[shape];
  const background = item.background ?? (isRoot ? '#7057e8' : '#fff');
  const border = item.border ?? (isRoot ? '#7057e8' : '#dcdfea');
  const icon = item.icon === undefined ? (isRoot ? '✦' : '●') : item.icon;
  const decoration = [item.underline && 'underline', item.strike && 'line-through'].filter(Boolean).join(' ') || 'none';
  return <div className={`mind-node shape-${shape} ${isRoot ? 'root-node' : ''} ${data.selected ? 'node-selected' : ''}`} style={{ background: polygon || shape === 'underline' || shape === 'transparent' ? 'transparent' : background, borderColor: polygon || shape === 'transparent' || border === 'transparent' ? 'transparent' : border, borderWidth: polygon || shape === 'transparent' || shape === 'underline' || border === 'transparent' ? 0 : (item.borderStyle === 'double' ? Math.max(3, item.borderWidth ?? 2) : (item.borderWidth ?? 2)), borderBottomWidth: shape === 'underline' && border !== 'transparent' ? (item.borderWidth ?? 2) : undefined, borderStyle: item.borderStyle ?? 'solid', width: item.width, minWidth: item.width, maxWidth: item.width, minHeight: item.height, padding: item.padding === undefined ? undefined : `${item.padding}px`, color: item.color ?? (isRoot ? '#fff' : '#20243b'), fontSize: item.fontSize || (isRoot ? 18 : 14), fontFamily: item.fontFamily || '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif', fontWeight: item.bold ? 700 : 600, fontStyle: item.italic ? 'italic' : 'normal' }} onDoubleClick={e => { e.stopPropagation(); if (!data.readOnly) startEditing(); }}>
    {/* O SVG desenha formas angulares sem cortar conectores e botões do React Flow. */}
    {polygon && <svg className="node-shape-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points={polygon} fill={background} stroke={border === 'transparent' ? 'none' : border} strokeWidth={border === 'transparent' ? 0 : (item.borderWidth ?? 2)} strokeDasharray={item.borderStyle === 'dashed' ? '7 4' : item.borderStyle === 'dotted' ? '2 3' : undefined} vectorEffect="non-scaling-stroke"/></svg>}
    <Handle type="target" id="target-left" position={Position.Left} className="node-handle" />
    <Handle type="target" id="target-right" position={Position.Right} className="node-handle" />
    <Handle type="source" id="source-left" position={Position.Left} className="node-handle" />
    <Handle type="source" id="source-right" position={Position.Right} className="node-handle" />
    <Handle type="target" id="target-top" position={Position.Top} className="node-handle" />
    <Handle type="target" id="target-bottom" position={Position.Bottom} className="node-handle" />
    <Handle type="source" id="source-top" position={Position.Top} className="node-handle" />
    <Handle type="source" id="source-bottom" position={Position.Bottom} className="node-handle" />
    <div className="node-body">{item.task && <span className="node-task-mark" aria-label={item.task.done ? 'Tarefa concluída' : 'Tarefa pendente'}>{item.task.done ? '☑' : '☐'}</span>}{icon && <span className="node-emoji">{icon}</span>}{editing ? <RichTextEditor compact autoFocus nodeId={item.id} text={item.text} runs={item.richText} onChange={(text, richText) => data.onPatch?.(item.id, { text, richText })} onDone={() => setEditing(false)}/> : <span className="node-label" style={{ textDecoration: decoration, textAlign: item.textAlign || 'left', textTransform: item.textTransform || 'none' }}>{item.richText?.length ? item.richText.map((run, index) => <span key={index} style={{ fontWeight: run.bold ? 700 : undefined, fontStyle: run.italic ? 'italic' : undefined, textDecorationLine: [run.underline && 'underline', run.strike && 'line-through'].filter(Boolean).join(' ') || undefined, textUnderlineOffset: run.underline ? '3px' : undefined, backgroundColor: run.highlight }}>{run.text}</span>) : item.text}</span>}{item.note && <StickyNote size={13} opacity={0.55} />}{Boolean(item.comments?.length) && <span className="node-comment-count" title={`${item.comments!.length} comentários`}>💬{item.comments!.length}</span>}</div>
    {item.image && <img className="node-image" src={item.image} alt={`Imagem de ${item.text}`} draggable={false}/>}
    {item.label && <span className="node-extra-label">{item.label}</span>}{item.equation && <code className="node-equation">{item.equation}</code>}{item.mediaUrl && <a className="node-media-link nodrag" href={item.mediaUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>{item.mediaType === 'audio' ? '♫ Abrir áudio' : '▶ Abrir vídeo'}</a>}
    {!data.readOnly && <button className="node-add nodrag" title="Adicionar subnó" onClick={e => { e.stopPropagation(); data.onAdd(item.id); }}><Plus size={14}/></button>}
    {data.childCount > 0 && <button className="node-collapse nodrag" title={item.collapsed ? 'Expandir ramo' : 'Recolher ramo'} onClick={e => { e.stopPropagation(); data.onToggle(item.id); }}>{item.collapsed ? <ChevronRight size={12}/> : <ChevronDown size={12}/>}<span>{data.childCount}</span></button>}
    {data.selected && data.toolbarVisible && !data.readOnly && data.onAction && data.onPatch && data.onImage && data.onDrivePick && <NodeQuickToolbar node={item} isRoot={isRoot} mapLayout={data.mapLayout} alwaysToolbar={data.alwaysToolbar ?? true} onToggleAlwaysToolbar={data.onToggleAlwaysToolbar} onAction={action => data.onAction!(item.id, action)} onPatch={patch => data.onPatch!(item.id, patch)} onImage={file => data.onImage!(item.id, file)} onDrivePick={kind => data.onDrivePick!(item.id, kind)}/>}
  </div>;
}
export default memo(MindNodeView);
