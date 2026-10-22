'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { ArrowDownToLine, ChevronDown, ChevronLeft, Cloud, Copy, FolderOpen, Grid3X3, LayoutTemplate, Menu, Moon, Plus, Redo2, Search, Share2, Sparkles, Sun, Trash2, Undo2, WandSparkles, X, ZoomIn, ZoomOut, Maximize, Check, LoaderCircle, AlertCircle, PanelRightOpen, ArrowRight, LogOut } from 'lucide-react';
import MapCanvas from './MapCanvas';
import NodeInspector from './NodeInspector';
import RelationshipInspector from './RelationshipInspector';
import type { NodeAction } from './NodeQuickToolbar';
import { autoLayout, layoutBranch, layoutMap, createMap, createTemplate, descendants, toMarkdown, uid, type TemplateKey } from '../lib/maps';
import { layoutOptions } from './LayoutPicker';
import { importFontFile, loadImportedFonts, type ImportedFont } from '../lib/fonts';
import { downloadDriveFile, pickDriveFile, preloadDrive, saveMapToDrive } from '../lib/google-drive';
import { pickNodeStyle } from '../lib/node-style';
import type { MindMap, MindNode } from '../types';

type Props = { userName: string; signOutPath: string };
type Status = 'loading' | 'saved' | 'saving' | 'error';
function download(name: string, data: Blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(data); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
function safeName(text: string) { return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'mapa'; }
async function imageData(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 8 * 1024 * 1024) throw new Error('Use PNG, JPG, WebP ou GIF de até 8 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    const scale = Math.min(1, 1000 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d'); if (!context) throw new Error('Não foi possível processar a imagem.');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/jpeg', 0.78); if (data.length > 1_600_000) throw new Error('A imagem ficou grande demais para este mapa.');
    return data;
  } finally { URL.revokeObjectURL(url); }
}
const localMode = process.env.NEXT_PUBLIC_STORAGE_MODE !== 'cloud';
const LOCAL_KEY = 'mindora:maps:v1';
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  if (localMode) {
    let maps = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]') as MindMap[];
    // Migrate maps created under the previous default once; later explicit layout choices persist.
    if (!localStorage.getItem('mindora:right-layout-default:v1')) {
      maps = maps.map(map => map.layout === 'balanced' ? { ...map, layout: 'right', nodes: autoLayout(map.nodes, 'right', map.spacing) } : map);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(maps));
      localStorage.setItem('mindora:right-layout-default:v1', '1');
    }
    const method = options?.method || 'GET'; const id = url.split('/').at(-1);
    if (url === '/api/maps' && method === 'GET') return { maps } as T;
    if (url === '/api/maps' && method === 'POST') { const map = JSON.parse(options?.body as string) as MindMap; localStorage.setItem(LOCAL_KEY, JSON.stringify([map, ...maps])); return { map } as T; }
    if (method === 'PUT') { const map = JSON.parse(options?.body as string) as MindMap; localStorage.setItem(LOCAL_KEY, JSON.stringify(maps.map(m => m.id === id ? map : m))); return { map } as T; }
    if (method === 'DELETE') { localStorage.setItem(LOCAL_KEY, JSON.stringify(maps.filter(m => m.id !== id))); return { ok: true } as T; }
    if (method === 'POST' && id) { const token = maps.find(m => m.id === id)?.shareToken || crypto.randomUUID(); localStorage.setItem(LOCAL_KEY, JSON.stringify(maps.map(m => m.id === id ? { ...m, shareToken: token } : m))); return { shareToken: token } as T; }
    throw new Error('Operação local não reconhecida');
  }
  const r = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } });
  const body = await r.json() as { error?: string }; if (!r.ok) throw new Error(body.error || 'Falha na conexão'); return body as T;
}

