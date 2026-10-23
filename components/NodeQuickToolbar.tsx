'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useViewport } from '@xyflow/react';
import { Box, CheckSquare2, ChevronDown, Ellipsis, FileText, ImagePlus, Italic, LayoutTemplate, Link2, MessageSquareQuote, Plus, Sparkles, Strikethrough, Trash2, Type, Underline, Bold } from 'lucide-react';
import type { LayoutMode, MindNode, NodeStyle } from '../types';
import LayoutPicker from './LayoutPicker';
import { QuickLinePanel, QuickNodePanel, QuickTextPanel } from './QuickStylePanels';
import type { ImportedFont } from '../lib/fonts';

export type NodeAction = LayoutMode | 'child' | 'sibling' | 'same-style' | 'relationship' | 'floating' | 'boundary' | 'summary' | 'label' | 'equation' | 'text' | 'style' | 'notes' | 'comments' | 'icon' | 'link' | 'task' | 'ideas' | 'questions' | 'ai-summary' | 'explain' | 'pros-cons' | 'swot' | 'topics' | 'collapse' | 'spacing-compact' | 'spacing-normal' | 'spacing-wide' | 'duplicate' | 'copy-text' | 'copy' | 'cut' | 'paste' | 'copy-style' | 'paste-style' | 'set-default-style' | 'copy-link' | 'detach' | 'delete' | 'reference-size' | 'reference-format' | 'reference-both' | 'save-style-preset' | 'apply-level-line' | `preset:${string}`;
export type NodePanel = 'insert' | 'style' | 'node' | 'line' | 'notes' | 'comments' | 'media' | 'links' | 'task' | 'smart' | 'layout' | 'more';
type Panel = NodePanel;

export default function NodeQuickToolbar({ node, isRoot, mapLayout, alwaysToolbar, onToggleAlwaysToolbar, onAction, onPatch, onImage, onDrivePick, fonts = [], onImportFont = async () => {}, favoriteIcons = [], onFavoriteIcons = () => {}, presets = [], requestedPanel }: { node: MindNode; isRoot: boolean; mapLayout: LayoutMode; alwaysToolbar: boolean; onToggleAlwaysToolbar?: (value: boolean) => void; onAction: (action: NodeAction) => void; onPatch: (patch: Partial<MindNode>) => void; onImage: (file: File) => void; onDrivePick: (kind: 'image' | 'link') => void; fonts?: ImportedFont[]; onImportFont?: (file: File) => Promise<void>; favoriteIcons?: string[]; onFavoriteIcons?: (icons: string[]) => void; presets?: { id: string; name: string; style: Partial<NodeStyle> }[]; requestedPanel?: { panel: NodePanel; key: number } | null }) {
  const [open, setOpen] = useState<Panel | null>(null);
  const [mediaTab, setMediaTab] = useState<'image' | 'video' | 'audio'>('image');
  const [commentDraft, setCommentDraft] = useState('');
  const viewport = useViewport();
  const [placement, setPlacement] = useState({ x: 12, y: 80, panelX: 12, panelY: 130, width: 420, height: 400 });
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => { if (requestedPanel) setOpen(requestedPanel.panel); }, [requestedPanel]);
  const input = useRef<HTMLInputElement>(null);
  const noteInput = useRef<HTMLTextAreaElement>(null);
  const commentInput = useRef<HTMLTextAreaElement>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  const action = (name: NodeAction) => { setOpen(null); onAction(name); };
  const menu = (name: Panel) => setOpen(current => current === name ? null : name);
  useEffect(() => {
    // O portal sai da transformação do canvas: menus usam pixels de tela, não o zoom do mapa.
    const update = () => {
      const element = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(node.id)}"]`);
      if (!element) return;
      setHost(document.querySelector('.app-shell'));
      const rect = element.getBoundingClientRect();
      const area = document.querySelector('.canvas-surface')?.getBoundingClientRect();
      const left = Math.max(12, (area?.left || 0) + 12);
      const right = window.innerWidth - 12;
      const top = Math.max(12, (area?.top || 0) + 12);
      const bottom = window.innerHeight - 12;
      const barWidth = Math.min(toolbar.current?.offsetWidth || 490, right - left);
      const barHeight = toolbar.current?.offsetHeight || 48;
      const x = Math.max(left, Math.min(right - barWidth, rect.left + rect.width / 2 - barWidth / 2));
      let y = Math.max(top, Math.min(bottom - barHeight, rect.top - barHeight - 12));
      const width = Math.min(open === 'notes' || open === 'comments' ? 510 : 420, right - left);
      let height = Math.min(520, bottom - top);
      const besideRight = right - rect.right - 16 >= width;
      const besideLeft = rect.left - left - 16 >= width;
      const preferredX = besideRight ? rect.right + 16 : besideLeft ? rect.left - width - 16 : x;
      const panelX = Math.max(left, Math.min(preferredX, right - width));
      let panelY = Math.max(top, Math.min(y, bottom - height));
      if ((!besideRight && !besideLeft) || (panelX < x + barWidth && panelX + width > x)) {
        // Empilhe barra e painel sem sobreposição quando não há espaço lateral.
        if (open) y = Math.max(top, Math.min(y, bottom - barHeight - 8 - Math.min(360, height)));
        panelY = y + barHeight + 8;
        height = Math.max(60, Math.min(520, bottom - panelY));
      }
      setPlacement({ x, y, panelX, panelY, width, height });
    };
    const frame = requestAnimationFrame(update);
    const observer = new ResizeObserver(update);
    if (toolbar.current) observer.observe(toolbar.current);
    const canvas = document.querySelector('.canvas-surface');
    if (canvas) observer.observe(canvas);
    window.addEventListener('resize', update);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', update); };
  }, [node.id, node.x, node.y, viewport.x, viewport.y, viewport.zoom, open, host]);
  useEffect(() => { const close = (event: PointerEvent) => { if (!toolbar.current?.contains(event.target as HTMLElement)) setOpen(null); }; const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(null); }; document.addEventListener('pointerdown', close); document.addEventListener('keydown', escape); return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); }; }, []);
  const addComment = () => { const text = commentDraft.trim(); if (!text) return; onPatch({ comments: [...(node.comments || []), { id: crypto.randomUUID(), text, createdAt: Date.now() }] }); setCommentDraft(''); };
  const formatDraft = (kind: 'note' | 'comment', before: string, after = before) => {
    const element = kind === 'note' ? noteInput.current : commentInput.current; if (!element) return;
    const text = kind === 'note' ? node.note || '' : commentDraft; const start = element.selectionStart; const end = element.selectionEnd;
    const selection = text.slice(start, end) || 'texto'; const next = text.slice(0, start) + before + selection + after + text.slice(end);
    if (kind === 'note') onPatch({ note: next }); else setCommentDraft(next);
    requestAnimationFrame(() => { element.focus(); element.setSelectionRange(start + before.length, start + before.length + selection.length); });
  };
  const richControls = (kind: 'note' | 'comment') => <div className="quick-rich-controls"><button title="Título" onClick={() => formatDraft(kind, '## ', '')}>H</button><button title="Lista" onClick={() => formatDraft(kind, '- ', '')}>☷</button><button title="Negrito" onClick={() => formatDraft(kind, '**')}><Bold size={15}/></button><button title="Itálico" onClick={() => formatDraft(kind, '*')}><Italic size={15}/></button><button title="Riscado" onClick={() => formatDraft(kind, '~~')}><Strikethrough size={15}/></button><button title="Sublinhado" onClick={() => formatDraft(kind, '<u>', '</u>')}><Underline size={15}/></button><button title="Código" onClick={() => formatDraft(kind, '`')}>{'</>'}</button><button title="Link" onClick={() => formatDraft(kind, '[', '](https://exemplo.com)')}><Link2 size={15}/></button></div>;
  const row = (label: string, name: NodeAction, shortcut?: string, disabled = false) => <button className="quick-row" disabled={disabled} onClick={() => action(name)}><span>{label}</span>{shortcut && <kbd>{shortcut}</kbd>}</button>;
  const button = (panel: Panel, label: string, icon: ReactNode, arrow = false) => <button className={open === panel ? 'active' : ''} title={label} aria-label={label} aria-expanded={open === panel} onClick={() => menu(panel)}>{icon}{arrow && <ChevronDown className="quick-chevron"/>}</button>;
  if (!host) return null;
  return createPortal(<div ref={toolbar} className="node-quick-toolbar nodrag nopan nowheel nokey" style={{ position: 'fixed', left: placement.x, top: placement.y, bottom: 'auto', transform: 'none', zIndex: 60, maxWidth: 'calc(100vw - 24px)', flexWrap: 'wrap', height: 'auto', minHeight: 48 }} role="toolbar" aria-label={`Edição rápida de ${node.text}`} onPointerDown={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
    {button('insert','Inserir',<Plus/>,true)}{button('style','Texto e estilo',<Type/>)}{button('node','Editar nó',<Box/>)}{button('line','Linha de ligação',<span className="quick-line-symbol">⌁</span>)}{button('notes','Notas',<FileText/>)}{button('comments','Comentários',<MessageSquareQuote/>)}{button('media','Multimídia',<ImagePlus/>)}{button('links','Links e anexos',<Link2/>)}{button('task','Tarefa',<CheckSquare2/>)}{button('smart','Ferramentas inteligentes',<Sparkles/>)}{button('layout','Layout',<LayoutTemplate/>)}{button('more','Mais opções',<Ellipsis/>)}
    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={e => { const file = e.target.files?.[0]; if (file) onImage(file); e.target.value = ''; }}/>
    {open && <div className={`node-popover panel-${open}`} style={{ position: 'fixed', left: placement.panelX, top: placement.panelY, right: 'auto', bottom: 'auto', transform: 'none', width: placement.width, maxWidth: placement.width, maxHeight: placement.height, overflowY: 'auto', boxSizing: 'border-box' }} onMouseDown={e => e.stopPropagation()}>
      {open === 'insert' && <div className="quick-menu-list">{row('Inserir subnó','child','Tab')}{row('Inserir nó irmão','sibling','Enter',isRoot)}{row('Relação entre nós','relationship','Ctrl+L')}{row(node.boundary ? 'Remover limite do ramo' : 'Limite do ramo','boundary')}{row('Resumo','summary')}{row('Rótulo','label')}{row('Equação matemática','equation')}{row('Tarefa','task')}<div className="quick-separator"/>{row('Nó flutuante','floating')}{row('Duplicar ramo','duplicate','Ctrl+D',isRoot)}{row('Nó com o mesmo estilo','same-style','Alt+Enter',isRoot)}</div>}
      {open === 'style' && <QuickTextPanel node={node} fonts={fonts} favorites={favoriteIcons} onPatch={onPatch} onImportFont={onImportFont} onFavorites={onFavoriteIcons}/>}
      {open === 'node' && <QuickNodePanel node={node} onPatch={onPatch} presets={presets} onAction={name => action(name as NodeAction)}/>}
      {open === 'line' && <QuickLinePanel node={node} onPatch={onPatch} onApplyLevel={() => action('apply-level-line')}/>}
      {open === 'notes' && <div className="quick-writing"><strong>Notas</strong>{richControls('note')}<textarea ref={noteInput} rows={8} placeholder="Escreva uma nota..." value={node.note || ''} onChange={e => onPatch({ note: e.target.value })}/><small>Formatação Markdown · salvo automaticamente</small></div>}
      {open === 'comments' && <div className="quick-writing"><strong>Comentários</strong><div className="quick-comments">{node.comments?.map(comment => <div key={comment.id}><span>{comment.text}</span><button aria-label="Excluir comentário" onClick={() => onPatch({ comments: node.comments?.filter(item => item.id !== comment.id) })}><Trash2 size={13}/></button></div>)}{!node.comments?.length && <p>Nenhum comentário ainda.</p>}</div>{richControls('comment')}<textarea ref={commentInput} rows={5} placeholder="Escreva um comentário..." value={commentDraft} onChange={e => setCommentDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addComment(); } }}/><button className="quick-primary" disabled={!commentDraft.trim()} onClick={addComment}>Publicar comentário</button></div>}
      {open === 'media' && <div className="quick-media"><div className="quick-tabs">{(['image','video','audio'] as const).map(tab => <button key={tab} className={mediaTab === tab ? 'active' : ''} onClick={() => setMediaTab(tab)}>{({image:'Imagem',video:'Vídeo',audio:'Áudio'})[tab]}</button>)}</div>{mediaTab === 'image' ? <><label className="quick-field">Link da imagem<input type="url" placeholder="https://..." value={node.image?.startsWith('http') ? node.image : ''} onChange={e => onPatch({ image: e.target.value })}/></label><div className="quick-tiles"><button onClick={() => input.current?.click()}>💻<span>Computador</span></button><button onClick={() => onDrivePick('image')}>🔺<span>Google Drive</span></button></div>{node.image && <button className="quick-text-action" onClick={() => onPatch({ image: undefined })}>Remover imagem</button>}</> : <label className="quick-field">Link de {mediaTab === 'video' ? 'vídeo' : 'áudio'}<input type="url" placeholder="https://..." value={node.mediaType === mediaTab ? node.mediaUrl || '' : ''} onChange={e => onPatch({ mediaType: mediaTab, mediaUrl: e.target.value })}/></label>}</div>}
      {open === 'links' && <div className="quick-media"><strong>Links e anexos</strong><label className="quick-field">Cole um link<input type="url" placeholder="https://..." value={node.url || ''} onChange={e => onPatch({ url: e.target.value })}/></label><div className="quick-tiles"><button onClick={() => onDrivePick('link')}>🔺<span>Google Drive</span></button><button onClick={() => action('copy-link')}>🔗<span>Link deste nó</span></button></div>{node.url && <button className="quick-text-action" onClick={() => onPatch({ url: undefined })}>Remover link</button>}</div>}
      {open === 'task' && <div className="quick-task"><strong>Tarefa</strong>{!node.task ? <button className="quick-primary" onClick={() => onPatch({ task: { done: false, progress: 0 } })}>Transformar em tarefa</button> : <><label className="quick-check"><input type="checkbox" checked={node.task.done} onChange={e => onPatch({ task: { ...node.task!, done: e.target.checked, progress: e.target.checked ? 100 : 0 } })}/> Concluída</label><span>Prioridade</span><div className="priority-row">{(['p0','p1','p2','p3','p4'] as const).map((priority,index) => <button key={priority} className={`priority-${index} ${node.task?.priority === priority ? 'active' : ''}`} onClick={() => onPatch({ task: { ...node.task!, priority } })}>{priority.toUpperCase()}</button>)}</div><label className="quick-field">Progresso: {node.task.progress ?? 0}%<input type="range" min="0" max="100" step="10" value={node.task.progress ?? 0} onChange={e => onPatch({ task: { ...node.task!, progress: Number(e.target.value), done: Number(e.target.value) === 100 } })}/></label><div className="task-dates"><label>Início<input type="date" value={node.task.start || ''} onChange={e => onPatch({ task: { ...node.task!, start: e.target.value } })}/></label><label>Duração (dias)<input type="number" min="0" value={node.task.duration ?? ''} onChange={e => onPatch({ task: { ...node.task!, duration: Number(e.target.value) } })}/></label><label>Prazo<input type="date" value={node.task.due || ''} onChange={e => onPatch({ task: { ...node.task!, due: e.target.value } })}/></label></div><label className="quick-field">Responsável<input placeholder="Nome da pessoa" value={node.task.assignee || ''} onChange={e => onPatch({ task: { ...node.task!, assignee: e.target.value } })}/></label><button className="quick-text-action" onClick={() => onPatch({ task: undefined })}>Remover tarefa</button></>}</div>}
      {open === 'smart' && <div className="quick-menu-list"><span className="quick-popover-caption">IA GEMINI · PORTUGUÊS</span>{row('Expandir com ideias','ideas')}{row('Expandir com perguntas','questions')}{row('Resumir nas notas','ai-summary')}{row('Fazer análise SWOT','swot')}<div className="quick-separator"/><span className="quick-popover-caption">MODELOS RÁPIDOS</span>{row('Adicionar prós e contras','pros-cons')}{row('Expandir com tópicos','topics')}<small>As sugestões da IA são revisadas antes de entrar no mapa.</small></div>}
      {open === 'layout' && <div className="quick-menu-list"><span className="quick-popover-caption">LAYOUT {isRoot ? 'DO MAPA' : 'DESTE RAMO'}</span><LayoutPicker selected={node.branchLayout || mapLayout} onChoose={mode => action(mode)}/>{row(node.collapsed ? 'Expandir este ramo' : 'Recolher este ramo','collapse')}<div className="quick-separator"/><span className="quick-popover-caption">ESPAÇAMENTO</span><div className="layout-spacing">{(['spacing-compact','spacing-normal','spacing-wide'] as const).map((option, index) => <button key={option} onClick={() => action(option)}>{['Compacto','Normal','Amplo'][index]}</button>)}</div></div>}
      {open === 'more' && <div className="quick-menu-list">{row('Recortar ramo','cut','Ctrl+X',isRoot)}{row('Copiar ramo','copy','Ctrl+C')}{row('Colar ramo','paste','Ctrl+V')}{row('Copiar estilo','copy-style','Ctrl+Shift+C')}{row('Colar estilo','paste-style','Ctrl+Alt+V')}{row('Definir como estilo padrão','set-default-style')}{row('Copiar link deste nó','copy-link')}{row('Desvincular nó','detach',undefined,isRoot)}<div className="quick-separator"/><label className="quick-check"><input type="checkbox" checked={alwaysToolbar} onChange={e => onToggleAlwaysToolbar?.(e.target.checked)}/> Sempre mostrar barra do nó</label><div className="quick-separator"/>{row('Duplicar ramo','duplicate','Ctrl+D',isRoot)}{row('Excluir ramo','delete','Delete',isRoot)}</div>}
    </div>}
  </div>, host);
}