export default function Editor({ userName, signOutPath }: Props) {
  const [maps, setMaps] = useState<MindMap[]>([]); const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null); const [status, setStatus] = useState<Status>('loading');
  const [dark, setDark] = useState(false); const [grid, setGrid] = useState(true); const [sidebar, setSidebar] = useState(true); const [panel, setPanel] = useState(true);
  const [alwaysToolbar, setAlwaysToolbar] = useState(true);
  const [search, setSearch] = useState(''); const [exportOpen, setExportOpen] = useState(false); const [driveOpen, setDriveOpen] = useState(false); const [shareOpen, setShareOpen] = useState(false); const [linkCopied, setLinkCopied] = useState(false);
  const [history, setHistory] = useState<{ past: MindMap[]; future: MindMap[] }>({ past: [], future: [] });
  const [fonts, setFonts] = useState<ImportedFont[]>([]);
  const [relationSourceId, setRelationSourceId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [inspectorFocus, setInspectorFocus] = useState<{ field: string; key: number } | null>(null);
  const branchClipboard = useRef<{ nodes: MindNode[]; rootId: string } | null>(null);
  const styleClipboard = useRef<Partial<MindNode> | null>(null);
  const flowRef = useRef<{ zoomIn: () => void; zoomOut: () => void; fit: () => void } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const active = maps.find(m => m.id === activeId) ?? null;
  const selected = active?.nodes.find(n => n.id === selectedId) ?? null;
  const selectedRelationship = active?.relationships?.find(link => link.id === selectedEdgeId) ?? null;
  useEffect(() => {
    const load = async () => {
      try {
        const result = await api<{ maps: MindMap[] }>('/api/maps');
        const maps = [...result.maps];
        let migrationFailed = false;
        if (!localMode) {
          // Import existing localhost maps once by ID; keep the browser copy as a backup.
          let localMaps: MindMap[] = [];
          try { localMaps = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]') as MindMap[]; } catch { /* Ignore malformed legacy storage. */ }
          for (const local of localMaps) {
            if (maps.some(map => map.id === local.id)) continue;
            try {
              const { map } = await api<{ map: MindMap }>('/api/maps', { method: 'POST', body: JSON.stringify(local) });
              maps.push(map);
            } catch { migrationFailed = true; }
          }
        }
        const params = new URLSearchParams(window.location.search);
        const target = maps.find(map => map.id === params.get('map'));
        setMaps(maps); setActiveId(target?.id ?? maps[0]?.id ?? null);
        if (target?.nodes.some(node => node.id === params.get('node'))) setSelectedId(params.get('node'));
        setAlwaysToolbar(localStorage.getItem('mindora:always-toolbar') !== '0'); setStatus(migrationFailed ? 'error' : 'saved');
      } catch { setStatus('error'); }
    };
    void load();
  }, []);
  const toggleAlwaysToolbar = (value: boolean) => { setAlwaysToolbar(value); localStorage.setItem('mindora:always-toolbar', value ? '1' : '0'); };
  useEffect(() => { loadImportedFonts().then(setFonts).catch(() => {}); }, []);
  useEffect(() => { preloadDrive(); }, []);
  const save = useCallback((map: MindMap) => { const prior = saveTimers.current.get(map.id); if (prior) clearTimeout(prior); setStatus('saving'); saveTimers.current.set(map.id, setTimeout(async () => { try { const result = await api<{ map: MindMap }>(`/api/maps/${map.id}`, { method: 'PUT', body: JSON.stringify(map) }); setMaps(current => current.map(m => m.id === map.id && m.updatedAt === map.updatedAt ? { ...m, updatedAt: result.map.updatedAt } : m)); setStatus('saved'); } catch { setStatus('error'); } saveTimers.current.delete(map.id); }, 650)); }, []);
  const commit = useCallback((next: MindMap, record = true) => { const previous = maps.find(m => m.id === next.id); if (!previous) return; if (record) setHistory(h => ({ past: [...h.past, previous].slice(-50), future: [] })); const fresh = { ...next, updatedAt: Date.now() }; setMaps(current => current.map(m => m.id === next.id ? fresh : m)); save(fresh); }, [maps, save]);
  const switchMap = (id: string) => { setActiveId(id); setSelectedId(null); setSelectedEdgeId(null); setHistory({ past: [], future: [] }); setShareOpen(false); };
  const addMap = async (template?: TemplateKey) => { const map = template ? createTemplate(template) : createMap(); try { await api('/api/maps', { method: 'POST', body: JSON.stringify(map) }); setMaps(current => [map, ...current]); switchMap(map.id); setStatus('saved'); } catch { setStatus('error'); } };
  const duplicateMap = async (map: MindMap) => { const copy = { ...map, id: uid(), title: `${map.title} (cópia)`, shareToken: null, updatedAt: Date.now(), nodes: map.nodes.map(n => ({ ...n })) }; try { await api('/api/maps', { method: 'POST', body: JSON.stringify(copy) }); setMaps(current => [copy, ...current]); switchMap(copy.id); } catch { setStatus('error'); } };
  const importJson = async (file?: File) => { if (!file) return; try { const raw = JSON.parse(await file.text()) as MindMap; if (!raw || typeof raw.title !== 'string' || !Array.isArray(raw.nodes) || !raw.nodes.every(n => n && typeof n.id === 'string' && typeof n.text === 'string')) throw new Error('Arquivo inválido'); const map: MindMap = { ...raw, id: uid(), title: raw.title.slice(0, 160), layout: layoutOptions.some(option => option.mode === raw.layout) ? raw.layout : 'right', shareToken: null, updatedAt: Date.now() }; await api('/api/maps', { method: 'POST', body: JSON.stringify(map) }); setMaps(current => [map, ...current]); switchMap(map.id); } catch { window.alert('Não foi possível importar este mapa JSON.'); } if (importRef.current) importRef.current.value = ''; };
  const importFromDrive = async () => { setDriveOpen(false); try { const doc = await pickDriveFile(); if (!doc) return; const blob = await downloadDriveFile(doc.id); await importJson(new File([blob], doc.name || 'mapa.json', { type: blob.type })); } catch (error) { window.alert(error instanceof Error ? error.message : 'Falha ao abrir o Google Drive.'); } };
  const backupToDrive = async () => { setDriveOpen(false); if (!active) return; try { await saveMapToDrive(active); window.alert('Cópia do mapa salva no Google Drive.'); } catch (error) { window.alert(error instanceof Error ? error.message : 'Falha ao salvar no Google Drive.'); } };
  const deleteMap = async (map: MindMap) => { if (!window.confirm(`Excluir “${map.title}”? Esta ação não pode ser desfeita.`)) return; try { await api(`/api/maps/${map.id}`, { method: 'DELETE' }); setMaps(current => current.filter(m => m.id !== map.id)); if (activeId === map.id) switchMap(maps.find(m => m.id !== map.id)?.id ?? ''); } catch { setStatus('error'); } };
  const addChild = useCallback((id: string) => { if (!active) return; const parent = active.nodes.find(n => n.id === id); if (!parent) return; const siblings = active.nodes.filter(n => n.parentId === id); const side = active.layout === 'right' ? 'right' : parent.parentId ? (parent.x < 0 ? 'left' : 'right') : (siblings.length % 2 ? 'left' : 'right'); const reference = active.levelReferences?.find(entry => entry.parentId === id); const line = active.levelConnections?.find(entry => entry.parentId === id); const child: MindNode = { ...active.defaultNodeStyle, ...reference?.style, connectionStyle: line?.style, id: uid(), parentId: id, text: 'Nova ideia', x: parent.x + (side === 'left' ? -260 : 260), y: parent.y + siblings.length * 100, side }; const nodes = layoutMap([...active.nodes, child], active.layout, active.spacing); commit({ ...active, nodes }); setSelectedId(child.id); }, [active, commit]);
  const editNode = useCallback((id: string, text: string) => { if (active) commit({ ...active, nodes: active.nodes.map(n => n.id === id ? { ...n, text } : n) }); }, [active, commit]);
  const patchNode = (patch: Partial<MindNode>) => { if (active && selected) commit({ ...active, nodes: active.nodes.map(n => n.id === selected.id ? { ...n, ...patch } : n) }); };
  const patchNodeById = (id: string, patch: Partial<MindNode>) => { if (active) commit({ ...active, nodes: active.nodes.map(n => n.id === id ? { ...n, ...patch } : n) }); };
  const applyReference = (mode: 'size' | 'format' | 'both') => {
    if (!active || !selected?.parentId) return;
    const style = pickNodeStyle(selected, mode);
    const levelReferences = [...(active.levelReferences || []).filter(entry => entry.parentId !== selected.parentId), { parentId: selected.parentId, mode, style }];
    commit({ ...active, levelReferences, nodes: active.nodes.map(node => node.parentId === selected.parentId && node.id !== selected.id ? { ...node, ...style } : node) });
  };
  const saveStylePreset = () => {
    if (!active || !selected) return;
    const name = window.prompt('Nome do modelo de formatação:')?.trim().slice(0, 50);
    if (!name) return;
    commit({ ...active, stylePresets: [...(active.stylePresets || []), { id: uid(), name, style: pickNodeStyle(selected) }] });
  };
  const applyStylePreset = (id: string) => { const preset = active?.stylePresets?.find(item => item.id === id); if (preset) patchNode(preset.style); };
  const setDefaultStyle = () => { if (active && selected) commit({ ...active, defaultNodeStyle: pickNodeStyle(selected) }); };
  const applyLevelConnection = () => { if (active && selected?.parentId) { const style = { ...selected.connectionStyle }; commit({ ...active, levelConnections: [...(active.levelConnections || []).filter(entry => entry.parentId !== selected.parentId), { parentId: selected.parentId, style }], nodes: active.nodes.map(node => node.parentId === selected.parentId ? { ...node, connectionStyle: style } : node) }); } };
  const openInspector = (field: string) => { setPanel(true); setInspectorFocus({ field, key: Date.now() }); };
  const removeNodeById = (id: string) => { if (!active) return; const node = active.nodes.find(n => n.id === id); if (!node || (!node.parentId && !node.floating)) return; const ids = descendants(active.nodes, id); commit({ ...active, nodes: active.nodes.filter(n => !ids.has(n.id)), relationships: active.relationships?.filter(link => !ids.has(link.source) && !ids.has(link.target)) }); setSelectedId(null); };
  const duplicateBranch = (id: string) => {
    if (!active) return; const branchIds = descendants(active.nodes, id); const branch = active.nodes.filter(n => branchIds.has(n.id)); const original = active.nodes.find(n => n.id === id); if (!original?.parentId) return;
    const ids = new Map(branch.map(n => [n.id, uid()]));
    const copies = branch.map(n => ({ ...n, id: ids.get(n.id)!, parentId: n.id === id ? original.parentId : ids.get(n.parentId!)!, y: n.y + 96, comments: n.comments?.map(c => ({ ...c, id: uid() })) }));
    const nodes = [...active.nodes, ...copies]; commit({ ...active, nodes: layoutMap(nodes, active.layout, active.spacing) }); setSelectedId(ids.get(id)!);
  };
  const toggleNode = useCallback((id: string) => { if (active) commit({ ...active, nodes: active.nodes.map(n => n.id === id ? { ...n, collapsed: !n.collapsed } : n) }); }, [active, commit]);
  const quickAction = (id: string, action: NodeAction) => {
    if (!active) return; const node = active.nodes.find(n => n.id === id); if (!node) return; setSelectedId(id);
    if (action === 'child') { addChild(id); return; }
    if (action === 'sibling') { if (node.parentId) addChild(node.parentId); return; }
    if (action === 'same-style' && node.parentId) { const copy = { ...node, id: uid(), text: 'Nova ideia', richText: undefined, x: node.x, y: node.y + 100, comments: [], note: '', image: undefined }; const nodes = [...active.nodes, copy]; commit({ ...active, nodes: layoutMap(nodes, active.layout, active.spacing) }); setSelectedId(copy.id); return; }
    if (action === 'relationship') { setRelationSourceId(id); return; }
    if (action === 'boundary') { patchNodeById(id, { boundary: !node.boundary }); return; }
    if (action === 'summary') { const summary = window.prompt('Resumo deste ramo:', node.summary || ''); if (summary !== null) patchNodeById(id, { summary }); return; }
    if (action === 'floating') { const floating: MindNode = { ...active.defaultNodeStyle, id: uid(), parentId: null, floating: true, text: 'Ideia flutuante', x: node.x + 250, y: node.y + 130 }; commit({ ...active, layout: 'free', nodes: [...active.nodes, floating] }); setSelectedId(floating.id); return; }
    if (action === 'label' || action === 'equation') { const value = window.prompt(action === 'label' ? 'Rótulo do nó:' : 'Equação matemática:', action === 'label' ? node.label || '' : node.equation || ''); if (value !== null) patchNodeById(id, action === 'label' ? { label: value } : { equation: value }); return; }
    if (['text', 'style', 'notes', 'comments', 'icon', 'link'].includes(action)) { openInspector(action); return; }
    if (action === 'task') { if (!node.task) commit({ ...active, nodes: active.nodes.map(n => n.id === id ? { ...n, task: { done: false } } : n) }); openInspector('task'); return; }
    if (action === 'collapse') { toggleNode(id); return; }
    if (action.startsWith('spacing-')) { const spacing = action === 'spacing-compact' ? { x: 210, y: 82 } : action === 'spacing-wide' ? { x: 320, y: 150 } : { x: 260, y: 112 }; commit({ ...active, spacing, nodes: layoutMap(active.nodes, active.layout, spacing) }); return; }
    if (layoutOptions.some(option => option.mode === action)) {
      const mode = action as MindMap['layout'];
      if (!node.parentId && !node.floating) commit({ ...active, layout: mode, nodes: layoutMap(active.nodes, mode, active.spacing) });
      else { const nodes = active.nodes.map(item => item.id === id ? { ...item, branchLayout: mode } : item); commit({ ...active, nodes: layoutBranch(nodes, id, mode, active.spacing) }); }
      return;
    }
    if (action === 'duplicate') { duplicateBranch(id); return; }
    if (action === 'delete') { removeNodeById(id); return; }
    if (action === 'detach' && node.parentId) { commit({ ...active, layout: 'free', nodes: active.nodes.map(n => n.id === id ? { ...n, parentId: null, floating: true } : n) }); return; }
    if (action === 'copy' || action === 'cut') { const ids = descendants(active.nodes, id); branchClipboard.current = { rootId: id, nodes: active.nodes.filter(n => ids.has(n.id)).map(n => ({ ...n })) }; if (action === 'cut') removeNodeById(id); return; }
    if (action === 'paste' && branchClipboard.current) { const clipboard = branchClipboard.current; const origin = clipboard.nodes.find(n => n.id === clipboard.rootId)!; const ids = new Map(clipboard.nodes.map(n => [n.id, uid()])); const copies = clipboard.nodes.map(n => ({ ...n, id: ids.get(n.id)!, parentId: n.id === clipboard.rootId ? id : ids.get(n.parentId!)!, x: node.x + (n.x - origin.x) + 260, y: node.y + (n.y - origin.y), comments: n.comments?.map(c => ({ ...c, id: uid() })) })); const nodes = [...active.nodes, ...copies]; commit({ ...active, nodes: layoutMap(nodes, active.layout, active.spacing) }); setSelectedId(ids.get(clipboard.rootId)!); return; }
    if (action === 'copy-style') { styleClipboard.current = pickNodeStyle(node); return; }
    if (action === 'paste-style') { if (styleClipboard.current) patchNodeById(id, styleClipboard.current); return; }
    if (action === 'set-default-style') { commit({ ...active, defaultNodeStyle: pickNodeStyle(node) }); return; }
    if (action === 'copy-link') { const url = new URL(window.location.href); url.searchParams.set('map', active.id); url.searchParams.set('node', id); navigator.clipboard.writeText(url.href).catch(() => {}); return; }
    if (action === 'copy-text') { navigator.clipboard.writeText(node.text).catch(() => {}); return; }
    if (action === 'explain') { patchNodeById(id, { note: [node.note, `## ${node.text}\n\nDescrição, contexto e próximos passos:`].filter(Boolean).join('\n\n') }); openInspector('notes'); return; }
    const suggestions: Record<string, string[]> = {
      ideas: ['Objetivos', 'Possibilidades', 'Próximos passos'],
      questions: [`O que é ${node.text}?`, 'Por que isso importa?', 'Como implementar?'],
      'pros-cons': ['Prós', 'Contras'],
      swot: ['Forças', 'Fraquezas', 'Oportunidades', 'Ameaças'],
      topics: ['Contexto', 'Detalhes', 'Exemplos', 'Ações'],
    };
    const labels = suggestions[action]; if (!labels) return;
    const reference = active.levelReferences?.find(entry => entry.parentId === id);
    const line = active.levelConnections?.find(entry => entry.parentId === id);
    const children: MindNode[] = labels.map((text, index) => ({ ...active.defaultNodeStyle, ...reference?.style, connectionStyle: line?.style, id: uid(), parentId: id, text, x: node.x + 260, y: node.y + index * 100, side: 'right' }));
    const nodes = [...active.nodes, ...children]; commit({ ...active, nodes: layoutMap(nodes, active.layout, active.spacing) }); setSelectedId(children[0].id);
  };
  const quickActionRef = useRef(quickAction);
  useEffect(() => { quickActionRef.current = quickAction; });
  const quickImage = async (id: string, file: File) => { try { const image = await imageData(file); if (!active) return; commit({ ...active, nodes: active.nodes.map(n => n.id === id ? { ...n, image } : n) }); setSelectedId(id); } catch (error) { window.alert(error instanceof Error ? error.message : 'Não foi possível carregar a imagem.'); } };
  const quickDrivePick = async (id: string, kind: 'image' | 'link') => { try { const doc = await pickDriveFile(); if (!doc) return; if (kind === 'link') patchNodeById(id, { url: doc.url || `https://drive.google.com/file/d/${doc.id}/view` }); else { const blob = await downloadDriveFile(doc.id); if (!blob.type.startsWith('image/')) throw new Error('Selecione um arquivo de imagem no Google Drive.'); await quickImage(id, new File([blob], doc.name || 'imagem', { type: blob.type })); } } catch (error) { window.alert(error instanceof Error ? error.message : 'Falha ao abrir o Google Drive.'); } };
  const importFont = async (file: File) => { const font = await importFontFile(file); setFonts(current => [...current.filter(item => item.id !== font.id), font]); patchNode({ fontFamily: font.family }); };
  const removeNode = useCallback(() => { if (!active || !selected || (!selected.parentId && !selected.floating)) return; const ids = descendants(active.nodes, selected.id); commit({ ...active, nodes: active.nodes.filter(n => !ids.has(n.id)), relationships: active.relationships?.filter(link => !ids.has(link.source) && !ids.has(link.target)) }); setSelectedId(null); }, [active, selected, commit]);
  const undo = useCallback(() => { if (!active || !history.past.length) return; const previous = history.past.at(-1)!; setHistory(h => ({ past: h.past.slice(0, -1), future: [active, ...h.future] })); commit(previous, false); }, [active, history, commit]);
  const redo = useCallback(() => { if (!active || !history.future.length) return; const next = history.future[0]; setHistory(h => ({ past: [...h.past, active], future: h.future.slice(1) })); commit(next, false); }, [active, history, commit]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return;
      const key = event.key.toLowerCase();
      const command = event.ctrlKey || event.metaKey;
      if (command && key === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
      else if (command && key === 'y') { event.preventDefault(); redo(); }
      else if (selectedId && command && key === 'c') { event.preventDefault(); quickActionRef.current(selectedId, event.shiftKey ? 'copy-style' : 'copy'); }
      else if (selectedId && command && key === 'x') { event.preventDefault(); quickActionRef.current(selectedId, 'cut'); }
      else if (selectedId && command && key === 'v') { event.preventDefault(); quickActionRef.current(selectedId, event.altKey ? 'paste-style' : 'paste'); }
      else if (selectedId && command && key === 'd') { event.preventDefault(); quickActionRef.current(selectedId, 'duplicate'); }
      else if (selectedId && command && key === 'l') { event.preventDefault(); quickActionRef.current(selectedId, 'relationship'); }
      else if (selectedId && event.altKey && key === 'enter') { event.preventDefault(); quickActionRef.current(selectedId, 'same-style'); }
      else if (event.key === 'Tab' && selectedId) { event.preventDefault(); addChild(selectedId); }
      else if (event.key === 'Enter' && selected?.parentId) { event.preventDefault(); addChild(selected.parentId); }
      else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) { event.preventDefault(); removeNode(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, addChild, selectedId, selected, removeNode]);
  const exportFile = async (kind: 'png' | 'pdf' | 'md' | 'json') => { if (!active) return; const name = safeName(active.title); setExportOpen(false); if (kind === 'md') download(`${name}.md`, new Blob([toMarkdown(active)], { type: 'text/markdown;charset=utf-8' })); else if (kind === 'json') download(`${name}.json`, new Blob([JSON.stringify(active, null, 2)], { type: 'application/json' })); else { flowRef.current?.fit(); await new Promise(r => setTimeout(r, 500)); const surface = document.querySelector('.canvas-surface .react-flow') as HTMLElement | null; if (!surface) return; const editorChrome = ['react-flow__minimap', 'react-flow__controls', 'node-quick-toolbar', 'node-add', 'node-collapse', 'node-handle']; const image = await toPng(surface, { backgroundColor: dark ? '#161625' : '#f8f9fd', pixelRatio: 2, filter: node => !(node instanceof HTMLElement && editorChrome.some(name => node.classList.contains(name))) }); if (kind === 'png') { const r = await fetch(image); download(`${name}.png`, await r.blob()); } else { const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [surface.clientWidth, surface.clientHeight] }); pdf.addImage(image, 'PNG', 0, 0, surface.clientWidth, surface.clientHeight); pdf.save(`${name}.pdf`); } } };
  const share = async () => { if (!active) return; if (localMode) { setShareOpen(true); return; } try { const result = await api<{ shareToken: string }>(`/api/maps/${active.id}`, { method: 'POST' }); setMaps(current => current.map(m => m.id === active.id ? { ...m, shareToken: result.shareToken } : m)); setShareOpen(true); } catch { setStatus('error'); } };
  const shareUrl = localMode && active ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/local#${encodeURIComponent(JSON.stringify(active))}` : active?.shareToken ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${active.shareToken}` : '';
  const filtered = maps.filter(m => m.title.toLowerCase().includes(search.toLowerCase()));
  const patchRelationship = (patch: Partial<NonNullable<MindMap['relationships']>[number]>) => { if (active && selectedEdgeId) commit({ ...active, relationships: active.relationships?.map(link => link.id === selectedEdgeId ? { ...link, ...patch } : link) }); };
  const deleteRelationship = () => { if (active && selectedEdgeId) { commit({ ...active, relationships: active.relationships?.filter(link => link.id !== selectedEdgeId) }); setSelectedEdgeId(null); } };
  const selectCanvasNode = (id: string | null) => {
    setSelectedEdgeId(null);
    if (relationSourceId && active && id && id !== relationSourceId) { commit({ ...active, relationships: [...(active.relationships || []), { id: uid(), source: relationSourceId, target: id }] }); setRelationSourceId(null); setSelectedId(id); return; }
    if (!id) setRelationSourceId(null); setSelectedId(id); if (id) setPanel(true);
  };
  const selectCanvasEdge = (id: string) => { setSelectedEdgeId(id); setSelectedId(null); setPanel(true); };
  return <div className={`app-shell ${dark ? 'dark' : ''}`}>
    <aside className={`sidebar ${sidebar ? '' : 'sidebar-closed'}`}><div className="brand"><span className="brand-symbol"><Sparkles size={19}/></span><span>mindora<span className="brand-dot">.</span></span><button className="icon-button close-sidebar" onClick={() => setSidebar(false)} aria-label="Fechar menu"><ChevronLeft size={18}/></button></div>
      <button className="new-map" onClick={() => addMap()}><Plus size={18}/> Novo mapa <span>+</span></button>
      <div className="sidebar-section"><div className="section-caption"><span>ESPAÇO DE TRABALHO</span><span>{maps.length}</span></div><label className="search"><Search size={15}/><input placeholder="Buscar mapas..." value={search} onChange={e => setSearch(e.target.value)}/></label><div className="map-list">{filtered.map(m => <div key={m.id} className={`map-row ${activeId === m.id ? 'active' : ''}`}><button className="map-row-main" onClick={() => switchMap(m.id)}><span className="map-icon"><FolderOpen size={16}/></span><span className="map-name">{m.title}</span></button><button className="row-more" title="Duplicar mapa" onClick={() => duplicateMap(m)}><Copy size={14}/></button><button className="row-more" title="Excluir mapa" onClick={() => deleteMap(m)}><Trash2 size={14}/></button></div>)}{!filtered.length && <p className="empty-list">Nenhum mapa encontrado</p>}</div></div>
      <div className="sidebar-section templates"><div className="section-caption"><span>TEMPLATES</span><LayoutTemplate size={15}/></div><button onClick={() => addMap('projeto')}><span className="template-icon lavender">◈</span>Planejamento de projeto<ArrowRight size={14}/></button><button onClick={() => addMap('brainstorming')}><span className="template-icon yellow">✳</span>Brainstorming<ArrowRight size={14}/></button><button onClick={() => addMap('swot')}><span className="template-icon mint">▦</span>Análise SWOT<ArrowRight size={14}/></button></div>
      <div className="sidebar-bottom"><div className="tip-card"><span>✦ DICA RÁPIDA</span><p>Selecione uma ideia e pressione <kbd>Tab</kbd> para criar um subnó.</p></div><div className="profile"><span className="avatar">{userName.charAt(0).toUpperCase()}</span><span className="profile-name">{userName}</span>{!localMode && <a href={signOutPath} target="_top" title="Sair"><LogOut size={16}/></a>}</div></div>
    </aside>
    <main className="main-area"><header className="toolbar"><div className="toolbar-left">{!sidebar && <button className="icon-button" onClick={() => setSidebar(true)} aria-label="Abrir menu"><Menu size={19}/></button>}<span className="crumb">Meus mapas</span><span className="crumb-sep">/</span>{active ? <input className="map-title" aria-label="Nome do mapa" value={active.title} onChange={e => commit({ ...active, title: e.target.value })} /> : <span className="map-title placeholder">Bem-vindo</span>}<span className={`save-status ${status}`}>{status === 'saving' ? <LoaderCircle size={13} className="spin"/> : status === 'error' ? <AlertCircle size={13}/> : <Check size={13}/>} {status === 'saving' ? 'Salvando' : status === 'error' ? 'Falha ao salvar' : status === 'loading' ? 'Carregando' : (localMode ? 'Salvo neste navegador' : 'Salvo na nuvem')}</span></div><div className="toolbar-right"><button className="icon-button" title="Desfazer" disabled={!history.past.length} onClick={undo}><Undo2 size={18}/></button><button className="icon-button" title="Refazer" disabled={!history.future.length} onClick={redo}><Redo2 size={18}/></button><span className="toolbar-divider"/><button className="icon-button" title={dark ? 'Tema claro' : 'Tema escuro'} onClick={() => setDark(!dark)}>{dark ? <Sun size={18}/> : <Moon size={18}/>}</button><div className="dropdown-wrap"><input ref={importRef} type="file" accept="application/json,.json" hidden onChange={e => importJson(e.target.files?.[0])}/><button className="outline-button" disabled={!active} onClick={() => setExportOpen(!exportOpen)}><ArrowDownToLine size={16}/> Exportar <ChevronDown size={14}/></button>{exportOpen && <div className="dropdown-menu"><button onClick={() => exportFile('png')}>Imagem PNG</button><button onClick={() => exportFile('pdf')}>Documento PDF</button><button onClick={() => exportFile('md')}>Markdown</button><button onClick={() => exportFile('json')}>Arquivo JSON</button><button onClick={() => { setExportOpen(false); importRef.current?.click(); }}>Importar JSON</button></div>}</div><div className="dropdown-wrap"><button className="outline-button drive-button" onClick={() => setDriveOpen(!driveOpen)} title="Google Drive"><Cloud size={16}/> Drive <ChevronDown size={14}/></button>{driveOpen && <div className="dropdown-menu"><button onClick={importFromDrive}>Abrir mapa do Google Drive</button><button disabled={!active} onClick={backupToDrive}>Salvar cópia no Google Drive</button></div>}</div><button className="share-button" disabled={!active} onClick={share}><Share2 size={16}/> Compartilhar</button></div></header>
      {active ? <div className="workspace"><div className="canvas-wrap"><div className="canvas-top"><div className="canvas-badge"><span className="pulse-dot"/> {relationSourceId ? 'Clique em outro nó para criar a relação' : 'Editor de mapa mental'}</div><div className="canvas-actions"><button className={grid ? 'active' : ''} onClick={() => setGrid(!grid)} title="Alternar grade"><Grid3X3 size={17}/></button><span/><button onClick={() => flowRef.current?.zoomOut()} title="Diminuir zoom"><ZoomOut size={17}/></button><button onClick={() => flowRef.current?.zoomIn()} title="Aumentar zoom"><ZoomIn size={17}/></button><button onClick={() => flowRef.current?.fit()} title="Ajustar à tela"><Maximize size={16}/></button></div></div><MapCanvas map={active} selectedId={selectedId} onSelect={selectCanvasNode} onSelectEdge={selectCanvasEdge} onChange={commit} onAdd={addChild} onEdit={editNode} onToggle={toggleNode} onAction={quickAction} onPatch={patchNodeById} onImage={quickImage} onDrivePick={quickDrivePick} alwaysToolbar={alwaysToolbar} onToggleAlwaysToolbar={toggleAlwaysToolbar} grid={grid} flowRef={flowRef}/><div className="canvas-bottom"><span>{active.nodes.length} ideias <span className="bullet">·</span> {active.nodes.filter(n => n.parentId).length} conexões</span><div className="layout-control"><button onClick={() => commit({ ...active, layout: 'balanced', nodes: layoutMap(active.nodes, 'balanced', active.spacing) })} className={active.layout === 'balanced' ? 'active' : ''}>Equilibrado</button><button onClick={() => commit({ ...active, layout: 'right', nodes: layoutMap(active.nodes, 'right', active.spacing) })} className={active.layout === 'right' ? 'active' : ''}>À direita</button><button onClick={() => commit({ ...active, layout: 'free' })} className={active.layout === 'free' ? 'active' : ''}>Livre</button></div><button className="organize" onClick={() => commit({ ...active, layout: active.layout === 'free' ? 'right' : active.layout, nodes: layoutMap(active.nodes, active.layout === 'free' ? 'right' : active.layout, active.spacing) })}><WandSparkles size={15}/> Organizar</button></div></div>
        {selectedRelationship && panel && <RelationshipInspector relation={selectedRelationship} onPatch={patchRelationship} onDelete={deleteRelationship} onClose={() => setPanel(false)}/> }
        {selected && panel && <NodeInspector node={selected} fonts={fonts} presets={active.stylePresets} onReference={applyReference} onSavePreset={saveStylePreset} onApplyPreset={applyStylePreset} onSetDefault={setDefaultStyle} onApplyLevelConnection={applyLevelConnection} focus={inspectorFocus} onPatch={patchNode} onAdd={() => addChild(selected.id)} onDelete={removeNode} onClose={() => setPanel(false)} onImportFont={importFont} onImage={file => quickImage(selected.id, file)}/> }
        {selected && !panel && <button className="reopen-panel" onClick={() => setPanel(true)} title="Abrir propriedades"><PanelRightOpen size={18}/></button>}
      </div> : <div className="empty-workspace"><div className="empty-illustration"><span>✦</span><span>✧</span><span>✦</span></div><p className="eyebrow">SEU ESPAÇO CRIATIVO</p><h1>Ideias incríveis começam aqui.</h1><p>Transforme pensamentos soltos em conexões claras.<br/>Crie seu primeiro mapa ou comece com um template.</p><button className="share-button" onClick={() => addMap()}><Plus size={17}/> Criar meu primeiro mapa</button><button className="import-empty" onClick={() => importRef.current?.click()}>Importar mapa JSON</button></div>}
    </main>
    {shareOpen && active && <div className="modal-backdrop" onMouseDown={() => setShareOpen(false)}><div className="share-modal" onMouseDown={e => e.stopPropagation()}><button className="modal-close" onClick={() => setShareOpen(false)}><X size={19}/></button><h2>Compartilhe suas ideias</h2><p>{localMode ? 'Link de teste: contém uma cópia do mapa e só abre enquanto o servidor local estiver ligado.' : 'Quem tiver este link poderá visualizar o mapa, sem editar.'}</p><label className="field-label">LINK DE VISUALIZAÇÃO</label><div className="copy-field"><input readOnly value={shareUrl}/><button onClick={async () => { await navigator.clipboard.writeText(shareUrl); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }}>{linkCopied ? <Check size={16}/> : <Copy size={16}/>} {linkCopied ? 'Copiado' : 'Copiar'}</button></div></div></div>}
  </div>;
}



