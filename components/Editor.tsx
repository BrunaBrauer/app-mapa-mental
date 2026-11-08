'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { ArrowDownToLine, ArrowUpFromLine, ChevronDown, ChevronLeft, ChevronUp, Cloud, Copy, Grid3X3, Moon, Plus, Redo2, Share2, Sparkles, Sun, Undo2, WandSparkles, X, ZoomIn, ZoomOut, Maximize, Check, LoaderCircle, AlertCircle, ArrowRight, LogOut, House, ArrowLeftRight, ArrowUpDown } from 'lucide-react';
import MapCanvas from './MapCanvas';
import MapLinksDialog from './MapLinksDialog';
import MapAlternateView from './MapAlternateView';
import CompactEditorNav, { type EditorCommand } from './CompactEditorNav';
import RelationshipQuickToolbar from './RelationshipQuickToolbar';
import MultiNodeToolbar from './MultiNodeToolbar';
import MovementSettings from './MovementSettings';
import StyleCopyControls from './StyleCopyControls';
import WorkspaceNavigator from './WorkspaceNavigator';
import BoundaryToolbar from './BoundaryToolbar';
import type { NodeAction, NodePanel } from './NodeQuickToolbar';
import { layoutConflictCount, layoutMap, packTreeLayout, createMap, createTemplate, descendants, visibleNodes, toggleBranch, toMarkdown, uid, type TemplateKey } from '../lib/maps';
import { layoutOptions } from './LayoutPicker';
import { migrateMapLayouts } from '../lib/layout-migration';
import { importFontFile, loadImportedFonts, type ImportedFont } from '../lib/fonts';
import { downloadDriveFile, driveConfigured, pickDriveFile, preloadDrive, saveMapToDrive } from '../lib/google-drive';
import { parseMapFile, parseMindomoArchive } from '../lib/import-map';
import { copyNodeFormatting, pickNodeStyle, type FormattingCopyMode } from '../lib/node-style';
import { appendNodeNote } from '../lib/node-notes';
import { clipboardTextLines } from '../lib/paste-text';
import { resizeNodeGroup } from '../lib/group-resize';
import { mapLinksForNode, updateNodeMapLink } from '../lib/map-links';
import { selectionForExport } from '../lib/export-selection';
import { emptyWorkspace, folderTreeIds, type Workspace, type WorkspaceFile } from '../lib/workspace';
import { boundaryExists, boundaryTagIds, removeBoundary, setBoundaryTag, type BoundarySelection } from '../lib/boundaries';
import { downloadWorkspaceFile, removeWorkspaceFile, uploadWorkspaceFile } from '../lib/workspace-files';
import { pdfImagePlacement, pdfPageDimensions, pdfPaperSizes, type PdfOrientation, type PdfPaperSize } from '../lib/pdf-layout';
import { alignNodes, childMovementSettings, collectNodeDimensions, effectiveAvoidOverlap, reorganizeBranch, type AlignCommand, type NodeDimensions } from '../lib/movement';
import { applySiblingAlignments, applyVisualStandard, markStyleOverrides, patchVisualNodes, spreadSiblingOverlaps, styleNewNodes, visualScopeIds, type VisualOperation, type VisualScope, type VisualStyleGroup } from '../lib/visual-standardization';
import { defaultPreferences, normalizePreferences, type Preferences } from '../lib/preferences';
import type { LayoutMode, MindMap, MindNode, MovementMode } from '../types';

type Props = { userName: string; signOutPath: string; initialPreferences?: Preferences };
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
const LOCAL_WORKSPACE_KEY = 'nodum:workspace:v1';
const geometryFields: (keyof MindNode)[] = ['text', 'richText', 'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight', 'fontSize', 'fontFamily', 'lineSpacing', 'letterSpacing', 'wrapText', 'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderWidth', 'shape', 'icon', 'task', 'note', 'notes', 'comments', 'url', 'image', 'label', 'equation', 'mediaUrl'];
function changedNodeGeometry(before: MindMap, after: MindMap): boolean {
  if (before.nodes.length !== after.nodes.length) return false;
  const prior = new Map(before.nodes.map(node => [node.id, node]));
  return after.nodes.some(node => { const old = prior.get(node.id); return old && geometryFields.some(field => old[field] !== node[field]); });
}
function changedTreeStructure(before: MindMap, after: MindMap): boolean {
  if (before.nodes.length !== after.nodes.length) return true;
  const parents = new Map(before.nodes.map(node => [node.id, node.parentId]));
  return after.nodes.some(node => !parents.has(node.id) || parents.get(node.id) !== node.parentId);
}
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  if (localMode) {
    let maps = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]') as MindMap[];
    const migrated = maps.map(migrateMapLayouts);
    if (migrated.some((map, index) => map !== maps[index])) localStorage.setItem(LOCAL_KEY, JSON.stringify(migrated));
    maps = migrated;
    const method = options?.method || 'GET'; const id = url.split('/').at(-1);
    if (url === '/api/workspace' && method === 'GET') return { workspace: JSON.parse(localStorage.getItem(LOCAL_WORKSPACE_KEY) || 'null') || emptyWorkspace() } as T;
    if (url === '/api/workspace' && method === 'PUT') { const workspace = JSON.parse(options?.body as string) as Workspace; localStorage.setItem(LOCAL_WORKSPACE_KEY, JSON.stringify(workspace)); return { workspace } as T; }
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

export default function Editor({ userName, signOutPath, initialPreferences = defaultPreferences }: Props) {
  const [maps, setMaps] = useState<MindMap[]>([]); const [activeId, setActiveId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null); const [selectedIds, setSelectedIds] = useState<string[]>([]); const [status, setStatus] = useState<Status>('loading');
  const [linkNodeId, setLinkNodeId] = useState<string | null>(null);
  const [mapTrail, setMapTrail] = useState<{ mapId: string; nodeId: string }[]>([]);
  const groupResizeBase = useRef<NodeDimensions | null>(null);
  const [groupResizeBaseState, setGroupResizeBaseState] = useState<NodeDimensions | null>(null);
  const [groupResizeDelta, setGroupResizeDelta] = useState<{ dx: number; dy: number } | null>(null);
  const selectOne = useCallback((id: string | null) => { setSelectedId(id); setSelectedIds(id ? [id] : []); }, []);
  const [dark, setDark] = useState(initialPreferences.dark); const [grid, setGrid] = useState(initialPreferences.grid); const [sidebar, setSidebar] = useState(initialPreferences.sidebar);
  const [alwaysToolbar, setAlwaysToolbar] = useState(initialPreferences.alwaysToolbar);
  const [globalMovementMode, setGlobalMovementMode] = useState<MovementMode>(initialPreferences.movementMode);
  const [globalAvoidOverlap, setGlobalAvoidOverlap] = useState(initialPreferences.avoidOverlap);
  const [preferencesReady, setPreferencesReady] = useState(!localMode);
  const [preferenceError, setPreferenceError] = useState(false);
  const savedPreferences = useRef(JSON.stringify(initialPreferences));
  const preferenceQueue = useRef(Promise.resolve());
  useEffect(() => {
    if (!localMode) return;
    const frame = requestAnimationFrame(() => {
    try {
      const stored = normalizePreferences(JSON.parse(localStorage.getItem('nodum:preferences:v1') || '{}'));
      setDark(stored.dark); setGrid(stored.grid); setSidebar(stored.sidebar); setAlwaysToolbar(stored.alwaysToolbar); setGlobalMovementMode(stored.movementMode); setGlobalAvoidOverlap(stored.avoidOverlap);
      savedPreferences.current = JSON.stringify(stored);
    } catch { /* Keep defaults if browser storage is unavailable. */ }
    setPreferencesReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (!preferencesReady) return;
    const value = JSON.stringify({ dark, grid, sidebar, alwaysToolbar, movementMode: globalMovementMode, avoidOverlap: globalAvoidOverlap });
    if (value === savedPreferences.current) return;
    const timer = setTimeout(() => {
      savedPreferences.current = value;
      // Serialize writes so an older request cannot overwrite a newer preference.
      preferenceQueue.current = preferenceQueue.current.then(async () => {
        try {
          if (localMode) localStorage.setItem('nodum:preferences:v1', value);
          else {
            const response = await fetch('/api/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: value, keepalive: true });
            if (!response.ok) throw new Error('Preference save failed');
          }
          setPreferenceError(false);
        } catch { setPreferenceError(true); }
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [dark, grid, sidebar, alwaysToolbar, globalMovementMode, globalAvoidOverlap, preferencesReady]);
  const [search, setSearch] = useState(''); const [exportOpen, setExportOpen] = useState(false); const [driveOpen, setDriveOpen] = useState(false); const [shareOpen, setShareOpen] = useState(false); const [linkCopied, setLinkCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'map' | 'outline' | 'gantt'>('map');
  const [pdfScope, setPdfScope] = useState<'all' | 'selection'>('all');
  const [pdfOpen, setPdfOpen] = useState(false); const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfSize, setPdfSize] = useState<PdfPaperSize>('A4'); const [pdfOrientation, setPdfOrientation] = useState<PdfOrientation>('auto');
  const [pdfWidth, setPdfWidth] = useState(420); const [pdfHeight, setPdfHeight] = useState(297); const [pdfAspect, setPdfAspect] = useState(1.4);
  const [history, setHistory] = useState<{ past: MindMap[]; future: MindMap[] }>({ past: [], future: [] });
  const [fonts, setFonts] = useState<ImportedFont[]>([]);
  const [relationSourceId, setRelationSourceId] = useState<string | null>(null);
  const [driveBusy, setDriveBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiProposal, setAiProposal] = useState<{ nodeId: string; action: string; items: string[]; summary: string } | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedBoundary, setSelectedBoundary] = useState<BoundarySelection | null>(null);
  const [quickPanel, setQuickPanel] = useState<{ id: string; panel: NodePanel; key: number } | null>(null);
  const [temporaryBranchId, setTemporaryBranchId] = useState<string | null>(null);
  const [movementNotice, setMovementNotice] = useState('');
  useEffect(() => { if (!movementNotice) return; const timer = setTimeout(() => setMovementNotice(''), 4500); return () => clearTimeout(timer); }, [movementNotice]);
  const branchClipboard = useRef<{ nodes: MindNode[]; rootId: string } | null>(null);
  const styleClipboard = useRef<Partial<MindNode> | null>(null);
  const [styleCopied, setStyleCopied] = useState(false);
  const flowRef = useRef<{ zoomIn: () => void; zoomOut: () => void; fit: () => void } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pendingSaves = useRef(new Map<string, MindMap>());
  const runningSaves = useRef(new Map<string, Promise<void>>());
  const failedSaves = useRef(new Set<string>());
  const [saveStatus, setSaveStatus] = useState<Status>('saved');
  const displayedStatus = saveStatus === 'saved' ? status : saveStatus;
  const active = maps.find(m => m.id === activeId) ?? null;
  const linkNode = active?.nodes.find(node => node.id === linkNodeId) ?? null;
  const selected = active?.nodes.find(n => n.id === selectedId) ?? null;
  const selectedNodes = selectedIds.map(id => active?.nodes.find(node => node.id === id)).filter((node): node is MindNode => Boolean(node));
  const groupResizePreview = active && groupResizeDelta ? resizeNodeGroup(active, selectedIds, groupResizeDelta.dx, groupResizeDelta.dy, groupResizeBaseState || undefined) : null;
  const selectMany = useCallback((ids: string[]) => { const valid = [...new Set(ids)].filter(id => active?.nodes.some(node => node.id === id)); setSelectedIds(valid); setSelectedId(valid.at(-1) || null); setSelectedEdgeId(null); setSelectedBoundary(null); setQuickPanel(null); setGroupResizeDelta(null); }, [active]);
  const selectedRelationship = active?.relationships?.find(link => link.id === selectedEdgeId) ?? null;
  useEffect(() => {
    const load = async () => {
      try {
        const [result, organization] = await Promise.all([api<{ maps: MindMap[] }>('/api/maps'), api<{ workspace: Workspace }>('/api/workspace')]);
        setWorkspace(organization.workspace);
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
        // Repair legacy automatic maps only when their saved geometry has a visible conflict.
        for (let index = 0; index < maps.length; index++) {
          const map = maps[index];
          if (['free', 'network', 'treemap'].includes(map.layout)) continue;
          const before = layoutConflictCount(map.nodes, map.layout);
          if (!before) continue;
          let nodes = layoutMap(map.nodes, map.layout, map.spacing);
          const root = map.nodes.find(node => !node.parentId && !node.floating);
          const placedRoot = root && nodes.find(node => node.id === root.id);
          if (root && placedRoot && !map.nodes.some(node => node.positionLocked)) {
            const dx = root.x - placedRoot.x, dy = root.y - placedRoot.y;
            nodes = nodes.map(node => node.floating ? node : { ...node, x: node.x + dx, y: node.y + dy });
          }
          if (layoutConflictCount(nodes, map.layout) >= before) continue;
          const repaired = { ...map, nodes };
          maps[index] = repaired;
          try { await api(`/api/maps/${map.id}`, { method: 'PUT', body: JSON.stringify(repaired) }); }
          catch { migrationFailed = true; }
        }
        const params = new URLSearchParams(window.location.search);
        const target = maps.find(map => map.id === params.get('map'));
        setMaps(maps); setActiveId(target?.id ?? maps[0]?.id ?? null);
        if (target?.nodes.some(node => node.id === params.get('node'))) selectOne(params.get('node'));
        setStatus(migrationFailed ? 'error' : 'saved');
      } catch { setStatus('error'); }
    };
    void load();
  }, [selectOne]);
  const toggleAlwaysToolbar = (value: boolean) => setAlwaysToolbar(value);
  useEffect(() => { loadImportedFonts().then(setFonts).catch(() => {}); }, []);
  useEffect(() => { preloadDrive(); }, []);
  const flushSave = useCallback((id: string): Promise<void> => {
    const timer = saveTimers.current.get(id);
    if (timer) clearTimeout(timer);
    saveTimers.current.delete(id);
    const running = runningSaves.current.get(id);
    if (running) return running;
    if (!pendingSaves.current.has(id)) return Promise.resolve();
    const task = (async () => {
      while (pendingSaves.current.has(id)) {
        const map = pendingSaves.current.get(id)!;
        pendingSaves.current.delete(id);
        const queuedTimer = saveTimers.current.get(id);
        if (queuedTimer) clearTimeout(queuedTimer);
        saveTimers.current.delete(id);
        try {
          const result = await api<{ map: MindMap }>(`/api/maps/${id}`, { method: 'PUT', body: JSON.stringify(map) });
          // Identity also distinguishes edits made in the same millisecond.
          setMaps(current => current.map(m => m === map ? { ...m, updatedAt: result.map.updatedAt } : m));
          failedSaves.current.delete(id);
          setStatus('saved');
        } catch {
          // A newer queued edit can replace a failed snapshot; otherwise retain it for retry.
          if (!pendingSaves.current.has(id)) {
            pendingSaves.current.set(id, map);
            failedSaves.current.add(id);
            break;
          }
        }
      }
    })().finally(() => {
      runningSaves.current.delete(id);
      setSaveStatus(failedSaves.current.size ? 'error' : pendingSaves.current.size || runningSaves.current.size ? 'saving' : 'saved');
    });
    runningSaves.current.set(id, task);
    return task;
  }, []);
  const save = useCallback((map: MindMap) => {
    const prior = saveTimers.current.get(map.id);
    if (prior) clearTimeout(prior);
    pendingSaves.current.set(map.id, map);
    failedSaves.current.delete(map.id);
    setSaveStatus(failedSaves.current.size ? 'error' : 'saving');
    saveTimers.current.set(map.id, setTimeout(() => { void flushSave(map.id); }, 650));
  }, [flushSave]);
  const flushSaves = useCallback(async () => {
    const ids = new Set([...pendingSaves.current.keys(), ...runningSaves.current.keys()]);
    await Promise.all([...ids].map(flushSave));
    return !pendingSaves.current.size && !runningSaves.current.size && !failedSaves.current.size;
  }, [flushSave]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!pendingSaves.current.size && !runningSaves.current.size) return;
      void flushSaves();
      event.preventDefault();
      event.returnValue = '';
    };
    const visibilityChange = () => { if (document.visibilityState === 'hidden') void flushSaves(); };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('visibilitychange', visibilityChange);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('visibilitychange', visibilityChange);
      void flushSaves();
    };
  }, [flushSaves]);
  const signOut = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (await flushSaves()) window.location.assign(signOutPath);
  };
  const commit = useCallback((next: MindMap, record = true) => {
    const previous = maps.find(map => map.id === next.id);
    if (!previous) return;
    if (record) setHistory(history => ({ past: [...history.past, previous].slice(-50), future: [] }));
    let prepared = record ? styleNewNodes(previous, next) : next;
    if (record && prepared.nodes.length > previous.nodes.length) prepared = applySiblingAlignments(prepared);
    if (record && prepared.layout !== 'free' && prepared.layout !== 'network' && (changedTreeStructure(previous, prepared) || changedNodeGeometry(previous, prepared))) {
      prepared = { ...prepared, nodes: ['matrix', 'swimlane', 'radial', 'concentric', 'cycle', 'fishbone', 'timeline', 'treemap'].includes(prepared.layout)
        ? layoutMap(prepared.nodes, prepared.layout, prepared.spacing)
        : changedTreeStructure(previous, prepared) ? layoutMap(prepared.nodes, prepared.layout, prepared.spacing) : packTreeLayout(prepared.nodes, prepared.layout, undefined, prepared.spacing) };
    }
    const fresh = { ...prepared, updatedAt: Date.now() };
    setMaps(current => current.map(map => map.id === next.id ? fresh : map));
    save(fresh);
  }, [maps, save]);
  const switchMap = (id: string, preserveTrail = false) => { setActiveId(id); setViewMode('map'); selectOne(null); setSelectedEdgeId(null); setSelectedBoundary(null); setTemporaryBranchId(null); setHistory({ past: [], future: [] }); setShareOpen(false); setLinkNodeId(null); if (!preserveTrail) setMapTrail([]); };
  const openLinkedMap = (sourceNodeId: string, targetId: string, created = false) => {
    if (!active || !active.nodes.some(node => node.id === sourceNodeId) || !created && (!active.nodes.find(node => node.id === sourceNodeId)?.linkedMapIds?.includes(targetId) || !maps.some(map => map.id === targetId))) return;
    const sourceId = active.id;
    switchMap(targetId, true);
    setMapTrail(trail => [...trail, { mapId: sourceId, nodeId: sourceNodeId }]);
  };
  const openLinkedFromIndicator = (nodeId: string) => {
    if (!active) return;
    const links = mapLinksForNode(active, nodeId, maps);
    if (links.length === 1 && links[0].map) openLinkedMap(nodeId, links[0].id);
    else setLinkNodeId(nodeId);
  };
  const returnToLinkedSource = () => {
    const source = mapTrail.at(-1);
    if (!source || !maps.some(map => map.id === source.mapId)) { setMapTrail([]); return; }
    switchMap(source.mapId, true);
    setMapTrail(trail => trail.slice(0, -1));
    if (maps.find(map => map.id === source.mapId)?.nodes.some(node => node.id === source.nodeId)) selectOne(source.nodeId);
  };
  const changeMapLink = (nodeId: string, targetId: string, linked: boolean) => {
    if (!active || !maps.some(map => map.id === targetId) && linked) return;
    const next = updateNodeMapLink(active, nodeId, targetId, linked);
    if (next === active) { if (linked) setMovementNotice('Este nó já atingiu o limite de 20 mapas vinculados.'); return; }
    commit(next);
  };
  const createLinkedMap = async (nodeId: string, title: string) => {
    if (!active || !title.trim() || (active.nodes.find(node => node.id === nodeId)?.linkedMapIds?.length || 0) >= 20) return;
    const source = active;
    const map = { ...createMap(title.trim()), projectId: source.projectId, folderId: source.folderId };
    try {
      await api('/api/maps', { method: 'POST', body: JSON.stringify(map) });
      setMaps(current => [map, ...current]);
      commit(updateNodeMapLink(source, nodeId, map.id, true));
      openLinkedMap(nodeId, map.id, true);
    } catch { setStatus('error'); window.alert('Não foi possível criar o mapa vinculado. Tente novamente.'); }
  };
  const updateWorkspace = async (next: Workspace): Promise<boolean> => { try { await api('/api/workspace', { method: 'PUT', body: JSON.stringify(next) }); setWorkspace(next); return true; } catch { window.alert('Não foi possível salvar projetos e etiquetas. Tente novamente.'); return false; } };
  const addMap = async (template?: TemplateKey, projectId?: string, folderId?: string) => { const map = { ...(template ? createTemplate(template) : createMap()), projectId, folderId }; try { await api('/api/maps', { method: 'POST', body: JSON.stringify(map) }); setMaps(current => [map, ...current]); switchMap(map.id); setStatus('saved'); } catch { setStatus('error'); } };
  const moveMap = (id: string, projectId?: string, folderId?: string) => { const target = maps.find(map => map.id === id); if (!target) return; if (target.id === active?.id) commit({ ...target, projectId, folderId }); else { const fresh = { ...target, projectId, folderId, updatedAt: Date.now() }; setMaps(current => current.map(map => map.id === id ? fresh : map)); save(fresh); } };
  const relocateMaps = (ids: Set<string>, patch: (map: MindMap) => Partial<MindMap>) => { const changed = maps.filter(map => ids.has(map.id)).map(map => ({ ...map, ...patch(map), updatedAt: Date.now() })); setMaps(current => current.map(map => changed.find(item => item.id === map.id) || map)); changed.forEach(save); };
  const createProject = (name: string) => { if (workspace.projects.length >= 100) return window.alert('Limite de 100 projetos.'); void updateWorkspace({ ...workspace, projects: [...workspace.projects, { id: uid(), name, createdAt: Date.now() }] }); };
  const renameProject = (id: string, name: string) => void updateWorkspace({ ...workspace, projects: workspace.projects.map(project => project.id === id ? { ...project, name } : project) });
  const deleteProject = async (id: string) => { const project = workspace.projects.find(item => item.id === id); if (!project || !window.confirm(`Excluir o projeto “${project.name}”? Os arquivos serão movidos para “Sem projeto”.`)) return; const affected = new Set(maps.filter(map => map.projectId === id).map(map => map.id)); if (await updateWorkspace({ ...workspace, projects: workspace.projects.filter(item => item.id !== id), folders: workspace.folders.filter(folder => folder.projectId !== id), files: workspace.files.map(file => file.projectId === id ? { ...file, projectId: undefined, folderId: undefined } : file) })) relocateMaps(affected, () => ({ projectId: undefined, folderId: undefined })); };
  const createFolder = (projectId: string, parentId: string | null, name: string) => { if (workspace.folders.length >= 1000) return window.alert('Limite de 1.000 pastas.'); void updateWorkspace({ ...workspace, folders: [...workspace.folders, { id: uid(), projectId, parentId, name, createdAt: Date.now() }] }); };
  const renameFolder = (id: string, name: string) => void updateWorkspace({ ...workspace, folders: workspace.folders.map(folder => folder.id === id ? { ...folder, name } : folder) });
  const deleteFolder = async (id: string) => { const folder = workspace.folders.find(item => item.id === id); if (!folder || !window.confirm(`Excluir a pasta “${folder.name}” e suas subpastas? Os arquivos serão movidos para a pasta acima.`)) return; const ids = folderTreeIds(workspace.folders, id); const affected = new Set(maps.filter(map => map.folderId && ids.has(map.folderId)).map(map => map.id)); if (await updateWorkspace({ ...workspace, folders: workspace.folders.filter(item => !ids.has(item.id)), files: workspace.files.map(file => file.folderId && ids.has(file.folderId) ? { ...file, folderId: folder.parentId ?? undefined } : file) })) relocateMaps(affected, () => ({ folderId: folder.parentId ?? undefined })); };
  const uploadFile = async (projectId: string, folderId: string | undefined, file: File) => { if (localMode) return window.alert('Entre na versão em nuvem para enviar arquivos.'); if (workspace.files.length >= 2000) return window.alert('Limite de 2.000 arquivos enviados.'); try { const uploaded = await uploadWorkspaceFile(file, projectId, folderId); if (!await updateWorkspace({ ...workspace, files: [...workspace.files, uploaded] })) await removeWorkspaceFile(uploaded); } catch (error) { window.alert(error instanceof Error ? error.message : 'Falha ao enviar arquivo.'); } };
  const downloadFile = async (file: WorkspaceFile) => { try { await downloadWorkspaceFile(file); } catch (error) { window.alert(error instanceof Error ? error.message : 'Falha ao baixar arquivo.'); } };
  const deleteFile = async (file: WorkspaceFile) => { if (!window.confirm(`Excluir o arquivo “${file.name}”?`)) return; if (await updateWorkspace({ ...workspace, files: workspace.files.filter(item => item.id !== file.id) })) { try { await removeWorkspaceFile(file); } catch { window.alert('O arquivo saiu da lista, mas a remoção do armazenamento falhou. Tente novamente mais tarde.'); } } };
  const createTag = (name: string, color: string) => { if (workspace.tags.some(tag => tag.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) return window.alert('Já existe uma etiqueta com esse nome.'); if (workspace.tags.length >= 200) return window.alert('Limite de 200 etiquetas.'); void updateWorkspace({ ...workspace, tags: [...workspace.tags, { id: uid(), name, color }] }); };
  const updateTag = async (id: string, patch: { name?: string; color?: string }) => { if (patch.name && workspace.tags.some(tag => tag.id !== id && tag.name.toLocaleLowerCase('pt-BR') === patch.name!.toLocaleLowerCase('pt-BR'))) return window.alert('Já existe uma etiqueta com esse nome.'); const tags = workspace.tags.map(tag => tag.id === id ? { ...tag, ...patch } : tag); if (!await updateWorkspace({ ...workspace, tags })) return; const revised = maps.filter(map => map.tagDefinitions?.some(tag => tag.id === id)).map(map => ({ ...map, tagDefinitions: map.tagDefinitions?.map(tag => tag.id === id ? tags.find(item => item.id === id)! : tag), updatedAt: Date.now() })); setMaps(current => current.map(map => revised.find(item => item.id === map.id) || map)); revised.forEach(save); };
  const deleteTag = async (id: string) => { const tag = workspace.tags.find(item => item.id === id); if (!tag || !window.confirm(`Excluir a etiqueta “${tag.name}” de todos os mapas?`)) return; if (!await updateWorkspace({ ...workspace, tags: workspace.tags.filter(item => item.id !== id) })) return; setSelectedTagId(current => current === id ? null : current); const revised = maps.map(map => ({ ...map, tagDefinitions: map.tagDefinitions?.filter(item => item.id !== id), nodes: map.nodes.map(node => ({ ...node, tagIds: node.tagIds?.filter(item => item !== id), boundaryTagIds: node.boundaryTagIds?.filter(item => item !== id) })), boundaryGroups: map.boundaryGroups?.map(group => ({ ...group, tagIds: group.tagIds?.filter(item => item !== id) })), updatedAt: Date.now() })); setMaps(revised); revised.forEach(save); };
  const toggleTag = (nodeId: string, tagId: string, target: 'node' | 'boundary') => { if (!active || !workspace.tags.some(tag => tag.id === tagId)) return; const node = active.nodes.find(item => item.id === nodeId); if (!node) return; const toggle = (ids?: string[]) => ids?.includes(tagId) ? ids.filter(id => id !== tagId) : [...(ids || []), tagId]; const group = active.boundaryGroups?.find(item => item.nodeIds.includes(nodeId)); if (target === 'boundary' && !group && !node.boundary) return; const nodes = active.nodes.map(item => item.id === nodeId && (target === 'node' || !group) ? { ...item, [target === 'node' ? 'tagIds' : 'boundaryTagIds']: toggle(target === 'node' ? item.tagIds : item.boundaryTagIds) } : item); const boundaryGroups = target === 'boundary' && group ? active.boundaryGroups?.map(item => item.id === group.id ? { ...item, tagIds: toggle(item.tagIds) } : item) : active.boundaryGroups; commit({ ...active, nodes, boundaryGroups, tagDefinitions: workspace.tags }); };
  const createAndApplyTag = async (nodeId: string, name: string, color: string, target: 'node' | 'boundary'): Promise<boolean> => {
    const clean = name.trim();
    if (!active || !clean || clean.length > 100 || !/^#[0-9a-f]{6}$/i.test(color)) return false;
    const existing = workspace.tags.find(tag => tag.name.toLocaleLowerCase('pt-BR') === clean.toLocaleLowerCase('pt-BR'));
    if (existing) {
      const node = active.nodes.find(item => item.id === nodeId);
      const group = active.boundaryGroups?.find(item => item.nodeIds.includes(nodeId));
      const assigned = target === 'node' ? node?.tagIds : group?.tagIds || node?.boundaryTagIds;
      if (!assigned?.includes(existing.id)) toggleTag(nodeId, existing.id, target);
      return true;
    }
    if (workspace.tags.length >= 200) { window.alert('Limite de 200 etiquetas.'); return false; }
    const tag = { id: uid(), name: clean, color };
    if (!await updateWorkspace({ ...workspace, tags: [...workspace.tags, tag] })) return false;
    const group = active.boundaryGroups?.find(item => item.nodeIds.includes(nodeId));
    if (target === 'boundary' && !group && !active.nodes.some(item => item.id === nodeId && item.boundary)) return false;
    commit({ ...active, tagDefinitions: [...workspace.tags, tag], nodes: active.nodes.map(item => item.id === nodeId && (target === 'node' || !group) ? { ...item, [target === 'node' ? 'tagIds' : 'boundaryTagIds']: [...(target === 'node' ? item.tagIds || [] : item.boundaryTagIds || []), tag.id] } : item), boundaryGroups: target === 'boundary' && group ? active.boundaryGroups?.map(item => item.id === group.id ? { ...item, tagIds: [...(item.tagIds || []), tag.id] } : item) : active.boundaryGroups });
    return true;
  };
  const toggleBoundary = (ids: string[]) => { if (!active || !ids.length) return; const anchors = [...new Set(ids)].filter(id => active.nodes.some(node => node.id === id)); if (!anchors.length) return; if (anchors.length === 1 && active.nodes.some(node => node.id === anchors[0] && node.boundary)) { commit({ ...active, nodes: active.nodes.map(node => node.id === anchors[0] ? { ...node, boundary: false, boundaryTagIds: undefined } : node) }); return; } const existing = active.boundaryGroups?.find(group => group.nodeIds.length === anchors.length && group.nodeIds.every(id => anchors.includes(id))); commit({ ...active, boundaryGroups: existing ? active.boundaryGroups?.filter(group => group.id !== existing.id) : [...(active.boundaryGroups || []), { id: uid(), nodeIds: anchors }] }); };
  const deleteSelectedBoundary = useCallback(() => {
    if (!active || !selectedBoundary) return;
    const next = removeBoundary(active, selectedBoundary);
    if (next !== active) commit(next);
    setSelectedBoundary(null);
  }, [active, selectedBoundary, commit]);
  const toggleSelectedBoundaryTag = (tagId: string) => {
    if (!active || !selectedBoundary || !workspace.tags.some(tag => tag.id === tagId)) return;
    const enabled = !boundaryTagIds(active, selectedBoundary).includes(tagId);
    commit({ ...setBoundaryTag(active, selectedBoundary, tagId, enabled), tagDefinitions: workspace.tags });
  };
  const createSelectedBoundaryTag = async (name: string, color: string): Promise<boolean> => {
    const clean = name.trim();
    if (!active || !selectedBoundary || !boundaryExists(active, selectedBoundary) || !clean || clean.length > 100 || !/^#[0-9a-f]{6}$/i.test(color)) return false;
    const existing = workspace.tags.find(tag => tag.name.toLocaleLowerCase('pt-BR') === clean.toLocaleLowerCase('pt-BR'));
    if (existing) {
      if (!boundaryTagIds(active, selectedBoundary).includes(existing.id)) toggleSelectedBoundaryTag(existing.id);
      return true;
    }
    if (workspace.tags.length >= 200) { window.alert('Limite de 200 etiquetas.'); return false; }
    const tag = { id: uid(), name: clean, color };
    if (!await updateWorkspace({ ...workspace, tags: [...workspace.tags, tag] })) return false;
    commit({ ...setBoundaryTag(active, selectedBoundary, tag.id, true), tagDefinitions: [...workspace.tags, tag] });
    return true;
  };
  const duplicateMap = async (map: MindMap) => { const copy = { ...map, id: uid(), title: `${map.title} (cópia)`, shareToken: null, updatedAt: Date.now(), nodes: map.nodes.map(n => ({ ...n })) }; try { await api('/api/maps', { method: 'POST', body: JSON.stringify(copy) }); setMaps(current => [copy, ...current]); switchMap(copy.id); } catch { setStatus('error'); } };
  const importJson = async (file?: File) => { if (!file) return; try { if (file.size > 25 * 1024 * 1024) throw new Error('Use um arquivo de até 25 MB.'); const header = new Uint8Array(await file.slice(0, 2).arrayBuffer()); const { map, warning } = header[0] === 0x50 && header[1] === 0x4b ? parseMindomoArchive(new Uint8Array(await file.arrayBuffer()), file.name) : parseMapFile(await file.text(), file.name); await api('/api/maps', { method: 'POST', body: JSON.stringify(map) }); setMaps(current => [map, ...current]); switchMap(map.id); if (warning) window.alert(warning); } catch (error) { window.alert(error instanceof Error ? error.message : 'Não foi possível importar este mapa.'); } if (importRef.current) importRef.current.value = ''; };
  const importFromDrive = async () => { if (driveBusy) return; setDriveBusy(true); setDriveOpen(false); try { const doc = await pickDriveFile(); if (!doc) return; const blob = await downloadDriveFile(doc.id); await importJson(new File([blob], doc.name || 'mapa.json', { type: blob.type })); } catch (error) { window.alert(error instanceof Error ? error.message : 'Falha ao abrir o Google Drive.'); } finally { setDriveBusy(false); } };
  const backupToDrive = async () => { setDriveOpen(false); if (!active || driveBusy) return; setDriveBusy(true); try { await saveMapToDrive(active); window.alert('Cópia do mapa salva no Google Drive.'); } catch (error) { window.alert(error instanceof Error ? error.message : 'Falha ao salvar no Google Drive.'); } finally { setDriveBusy(false); } };
  const deleteMap = async (map: MindMap) => {
    if (!window.confirm(`Excluir “${map.title}”? Esta ação não pode ser desfeita.`)) return;
    try {
      await flushSave(map.id);
      await api(`/api/maps/${map.id}`, { method: 'DELETE' });
      const timer = saveTimers.current.get(map.id);
      if (timer) clearTimeout(timer);
      saveTimers.current.delete(map.id);
      pendingSaves.current.delete(map.id);
      failedSaves.current.delete(map.id);
      setSaveStatus(failedSaves.current.size ? 'error' : pendingSaves.current.size || runningSaves.current.size ? 'saving' : 'saved');
      setMaps(current => current.filter(m => m.id !== map.id));
      if (activeId === map.id) switchMap(maps.find(m => m.id !== map.id)?.id ?? '');
    } catch { setStatus('error'); }
  };
  const addChild = useCallback((id: string, answer?: 'yes' | 'no') => { if (!active) return; const parent = active.nodes.find(n => n.id === id); if (!parent) return; const siblings = active.nodes.filter(n => n.parentId === id); const side = (active.layout === 'right' || active.layout === 'horizontal') ? 'right' : parent.parentId ? (parent.x < 0 ? 'left' : 'right') : (siblings.length % 2 ? 'left' : 'right'); const reference = active.levelReferences?.find(entry => entry.parentId === id); const line = active.levelConnections?.find(entry => entry.parentId === id); const flowAnswer = active.layout === 'flowchart' && parent.flowDecision ? answer ?? (siblings.some(item => item.flowAnswer === 'yes') ? siblings.some(item => item.flowAnswer === 'no') ? undefined : 'no' : 'yes') : undefined; const child: MindNode = { icon: '', background: '#ffffff', border: '#000000', color: '#000000', ...active.defaultNodeStyle, ...reference?.style, ...childMovementSettings(parent), connectionStyle: line?.style, id: uid(), parentId: id, text: flowAnswer ? 'Nova etapa' : 'Nova ideia', flowAnswer, x: parent.x + (side === 'left' ? -260 : 260), y: parent.y + siblings.length * 100, side }; const nodes = layoutMap([...active.nodes, child], active.layout, active.spacing); commit({ ...active, nodes }); selectOne(child.id); }, [active, commit, selectOne]);
  const editNode = useCallback((id: string, text: string) => { if (active) commit({ ...active, nodes: active.nodes.map(n => n.id === id ? { ...n, text } : n) }); }, [active, commit]);
  const patchNodeById = (id: string, patch: Partial<MindNode>) => {
    if (!active) return;
    let next = patchVisualNodes(active, [id], patch, collectNodeDimensions());
    if (active.layout === 'matrix' && ('matrixRows' in patch || 'matrixColumns' in patch)) {
      const root = next.nodes.find(node => !node.parentId && !node.floating);
      if (root) {
        const rowLimit = (root.matrixRows?.length || 2) - 1;
        const columnLimit = (root.matrixColumns?.length || 2) - 1;
        next = { ...next, nodes: next.nodes.map(node => node.id === root.id ? node : {
          ...node, matrixRow: node.matrixRow === undefined ? undefined : Math.min(node.matrixRow, rowLimit),
          matrixColumn: node.matrixColumn === undefined ? undefined : Math.min(node.matrixColumn, columnLimit),
        }) };
      }
    }
    const fields = active.layout === 'flowchart' ? ['flowAnswer', 'flowDecision']
      : active.layout === 'matrix' ? ['matrixRows', 'matrixColumns', 'matrixRow', 'matrixColumn']
      : active.layout === 'timeline' ? ['timelineDate']
      : active.layout === 'radial' ? ['radialStartAngle', 'radialRadius'] : [];
    if (fields.some(field => field in patch)) {
      const root = next.nodes.find(node => !node.parentId && !node.floating);
      commit(root ? reorganizeBranch(next, root.id, next.avoidOverlap ?? globalAvoidOverlap, collectNodeDimensions()) : next);
    } else commit(next);
  };
  const applyReference = (id: string, mode: 'size' | 'format' | 'both') => {
    const source = active?.nodes.find(node => node.id === id);
    if (!active || !source?.parentId) return;
    const style = pickNodeStyle(source, mode);
    const levelReferences = [...(active.levelReferences || []).filter(entry => entry.parentId !== source.parentId), { parentId: source.parentId, mode, style }];
    commit({ ...active, levelReferences, nodes: active.nodes.map(node => node.parentId === source.parentId && node.id !== source.id ? markStyleOverrides(node, style, active) : node) });
  };
  const saveStylePreset = (id: string) => {
    const source = active?.nodes.find(node => node.id === id);
    if (!active || !source) return;
    const name = window.prompt('Nome do modelo de formatação:')?.trim().slice(0, 50);
    if (!name) return;
    commit({ ...active, stylePresets: [...(active.stylePresets || []), { id: uid(), name, style: pickNodeStyle(source) }] });
  };
  const applyStylePreset = (id: string, presetId: string) => { const preset = active?.stylePresets?.find(item => item.id === presetId); if (preset) patchNodeById(id, preset.style); };
  const applyLevelConnection = (id: string) => { const source = active?.nodes.find(node => node.id === id); if (active && source?.parentId) { const style = { ...source.connectionStyle }; commit({ ...active, levelConnections: [...(active.levelConnections || []).filter(entry => entry.parentId !== source.parentId), { parentId: source.parentId, style }], nodes: active.nodes.map(node => node.parentId === source.parentId ? { ...node, connectionStyle: style } : node) }); } };
  const removeNodeById = (id: string) => { if (!active) return; const node = active.nodes.find(n => n.id === id); if (!node || (!node.parentId && !node.floating)) return; const ids = descendants(active.nodes, id); commit({ ...active, nodes: active.nodes.filter(n => !ids.has(n.id)), relationships: active.relationships?.filter(link => !ids.has(link.source) && !ids.has(link.target)), boundaryGroups: active.boundaryGroups?.map(group => ({ ...group, nodeIds: group.nodeIds.filter(item => !ids.has(item)) })).filter(group => group.nodeIds.length) }); selectOne(null); };
  const duplicateBranch = (id: string) => {
    if (!active) return; const branchIds = descendants(active.nodes, id); const branch = active.nodes.filter(n => branchIds.has(n.id)); const original = active.nodes.find(n => n.id === id); if (!original?.parentId) return;
    const ids = new Map(branch.map(n => [n.id, uid()]));
    const copies = branch.map(n => ({ ...n, id: ids.get(n.id)!, parentId: n.id === id ? original.parentId : ids.get(n.parentId!)!, y: n.y + 96, comments: n.comments?.map(c => ({ ...c, id: uid() })) }));
    const nodes = [...active.nodes, ...copies]; commit({ ...active, nodes: layoutMap(nodes, active.layout, active.spacing) }); selectOne(ids.get(id)!);
  };
  const toggleNode = useCallback((id: string) => {
    if (!active) return;
    const toggled = toggleBranch(active.nodes, id);
    if (toggled === active.nodes) return;
    const nodes = active.layout === 'free' || active.layout === 'network' ? toggled : layoutMap(toggled, active.layout, active.spacing);
    commit({ ...active, nodes });
  }, [active, commit]);
  const applyLayout = (mode: LayoutMode) => {
    if (!active) return;
    if (mode === 'free' || mode === 'network' || mode === 'treemap') { commit({ ...active, layout: mode }); return; }
    const root = active.nodes.find(node => !node.parentId && !node.floating);
    if (!root) return;
    commit(applySiblingAlignments(reorganizeBranch({ ...active, layout: mode }, root.id, active.avoidOverlap ?? globalAvoidOverlap, collectNodeDimensions())));
  };
  const openQuickPanel = (id: string, panel: NodePanel) => { selectOne(id); setQuickPanel({ id, panel, key: Date.now() }); };
  const requestAi = async (node: MindNode, action: 'ideas' | 'questions' | 'ai-summary' | 'swot') => {
    if (aiBusy || !active) return;
    setAiBusy(true);
    try {
      const response = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: action === 'ai-summary' ? 'summary' : action, text: node.text, context: active.title }) });
      const result = await response.json() as { items?: string[]; summary?: string; error?: string };
      if (!response.ok) throw new Error(result.error || 'Falha ao gerar sugestões.');
      setAiProposal({ nodeId: node.id, action, items: result.items || [], summary: result.summary || '' });
    } catch (error) { window.alert(error instanceof Error ? error.message : 'Falha ao gerar sugestões.'); }
    finally { setAiBusy(false); }
  };
  const applyAi = () => {
    if (!active || !aiProposal) return;
    const node = active.nodes.find(item => item.id === aiProposal.nodeId);
    if (!node) { setAiProposal(null); return; }
    if (aiProposal.action === 'ai-summary') {
      let notePatch: Pick<MindNode, 'note' | 'notes'>;
      try { notePatch = appendNodeNote(node, aiProposal.summary); }
      catch (error) { window.alert(error instanceof Error ? error.message : 'Não foi possível adicionar a nota.'); return; }
      commit({ ...active, nodes: active.nodes.map(item => item.id === node.id ? { ...item, ...notePatch } : item) });
      openQuickPanel(node.id, 'notes');
    } else {
      const reference = active.levelReferences?.find(entry => entry.parentId === node.id);
      const line = active.levelConnections?.find(entry => entry.parentId === node.id);
      const children: MindNode[] = aiProposal.items.map((text, index) => ({ ...active.defaultNodeStyle, ...reference?.style, ...childMovementSettings(node), connectionStyle: line?.style, id: uid(), parentId: node.id, text, x: node.x + 260, y: node.y + index * 100, side: 'right' }));
      commit({ ...active, nodes: layoutMap([...active.nodes, ...children], active.layout, active.spacing) });
      selectOne(children[0]?.id || node.id);
    }
    setAiProposal(null);
  };
  const quickAction = (id: string, action: NodeAction) => {
    if (!active) return; const node = active.nodes.find(n => n.id === id); if (!node) return; const boundarySelection = selectedIds.includes(id) ? selectedIds : [id]; if (action !== 'boundary') selectOne(id);
    if (action === 'maps') { setLinkNodeId(id); return; }
    if (action === 'move-branch') { setTemporaryBranchId(id); setMovementNotice('Mover ramo inteiro: arraste o nó uma vez. Esta escolha não altera o modo configurado.'); return; }
    if (action === 'reorganize-branch' || action === 'restore-layout') {
      const base = action === 'restore-layout' ? { ...active, nodes: active.nodes.map(item => item.id === id ? { ...item, branchLayout: undefined } : item) } : active;
      const next = applySiblingAlignments(reorganizeBranch(base, id, effectiveAvoidOverlap(base, id, globalAvoidOverlap), collectNodeDimensions()), descendants(base.nodes, id));
      commit(next); setMovementNotice('Ramo reorganizado. Use Desfazer para recuperar as posições anteriores.'); return;
    }
    if (action === 'child') { addChild(id); return; }
    if (action === 'flow-yes' || action === 'flow-no') { if (active.layout === 'flowchart' && node.flowDecision) addChild(id, action === 'flow-yes' ? 'yes' : 'no'); return; }
    if (action === 'sibling') { if (node.parentId) addChild(node.parentId); return; }
    if (action === 'same-style' && node.parentId) { const parent = active.nodes.find(item => item.id === node.parentId)!; const copy: MindNode = { ...pickNodeStyle(node), ...childMovementSettings(parent), id: uid(), parentId: node.parentId, text: 'Nova ideia', x: node.x, y: node.y + 100 }; const nodes = [...active.nodes, copy]; commit({ ...active, nodes: layoutMap(nodes, active.layout, active.spacing) }); selectOne(copy.id); return; }
    if (action === 'relationship') { setRelationSourceId(id); return; }
    if (action === 'boundary') { toggleBoundary(boundarySelection); return; }
    if (action === 'summary') { const summary = window.prompt('Resumo deste ramo:', node.summary || ''); if (summary !== null) patchNodeById(id, { summary }); return; }
    if (action === 'floating') { const floating: MindNode = { ...active.defaultNodeStyle, id: uid(), parentId: null, floating: true, text: 'Ideia flutuante', x: node.x + 250, y: node.y + 130 }; commit({ ...active, layout: 'network', nodes: [...active.nodes, floating] }); selectOne(floating.id); return; }
    if (action === 'label' || action === 'equation') { const value = window.prompt(action === 'label' ? 'Rótulo do nó:' : 'Equação matemática:', action === 'label' ? node.label || '' : node.equation || ''); if (value !== null) patchNodeById(id, action === 'label' ? { label: value } : { equation: value }); return; }
    if (['text', 'style', 'notes', 'comments', 'icon', 'link', 'tags'].includes(action)) { openQuickPanel(id, action === 'text' || action === 'icon' ? 'style' : action === 'link' ? 'links' : action === 'style' ? 'node' : action as NodePanel); return; }
    if (action === 'task') { if (!node.task) commit({ ...active, nodes: active.nodes.map(n => n.id === id ? { ...n, task: { done: false } } : n) }); openQuickPanel(id, 'task'); return; }
    if (action === 'reference-size' || action === 'reference-format' || action === 'reference-both') { applyReference(id, action.slice('reference-'.length) as 'size' | 'format' | 'both'); return; }
    if (action === 'save-style-preset') { saveStylePreset(id); return; }
    if (action.startsWith('preset:')) { applyStylePreset(id, action.slice('preset:'.length)); return; }
    if (action === 'apply-level-line') { applyLevelConnection(id); return; }
    if (action === 'collapse') { toggleNode(id); return; }
    if (action.startsWith('spacing-')) { const spacing = action === 'spacing-compact' ? { x: 210, y: 82 } : action === 'spacing-wide' ? { x: 320, y: 150 } : { x: 260, y: 112 }; const root = active.nodes.find(item => !item.parentId && !item.floating); const next = { ...active, spacing }; commit(root && active.layout !== 'free' && active.layout !== 'network' ? reorganizeBranch(next, root.id, active.avoidOverlap ?? globalAvoidOverlap, collectNodeDimensions()) : next); return; }
    if (layoutOptions.some(option => option.mode === action)) {
      const mode = action as MindMap['layout'];
      if (!node.parentId && !node.floating) applyLayout(mode);
      else { const nodes = active.nodes.map(item => item.id === id ? { ...item, branchLayout: mode } : item); const next = { ...active, nodes }; commit(mode === 'free' || mode === 'network' ? next : reorganizeBranch(next, id, effectiveAvoidOverlap(next, id, globalAvoidOverlap), collectNodeDimensions())); }
      return;
    }
    if (action === 'duplicate') { duplicateBranch(id); return; }
    if (action === 'delete') { removeNodeById(id); return; }
    if (action === 'detach' && node.parentId) { commit({ ...active, layout: 'network', nodes: active.nodes.map(n => n.id === id ? { ...n, parentId: null, floating: true } : n) }); return; }
    if (action === 'copy' || action === 'cut') { const ids = descendants(active.nodes, id); branchClipboard.current = { rootId: id, nodes: active.nodes.filter(n => ids.has(n.id)).map(n => ({ ...n })) }; if (action === 'cut') removeNodeById(id); return; }
    if (action === 'paste' && branchClipboard.current) { const clipboard = branchClipboard.current; const origin = clipboard.nodes.find(n => n.id === clipboard.rootId)!; const ids = new Map(clipboard.nodes.map(n => [n.id, uid()])); const copies = clipboard.nodes.map(n => ({ ...n, id: ids.get(n.id)!, parentId: n.id === clipboard.rootId ? id : ids.get(n.parentId!)!, x: node.x + (n.x - origin.x) + 260, y: node.y + (n.y - origin.y), comments: n.comments?.map(c => ({ ...c, id: uid() })) })); const nodes = [...active.nodes, ...copies]; commit({ ...active, nodes: layoutMap(nodes, active.layout, active.spacing) }); selectOne(ids.get(clipboard.rootId)!); return; }
    if (action === 'copy-style' || action === 'copy-style-all' || action === 'copy-style-visual' || action === 'copy-style-size') { styleClipboard.current = copyNodeFormatting(node, action === 'copy-style-visual' ? 'visual' : action === 'copy-style-size' ? 'size' : 'all'); setStyleCopied(true); return; }
    if (action === 'paste-style') { if (styleClipboard.current) patchNodeById(id, styleClipboard.current); return; }
    if (action === 'set-default-style') { commit({ ...active, defaultNodeStyle: pickNodeStyle(node) }); return; }
    if (action === 'copy-link') { const url = new URL(window.location.href); url.searchParams.set('map', active.id); url.searchParams.set('node', id); navigator.clipboard.writeText(url.href).catch(() => {}); return; }
    if (action === 'copy-text') { navigator.clipboard.writeText(node.text).catch(() => {}); return; }
    if (action === 'ideas' || action === 'questions' || action === 'ai-summary' || action === 'swot') { void requestAi(node, action); return; }
    if (action === 'explain') { try { patchNodeById(id, appendNodeNote(node, `## ${node.text}\n\nDescrição, contexto e próximos passos:`)); openQuickPanel(id, 'notes'); } catch (error) { window.alert(error instanceof Error ? error.message : 'Não foi possível adicionar a nota.'); } return; }
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
    const children: MindNode[] = labels.map((text, index) => ({ ...active.defaultNodeStyle, ...reference?.style, ...childMovementSettings(node), connectionStyle: line?.style, id: uid(), parentId: id, text, x: node.x + 260, y: node.y + index * 100, side: 'right' }));
    const nodes = [...active.nodes, ...children]; commit({ ...active, nodes: layoutMap(nodes, active.layout, active.spacing) }); selectOne(children[0].id);
  };
  const quickActionRef = useRef(quickAction);
  useEffect(() => { quickActionRef.current = quickAction; });
  useEffect(() => {
    const onClipboard = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable || !active || !selectedId || selectedIds.length !== 1) return;
      const selectedNode = active.nodes.find(node => node.id === selectedId);
      if (!selectedNode || !event.clipboardData) return;
      if (event.type === 'copy' || event.type === 'cut') {
        event.preventDefault();
        quickActionRef.current(selectedId, event.type === 'cut' ? 'cut' : 'copy');
        event.clipboardData.setData('text/plain', selectedNode.text);
        event.clipboardData.setData('application/x-nodum-branch', active.id);
        return;
      }
      if (event.type !== 'paste') return;
      // Our own branch copy carries a marker; ordinary clipboard text becomes direct children.
      if (event.clipboardData.getData('application/x-nodum-branch') === active.id && branchClipboard.current) {
        event.preventDefault();
        quickActionRef.current(selectedId, 'paste');
        return;
      }
      const text = event.clipboardData.getData('text/plain');
      if (!text) return;
      event.preventDefault();
      try {
        const lines = clipboardTextLines(text);
        if (!lines.length) return;
        if (active.nodes.length + lines.length > 2000) throw new Error('Este mapa aceita no máximo 2.000 nós.');
        const siblings = active.nodes.filter(node => node.parentId === selectedId);
        const reference = active.levelReferences?.find(entry => entry.parentId === selectedId);
        const line = active.levelConnections?.find(entry => entry.parentId === selectedId);
        const side = active.layout === 'right' || active.layout === 'horizontal' ? 'right' : selectedNode.side ?? 'right';
        const children: MindNode[] = lines.map((label, index) => ({
          icon: '', background: '#ffffff', border: '#000000', color: '#000000',
          ...active.defaultNodeStyle, ...reference?.style, ...childMovementSettings(selectedNode),
          connectionStyle: line?.style, id: uid(), parentId: selectedId, text: label,
          x: selectedNode.x + (side === 'left' ? -260 : 260),
          y: selectedNode.y + (siblings.length + index) * 100, side,
        }));
        const nodes = layoutMap([...active.nodes.map(node => node.id === selectedId ? { ...node, collapsed: false } : node), ...children], active.layout, active.spacing);
        commit({ ...active, nodes });
        selectOne(children[0].id);
      } catch (error) { window.alert(error instanceof Error ? error.message : 'Não foi possível colar o texto.'); }
    };
    window.addEventListener('copy', onClipboard);
    window.addEventListener('cut', onClipboard);
    window.addEventListener('paste', onClipboard);
    return () => { window.removeEventListener('copy', onClipboard); window.removeEventListener('cut', onClipboard); window.removeEventListener('paste', onClipboard); };
  }, [active, selectedId, selectedIds.length, commit, selectOne]);
  const quickImage = async (id: string, file: File) => { try { const image = await imageData(file); if (!active) return; commit({ ...active, nodes: active.nodes.map(n => n.id === id ? { ...n, image } : n) }); selectOne(id); } catch (error) { window.alert(error instanceof Error ? error.message : 'Não foi possível carregar a imagem.'); } };
  const quickDrivePick = async (id: string, kind: 'image' | 'link') => { if (driveBusy) return; setDriveBusy(true); try { const doc = await pickDriveFile(); if (!doc) return; if (kind === 'link') patchNodeById(id, { url: doc.url || `https://drive.google.com/file/d/${doc.id}/view` }); else { const blob = await downloadDriveFile(doc.id); if (!blob.type.startsWith('image/')) throw new Error('Selecione um arquivo de imagem no Google Drive.'); await quickImage(id, new File([blob], doc.name || 'imagem', { type: blob.type })); } } catch (error) { window.alert(error instanceof Error ? error.message : 'Falha ao abrir o Google Drive.'); } };
  const importFontForNode = async (id: string, file: File) => { const font = await importFontFile(file); setFonts(current => [...current.filter(item => item.id !== font.id), font]); patchNodeById(id, { fontFamily: font.family }); };
  const importFontForMany = async (file: File) => { const font = await importFontFile(file); setFonts(current => [...current.filter(item => item.id !== font.id), font]); patchMany({ fontFamily: font.family }); };
  const setFavoriteIcons = (icons: string[]) => { if (active) commit({ ...active, favoriteIcons: icons.slice(0, 80) }); };
  const removeNode = useCallback(() => { if (!active || !selected || (!selected.parentId && !selected.floating)) return; const ids = descendants(active.nodes, selected.id); commit({ ...active, nodes: active.nodes.filter(n => !ids.has(n.id)), relationships: active.relationships?.filter(link => !ids.has(link.source) && !ids.has(link.target)), boundaryGroups: active.boundaryGroups?.map(group => ({ ...group, nodeIds: group.nodeIds.filter(item => !ids.has(item)) })).filter(group => group.nodeIds.length) }); selectOne(null); }, [active, selected, commit, selectOne]);
  const patchMany = (patch: Partial<MindNode>) => {
    if (!active || selectedIds.length < 2) return;
    const ids = new Set(selectedIds);
    const { connectionStyle, ...rest } = patch;
    const styled = patchVisualNodes(active, [...ids], rest, collectNodeDimensions());
    commit(connectionStyle ? { ...styled, nodes: styled.nodes.map(node => ids.has(node.id) && node.parentId ? { ...node, connectionStyle: { ...node.connectionStyle, ...connectionStyle } } : node) } : styled);
  };
  const copyFormatting = (mode: FormattingCopyMode) => {
    if (!selected || selectedIds.length !== 1) return;
    styleClipboard.current = copyNodeFormatting(selected, mode);
    setStyleCopied(true);
    setMovementNotice('Formatação copiada. Selecione os nós de destino e clique em Aplicar estilo ou pressione Ctrl+Alt+V.');
  };
  const pasteFormatting = () => {
    if (!active || !selectedIds.length || !styleClipboard.current) return;
    const { connectionStyle, ...style } = styleClipboard.current;
    const next = patchVisualNodes(active, selectedIds, style, collectNodeDimensions());
    const targets = new Set(selectedIds);
    commit({ ...next, nodes: next.nodes.map(node => targets.has(node.id) && node.parentId && Object.hasOwn(styleClipboard.current!, 'connectionStyle') ? { ...node, connectionStyle: connectionStyle ? { ...connectionStyle } : undefined } : node) });
    setMovementNotice(`Formatação aplicada a ${selectedIds.length} nó${selectedIds.length === 1 ? '' : 's'}.`);
  };
  const pasteFormattingRef = useRef(pasteFormatting);
  useEffect(() => { pasteFormattingRef.current = pasteFormatting; });
  const removeMany = useCallback(() => {
    if (!active || selectedIds.length < 2) return;
    const ids = new Set<string>();
    for (const id of selectedIds) { const node = active.nodes.find(item => item.id === id); if (node && (node.parentId || node.floating)) descendants(active.nodes, id).forEach(child => ids.add(child)); }
    if (!ids.size) return;
    commit({ ...active, nodes: active.nodes.filter(node => !ids.has(node.id)), relationships: active.relationships?.filter(link => !ids.has(link.source) && !ids.has(link.target)), boundaryGroups: active.boundaryGroups?.map(group => ({ ...group, nodeIds: group.nodeIds.filter(item => !ids.has(item)) })).filter(group => group.nodeIds.length) });
    selectMany([]);
  }, [active, selectedIds, commit, selectMany]);
  const alignMany = (command: AlignCommand) => {
    if (!active || selectedIds.length < 2) return;
    const next = alignNodes(active, selectedIds, command, collectNodeDimensions());
    if (next !== active && next.nodes.some((node, index) => node.x !== active.nodes[index].x || node.y !== active.nodes[index].y)) commit(next);
    else setMovementNotice('Os nós selecionados já estão alinhados ou têm posição bloqueada.');
  };
  const applyVisual = (ids: string[], scope: VisualScope, operation: VisualOperation, value?: number, styleGroups?: VisualStyleGroup[]) => {
    if (!active) return;
    const dimensions = collectNodeDimensions();
    let next = applyVisualStandard(active, ids, scope, operation, dimensions, value, styleGroups);
    if (next === active) {
      setMovementNotice('Nenhum nó pôde ser alterado nesta seleção. Verifique o escopo e os bloqueios de posição.');
      return;
    }
    const targets = visualScopeIds(active, ids, operation === 'save-level-style' ? 'level' : scope);
    const changesSize = ['width','height','both','size-auto','restore-level-size','save-level-style','restore-level-style','model:','fixed-size:','limit-'].some(part => operation.includes(part)) || operation === 'copy-style' && Boolean(styleGroups?.includes('dimensions'));
    if (changesSize) {
      const settled = spreadSiblingOverlaps(next, targets, dimensions);
      next = settled.map;
      if (settled.blocked) setMovementNotice('Alguns nós bloqueados impediram o espaçamento completo.');
    }
    commit(next);
    if (operation === 'save-level-style') setMovementNotice('Estilo salvo para este nível e seus futuros nós.');
    else if ((operation.startsWith('align-') || operation === 'restore-alignment') && targets.some(id => active.nodes.find(node => node.id === id)?.positionLocked)) setMovementNotice('Nó(s) com posição bloqueada permaneceram fixos; o alinhamento foi aplicado onde possível.');
  };
  const resizeGroupStart = () => { const base = collectNodeDimensions(); groupResizeBase.current = base; setGroupResizeBaseState(base); };
  const resizeGroupCancel = () => { groupResizeBase.current = null; setGroupResizeBaseState(null); setGroupResizeDelta(null); };
  const resizeGroupEnd = (dx: number, dy: number) => {
    setGroupResizeDelta(null);
    setGroupResizeBaseState(null);
    const base = groupResizeBase.current;
    groupResizeBase.current = null;
    if (!active || !base || (!dx && !dy)) return;
    if (selectedNodes.every(node => node.sizeLocked)) { setMovementNotice('Desbloqueie as dimensões de pelo menos um nó.'); return; }
    const resized = resizeNodeGroup(active, selectedIds, dx, dy, base, true);
    if (resized !== active) commit(resized);
  };
  const undo = useCallback(() => { if (!active || !history.past.length) return; const previous = history.past.at(-1)!; setHistory(h => ({ past: h.past.slice(0, -1), future: [active, ...h.future] })); commit(previous, false); }, [active, history, commit]);
  const redo = useCallback(() => { if (!active || !history.future.length) return; const next = history.future[0]; setHistory(h => ({ past: [...h.past, active], future: h.future.slice(1) })); commit(next, false); }, [active, history, commit]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void flushSaves(); return; }
      const target = event.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return;
      const key = event.key.toLowerCase();
      const command = event.ctrlKey || event.metaKey;
      if (command && key === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
      else if (command && key === 'y') { event.preventDefault(); redo(); }
      else if (command && key === 'a' && active) { event.preventDefault(); selectMany(visibleNodes(active.nodes).map(node => node.id)); }
      else if (event.key === 'Escape') { selectMany([]); setRelationSourceId(null); setSelectedEdgeId(null); }
      else if (selectedId && command && event.shiftKey && key === 'c') { event.preventDefault(); quickActionRef.current(selectedId, 'copy-style'); }
      else if (command && event.altKey && key === 'v' && selectedIds.length) { event.preventDefault(); pasteFormattingRef.current(); }
      else if (selectedId && command && key === 'd') { event.preventDefault(); quickActionRef.current(selectedId, 'duplicate'); }
      else if (selectedId && command && key === 'l') { event.preventDefault(); quickActionRef.current(selectedId, 'relationship'); }
      else if (selectedId && event.altKey && event.shiftKey && key === 'b') { event.preventDefault(); quickActionRef.current(selectedId, 'boundary'); }
      else if (selectedId && event.altKey && event.shiftKey && key === 's') { event.preventDefault(); quickActionRef.current(selectedId, 'summary'); }
      else if (selectedId && event.altKey && event.shiftKey && key === 'm') { event.preventDefault(); quickActionRef.current(selectedId, 'move-branch'); }
      else if (selectedId && event.altKey && key === 'enter') { event.preventDefault(); quickActionRef.current(selectedId, 'same-style'); }
      else if (event.key === 'Tab' && selectedId && selectedIds.length === 1) { event.preventDefault(); addChild(selectedId); }
      else if (event.key === 'Enter' && selected?.parentId && selectedIds.length === 1) { event.preventDefault(); addChild(selected.parentId); }
      else if (event.key === 'Delete' && selectedBoundary) { event.preventDefault(); deleteSelectedBoundary(); }
      else if (event.key === 'Delete' && selectedIds.length > 1) { event.preventDefault(); removeMany(); }
      else if (event.key === 'Delete' && selectedId) { event.preventDefault(); removeNode(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, addChild, selectedId, selectedIds, selected, selectedBoundary, deleteSelectedBoundary, removeNode, removeMany, active, selectMany, flushSaves]);
  const exportFile = async (kind: 'png' | 'pdf' | 'md' | 'json', scope: 'all' | 'selection' = 'all') => {
    if (!active) return;
    if (scope === 'selection' && !selectedIds.length) { window.alert('Selecione pelo menos um nó para exportar.'); return; }
    const exported = scope === 'selection' ? selectionForExport(active, selectedIds) : active;
    const name = safeName(exported.title);
    setExportOpen(false);
    if (kind === 'md') { download(`${name}.md`, new Blob([toMarkdown(exported)], { type: 'text/markdown;charset=utf-8' })); return; }
    if (kind === 'json') { download(`${name}.json`, new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' })); return; }
    if (kind === 'pdf') setPdfBusy(true);
    try {
      if (scope === 'selection' && viewMode !== 'map') throw new Error('Abra o mapa para exportar a seleção como imagem ou PDF.');
      if (viewMode === 'map') flowRef.current?.fit();
      await new Promise(resolve => setTimeout(resolve, 500));
      const surface = document.querySelector(viewMode === 'map' ? '.canvas-surface .react-flow' : '.alternate-view') as HTMLElement | null;
      if (!surface) throw new Error('O mapa ainda não está pronto para exportar.');
      const editorChrome = ['react-flow__minimap', 'react-flow__controls', 'node-quick-toolbar', 'node-add', 'node-collapse', 'node-handle', 'react-flow__resize-control', 'node-resize-grip'];
      const selected = new Set(exported.nodes.map(node => node.id));
      const selectedEdges = new Set(exported.nodes.filter(node => node.parentId).map(node => `${node.parentId}-${node.id}`));
      exported.relationships?.forEach(link => selectedEdges.add(link.id));
      const image = await toPng(surface, { backgroundColor: dark ? '#161625' : '#f8f9fd', pixelRatio: 2, filter: node => {
        if (!(node instanceof Element)) return true;
        if (editorChrome.some(name => node.classList.contains(name))) return false;
        if (scope === 'selection' && node.classList.contains('branch-annotation')) return false;
        if (scope === 'selection' && node.classList.contains('react-flow__node')) return selected.has(node.getAttribute('data-id') || '');
        if (scope === 'selection' && node.classList.contains('react-flow__edge')) return selectedEdges.has(node.getAttribute('data-id') || '');
        return true;
      } });
      if (kind === 'png' && scope === 'all') { const response = await fetch(image); download(`${name}.png`, await response.blob()); return; }
      // Crop the viewport to the visible topics so PDF paper is spent on the map.
      const surfaceRect = surface.getBoundingClientRect();
      const topicRects = [...surface.querySelectorAll('.react-flow__node')].filter(element => scope !== 'selection' || selected.has(element.getAttribute('data-id') || '')).map(element => element.getBoundingClientRect()).filter(rect => rect.width && rect.height);
      const left = topicRects.length ? Math.max(0, Math.min(...topicRects.map(rect => rect.left - surfaceRect.left)) - 48) : 0;
      const top = topicRects.length ? Math.max(0, Math.min(...topicRects.map(rect => rect.top - surfaceRect.top)) - 48) : 0;
      const right = topicRects.length ? Math.min(surface.clientWidth, Math.max(...topicRects.map(rect => rect.right - surfaceRect.left)) + 48) : surface.clientWidth;
      const bottom = topicRects.length ? Math.min(surface.clientHeight, Math.max(...topicRects.map(rect => rect.bottom - surfaceRect.top)) + 48) : surface.clientHeight;
      const source = new Image(); source.src = image; await source.decode();
      const scaleX = source.naturalWidth / surface.clientWidth, scaleY = source.naturalHeight / surface.clientHeight;
      const cropped = document.createElement('canvas'); cropped.width = Math.max(1, Math.round((right - left) * scaleX)); cropped.height = Math.max(1, Math.round((bottom - top) * scaleY));
      const context = cropped.getContext('2d'); if (!context) throw new Error('Não foi possível preparar a página PDF.');
      context.drawImage(source, left * scaleX, top * scaleY, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
      if (kind === 'png') { const blob = await new Promise<Blob | null>(resolve => cropped.toBlob(resolve, 'image/png')); if (!blob) throw new Error('Não foi possível criar a imagem.'); download(`${name}.png`, blob); return; }
      const page = pdfPageDimensions(pdfSize, pdfOrientation, pdfWidth, pdfHeight, cropped.width / cropped.height);
      const placement = pdfImagePlacement(page.width, page.height, cropped.width, cropped.height);
      const pdf = new jsPDF({ orientation: page.width >= page.height ? 'landscape' : 'portrait', unit: 'mm', format: [page.width, page.height], compress: true });
      pdf.addImage(cropped.toDataURL('image/png'), 'PNG', placement.x, placement.y, placement.width, placement.height);
      pdf.save(`${name}.pdf`);
      setPdfOpen(false);
    } catch (error) { window.alert(error instanceof Error ? error.message : 'Não foi possível exportar o mapa.'); }
    finally { setPdfBusy(false); }
  };
  const paperPreview = (() => { try { return pdfPageDimensions(pdfSize, pdfOrientation, pdfWidth, pdfHeight, pdfAspect); } catch { return null; } })();
  const openPdfExport = (scope: 'all' | 'selection') => { const rect = document.querySelector('.canvas-surface .react-flow__nodes')?.getBoundingClientRect(); setPdfAspect(rect?.height ? rect.width / rect.height : 1.4); setPdfScope(scope); setPdfOpen(true); setExportOpen(false); };
  const share = async () => { if (!active) return; if (localMode) { setShareOpen(true); return; } try { const result = await api<{ shareToken: string }>(`/api/maps/${active.id}`, { method: 'POST' }); setMaps(current => current.map(m => m.id === active.id ? { ...m, shareToken: result.shareToken } : m)); setShareOpen(true); } catch { setStatus('error'); } };
  const shareUrl = localMode && active ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/local#${encodeURIComponent(JSON.stringify(active))}` : active?.shareToken ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${active.shareToken}` : '';
  const patchRelationship = (patch: Partial<NonNullable<MindMap['relationships']>[number]>) => { if (active && selectedEdgeId) commit({ ...active, relationships: active.relationships?.map(link => link.id === selectedEdgeId ? { ...link, ...patch } : link) }); };
  const deleteRelationship = () => { if (active && selectedEdgeId) { commit({ ...active, relationships: active.relationships?.filter(link => link.id !== selectedEdgeId) }); setSelectedEdgeId(null); } };
  const selectCanvasNode = (id: string | null) => {
    setSelectedEdgeId(null);
    if (relationSourceId && active && id && id !== relationSourceId) { commit({ ...active, relationships: [...(active.relationships || []), { id: uid(), source: relationSourceId, target: id, label: active.layout === 'concept' ? 'relaciona-se' : undefined }] }); setRelationSourceId(null); selectMany([id]); return; }
    if (!id) setRelationSourceId(null); selectMany(id ? [id] : []);
  };
  const selectCanvasEdge = (id: string) => { selectMany([]); setSelectedEdgeId(id); };
  const selectCanvasBoundary = (selection: BoundarySelection) => { selectMany([]); setRelationSourceId(null); setSelectedBoundary(selection); };
  const commands: EditorCommand[] = [
    { label: 'Novo mapa', action: () => { void addMap(); } },
    { label: 'Perguntar à IA: ideias para o nó', action: () => { const node = selected || active?.nodes.find(item => !item.parentId); if (node) void requestAi(node, 'ideas'); }, disabled: !active || aiBusy },
    { label: 'Salvar agora', shortcut: 'Ctrl+S', action: () => { void flushSaves(); }, disabled: !active },
    { label: 'Fazer uma cópia', action: () => { if (active) void duplicateMap(active); }, disabled: !active },
    { label: 'Renomear mapa', action: () => { if (!active) return; const title = window.prompt('Nome do mapa:', active.title)?.trim(); if (title) commit({ ...active, title }); }, disabled: !active },
    { label: 'Importar arquivo', action: () => importRef.current?.click() },
    { label: 'Exportar PNG', action: () => { void exportFile('png'); }, disabled: !active },
    { label: 'Exportar PDF', action: () => openPdfExport('all'), disabled: !active },
    { label: 'Exportar Markdown', action: () => { void exportFile('md'); }, disabled: !active },
    { label: 'Exportar apenas seleção', action: () => { void exportFile('png', 'selection'); }, disabled: !selectedIds.length },
    { label: 'Ver como mapa', action: () => setViewMode('map'), disabled: !active },
    { label: 'Ver como esquema', action: () => setViewMode('outline'), disabled: !active },
    { label: 'Ver como Gantt', action: () => setViewMode('gantt'), disabled: !active },
    { label: 'Organizar mapa', action: () => applyLayout(active?.layout === 'network' || active?.layout === 'free' ? 'horizontal' : active?.layout || 'horizontal'), disabled: !active },
    { label: 'Desfazer', shortcut: 'Ctrl+Z', action: undo, disabled: !history.past.length },
    { label: 'Refazer', shortcut: 'Ctrl+Y', action: redo, disabled: !history.future.length },
    { label: 'Abrir painel lateral', action: () => setSidebar(true) },
  ];
  return <div className={`app-shell ${dark ? 'dark' : ''}`}>
    <aside className={`sidebar ${sidebar ? '' : 'sidebar-closed'}`}><div className="brand"><span className="brand-symbol"><Sparkles size={19}/></span><span>nodum<span className="brand-dot">.</span></span><button className="icon-button close-sidebar" onClick={() => setSidebar(false)} aria-label="Fechar menu"><ChevronLeft size={18}/></button></div><Link className="sidebar-dashboard-link" href="/dashboard"><House size={15}/> Visão geral de projetos</Link>
      <button className="new-map" onClick={() => addMap()}><Plus size={18}/> Novo mapa <span>+</span></button>
      <WorkspaceNavigator workspace={workspace} maps={maps} activeId={activeId} search={search} onSearch={setSearch} selectedTagId={selectedTagId} onSelectTag={setSelectedTagId} onOpen={switchMap} onCreateMap={(projectId, folderId) => { void addMap(undefined, projectId, folderId); }} onCreateProject={createProject} onRenameProject={renameProject} onDeleteProject={id => { void deleteProject(id); }} onCreateFolder={createFolder} onRenameFolder={renameFolder} onDeleteFolder={id => { void deleteFolder(id); }} onMoveMap={moveMap} onDuplicate={duplicateMap} onDeleteMap={deleteMap} onUpload={(projectId, folderId, file) => { void uploadFile(projectId, folderId, file); }} onDownload={file => { void downloadFile(file); }} onDeleteFile={file => { void deleteFile(file); }} onCreateTag={createTag} onUpdateTag={(id, patch) => { void updateTag(id, patch); }} onDeleteTag={id => { void deleteTag(id); }}/>
      <div className="sidebar-section templates"><button className="templates-toggle" aria-expanded={templatesOpen} onClick={() => setTemplatesOpen(value => !value)}><span>TEMPLATES</span>{templatesOpen ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}</button>{templatesOpen && <div className="templates-list"><button onClick={() => addMap('projeto')}><span className="template-icon lavender">◈</span>Planejamento de projeto<ArrowRight size={14}/></button><button onClick={() => addMap('brainstorming')}><span className="template-icon yellow">✳</span>Brainstorming<ArrowRight size={14}/></button><button onClick={() => addMap('swot')}><span className="template-icon mint">▦</span>Análise SWOT<ArrowRight size={14}/></button></div>}</div>
      <div className="sidebar-bottom"><div className="tip-card"><span>✦ DICA RÁPIDA</span><p>Selecione uma ideia e pressione <kbd>Tab</kbd> para criar um subnó.</p></div><div className="profile"><span className="avatar">{userName.charAt(0).toUpperCase()}</span><span className="profile-name">{userName}</span>{!localMode && <a href={signOutPath} onClick={signOut} target="_top" title="Sair"><LogOut size={16}/></a>}</div></div>
    </aside>
    <main className="main-area">{preferenceError && <div role="alert" className="preferences-error">Não foi possível salvar suas preferências na conta. Altere uma opção para tentar novamente.</div>}<header className="toolbar"><div className="toolbar-left">{!sidebar && <CompactEditorNav map={active} maps={maps} projects={workspace.projects} onOpen={switchMap} onOpenSidebar={() => setSidebar(true)} commands={commands}/>}{mapTrail.length > 0 && <button type="button" className="linked-map-back" title="Voltar ao mapa de origem" onClick={returnToLinkedSource}><ChevronLeft size={15}/> Voltar para {maps.find(map => map.id === mapTrail.at(-1)?.mapId)?.title || "mapa de origem"}</button>}<Link className="crumb" href="/dashboard">Meus mapas</Link><span className="crumb-sep">/</span>{active ? <input className="map-title" aria-label="Nome do mapa" value={active.title} onChange={e => commit({ ...active, title: e.target.value })} /> : <span className="map-title placeholder">Bem-vindo</span>}<span className={`save-status ${displayedStatus}`}>{displayedStatus === 'saving' ? <LoaderCircle size={13} className="spin"/> : displayedStatus === 'error' ? <AlertCircle size={13}/> : <Check size={13}/>} {displayedStatus === 'saving' ? 'Salvando' : displayedStatus === 'error' ? 'Falha ao salvar' : displayedStatus === 'loading' ? 'Carregando' : (localMode ? 'Salvo neste navegador' : 'Salvo na nuvem')}</span></div><div className="toolbar-right"><div className="view-switch" role="group" aria-label="Visualização do mapa"><button className={viewMode === 'map' ? 'active' : ''} onClick={() => setViewMode('map')}>Mapa</button><button className={viewMode === 'outline' ? 'active' : ''} onClick={() => setViewMode('outline')}>Esquema</button><button className={viewMode === 'gantt' ? 'active' : ''} onClick={() => setViewMode('gantt')}>Gantt</button></div><select className="view-select" aria-label="Visualização" value={viewMode} onChange={event => setViewMode(event.target.value as 'map' | 'outline' | 'gantt')}><option value="map">Mapa</option><option value="outline">Esquema</option><option value="gantt">Gantt</option></select><button className="icon-button" title="Desfazer" disabled={!history.past.length} onClick={undo}><Undo2 size={18}/></button><button className="icon-button" title="Refazer" disabled={!history.future.length} onClick={redo}><Redo2 size={18}/></button><span className="toolbar-divider"/><button className="icon-button" title={dark ? 'Tema claro' : 'Tema escuro'} onClick={() => setDark(!dark)}>{dark ? <Sun size={18}/> : <Moon size={18}/>}</button><input ref={importRef} type="file" accept=".json,.mom,.pmom,.txt,.md,.markdown,application/json,text/plain,text/markdown" hidden onChange={e => importJson(e.target.files?.[0])}/><button className="outline-button" onClick={() => importRef.current?.click()}><ArrowUpFromLine size={16}/> Importar</button><div className="dropdown-wrap"><button className="outline-button" disabled={!active} onClick={() => setExportOpen(!exportOpen)}><ArrowDownToLine size={16}/> Exportar <ChevronDown size={14}/></button>{exportOpen && <div className="dropdown-menu"><button onClick={() => exportFile('png')}>Imagem PNG</button><button onClick={() => openPdfExport('all')}>Documento PDF</button><button onClick={() => exportFile('md')}>Markdown</button><button onClick={() => exportFile('json')}>Arquivo JSON</button>{selectedIds.length > 0 && <><div className="dropdown-section-title">Apenas seleção ({selectedIds.length})</div><button onClick={() => exportFile('png', 'selection')}>Seleção em PNG</button><button onClick={() => openPdfExport('selection')}>Seleção em PDF</button><button onClick={() => exportFile('md', 'selection')}>Seleção em Markdown</button><button onClick={() => exportFile('json', 'selection')}>Seleção em JSON</button></>}</div>}</div><div className="dropdown-wrap"><button className="outline-button drive-button" disabled={driveBusy} onClick={() => setDriveOpen(!driveOpen)} title="Google Drive"><Cloud size={16}/> {driveBusy ? 'Processando…' : 'Drive'} <ChevronDown size={14}/></button>{driveOpen && <div className="dropdown-menu">{!driveConfigured() && <p className="drive-setup">Conecte o Google Cloud para ativar o Drive. Veja o README.</p>}<button disabled={!driveConfigured()} onClick={importFromDrive}>Importar do Drive (.json, .mom, .pmom, .txt, .md)</button><button disabled={!driveConfigured() || !active} onClick={backupToDrive}>Exportar cópia para o Drive (.json)</button></div>}</div><button className="share-button" disabled={!active} onClick={share}><Share2 size={16}/> Compartilhar</button></div></header>
      {active ? <div className="workspace"><div className="canvas-wrap"><div className="canvas-top"><div className={movementNotice ? "canvas-badge canvas-notice" : "canvas-badge"} title={movementNotice || undefined}><span className="pulse-dot"/> {movementNotice ? movementNotice : temporaryBranchId ? 'Arraste o nó para mover o ramo inteiro' : relationSourceId ? 'Clique em outro nó para criar a relação' : selectedIds.length > 1 ? `${selectedIds.length} nós selecionados · Ctrl+clique para alternar` : 'Ctrl+clique ou Ctrl+arraste para selecionar vários nós'}</div><div className="canvas-actions"><button className={grid ? 'active' : ''} onClick={() => setGrid(!grid)} title="Alternar grade"><Grid3X3 size={17}/></button><span/><button onClick={() => flowRef.current?.zoomOut()} title="Diminuir zoom"><ZoomOut size={17}/></button><button onClick={() => flowRef.current?.zoomIn()} title="Aumentar zoom"><ZoomIn size={17}/></button></div></div>{viewMode === 'map' ? <MapCanvas map={active} previewNodes={groupResizePreview?.nodes} resizingGroup={Boolean(groupResizePreview)} globalMovementMode={globalMovementMode} globalAvoidOverlap={globalAvoidOverlap} temporaryBranchId={temporaryBranchId} onTemporaryBranchDone={() => setTemporaryBranchId(null)} onMoveNotice={setMovementNotice} selectedId={selectedId} selectedIds={selectedIds} selectedBoundary={selectedBoundary} onSelectBoundary={selectCanvasBoundary} onSelect={selectCanvasNode} onSelectMany={selectMany} onSelectEdge={selectCanvasEdge} onChange={commit} onGeometryChange={map => commit(map, false)} onAdd={addChild} onEdit={editNode} onToggle={toggleNode} onResizeStart={resizeGroupStart} onResizePreview={(dx, dy) => setGroupResizeDelta({ dx, dy })} onResizeEnd={resizeGroupEnd} onResizeCancel={resizeGroupCancel} onAction={quickAction} onOpenLinkedMaps={openLinkedFromIndicator} onVisual={applyVisual} onOpenQuick={openQuickPanel} quickPanel={quickPanel} fonts={fonts} onImportFont={importFontForNode} onFavoriteIcons={setFavoriteIcons} onPatch={patchNodeById} onImage={quickImage} onDrivePick={quickDrivePick} tags={workspace.tags} onTagToggle={toggleTag} onCreateTag={createAndApplyTag} alwaysToolbar={alwaysToolbar} onToggleAlwaysToolbar={toggleAlwaysToolbar} grid={grid} flowRef={flowRef}/> : <MapAlternateView map={active} mode={viewMode} onView={setViewMode} onPatch={patchNodeById} onToggle={toggleNode}/>}<div className="canvas-bottom"><span>{active.nodes.length} ideias <span className="bullet">·</span> {active.nodes.filter(n => n.parentId).length} conexões</span><MovementSettings map={active} globalMode={globalMovementMode} globalAvoidOverlap={globalAvoidOverlap} onGlobalMode={setGlobalMovementMode} onGlobalAvoidOverlap={setGlobalAvoidOverlap} onMapPatch={patch => commit({ ...active, ...patch })}/><div className="layout-control"><button onClick={() => applyLayout('bilateral')} className={active.layout === 'bilateral' ? 'active' : ''}>Bilateral</button><button onClick={() => applyLayout('horizontal')} className={active.layout === 'horizontal' ? 'active' : ''}>Horizontal</button><button onClick={() => applyLayout('network')} className={active.layout === 'network' ? 'active' : ''}>Livre</button><button onClick={() => flowRef.current?.fit()} title="Ajustar mapa à tela" aria-label="Ajustar mapa à tela"><Maximize size={15}/></button></div><div className="node-size-shortcuts" role="group" aria-label="Igualar dimensões dos nós selecionados"><button type="button" disabled={selectedIds.length < 2} title="Igualar larguras pela maior largura selecionada" onClick={() => applyVisual(selectedIds, 'selection', 'uniform-width')}><ArrowLeftRight size={15}/><span>Igualar largura</span></button><button type="button" disabled={selectedIds.length < 2} title="Igualar alturas pela maior altura selecionada" onClick={() => applyVisual(selectedIds, 'selection', 'uniform-height')}><ArrowUpDown size={15}/><span>Igualar altura</span></button></div><StyleCopyControls canCopy={selectedIds.length === 1} canPaste={styleCopied && selectedIds.length > 0} onCopy={copyFormatting} onPaste={pasteFormatting}/><button className="organize" onClick={() => applyLayout(active.layout === 'network' || active.layout === 'free' ? 'horizontal' : active.layout)}><WandSparkles size={15}/> Organizar</button></div></div>
        {viewMode === 'map' && selectedNodes.length > 1 && <MultiNodeToolbar map={active} nodes={selectedNodes} fonts={fonts} favoriteIcons={active.favoriteIcons || []} onPatch={patchMany} onImportFont={importFontForMany} onFavoriteIcons={setFavoriteIcons} onAlign={alignMany} onVisual={(scope, operation, value, styleGroups) => applyVisual(selectedIds, scope, operation, value, styleGroups)} onDelete={removeMany} onBoundary={() => toggleBoundary(selectedIds)} onClear={() => selectMany([])}/>}
        {viewMode === 'map' && selectedBoundary && active && boundaryExists(active, selectedBoundary) && <BoundaryToolbar tags={workspace.tags} assigned={boundaryTagIds(active, selectedBoundary)} onToggleTag={toggleSelectedBoundaryTag} onCreateTag={createSelectedBoundaryTag} onDelete={deleteSelectedBoundary} onClose={() => setSelectedBoundary(null)}/>}
        {viewMode === 'map' && selectedRelationship && <RelationshipQuickToolbar relation={selectedRelationship} onPatch={patchRelationship} onDelete={deleteRelationship} onClose={() => setSelectedEdgeId(null)}/>}
      </div> : <div className="empty-workspace"><div className="empty-illustration"><span>✦</span><span>✧</span><span>✦</span></div><p className="eyebrow">SEU ESPAÇO CRIATIVO</p><h1>Ideias incríveis começam aqui.</h1><p>Transforme pensamentos soltos em conexões claras.<br/>Crie seu primeiro mapa ou comece com um template.</p><button className="share-button" onClick={() => addMap()}><Plus size={17}/> Criar meu primeiro mapa</button><button className="import-empty" onClick={() => importRef.current?.click()}>Importar Mindomo (.mom/.pmom), TXT ou Markdown</button></div>}
    </main>
    {active && linkNode && <MapLinksDialog source={active} node={linkNode} maps={maps} projects={workspace.projects} onClose={() => setLinkNodeId(null)} onOpen={targetId => openLinkedMap(linkNode.id, targetId)} onLink={targetId => changeMapLink(linkNode.id, targetId, true)} onUnlink={targetId => changeMapLink(linkNode.id, targetId, false)} onCreate={title => createLinkedMap(linkNode.id, title)}/>}
    {aiBusy && <div className="ai-status" role="status"><LoaderCircle size={16} className="spin"/> Gemini está preparando sugestões…</div>}
    {pdfOpen && <div className="modal-backdrop" onMouseDown={() => !pdfBusy && setPdfOpen(false)}><div className="share-modal pdf-modal" role="dialog" aria-modal="true" aria-label="Exportar PDF" onMouseDown={event => event.stopPropagation()}><button className="modal-close" disabled={pdfBusy} onClick={() => setPdfOpen(false)} aria-label="Fechar"><X size={19}/></button><h2>Exportar PDF</h2><p>Escolha o papel. O mapa inteiro será ajustado em uma página, sem alterar sua organização.</p><div className="pdf-options"><label>Formato<select value={pdfSize} onChange={event => setPdfSize(event.target.value as PdfPaperSize)}>{Object.keys(pdfPaperSizes).map(size => <option key={size} value={size}>{size}</option>)}<option value="custom">Personalizado</option></select></label><label>Orientação<select value={pdfOrientation} onChange={event => setPdfOrientation(event.target.value as PdfOrientation)}><option value="auto">Automática</option><option value="landscape">Paisagem</option><option value="portrait">Retrato</option></select></label></div>{pdfSize === 'custom' && <div className="pdf-options"><label>Largura (mm)<input type="number" min="50" max="2000" step="1" value={pdfWidth} onChange={event => setPdfWidth(Number(event.target.value))}/></label><label>Altura (mm)<input type="number" min="50" max="2000" step="1" value={pdfHeight} onChange={event => setPdfHeight(Number(event.target.value))}/></label></div>}<div className="pdf-preview"><div className="pdf-preview-page" style={{ aspectRatio: paperPreview ? `${paperPreview.width} / ${paperPreview.height}` : '1 / 1' }}><span>Mapa mental</span></div><span>{paperPreview ? `${paperPreview.width} × ${paperPreview.height} mm · 1 página` : 'Informe medidas entre 50 e 2.000 mm'}</span></div><div className="ai-modal-actions"><button className="outline-button" disabled={pdfBusy} onClick={() => setPdfOpen(false)}>Cancelar</button><button className="share-button" disabled={!paperPreview || pdfBusy} onClick={() => exportFile('pdf', pdfScope)}>{pdfBusy ? <LoaderCircle size={16} className="spin"/> : <ArrowDownToLine size={16}/>} {pdfBusy ? 'Preparando…' : 'Baixar PDF'}</button></div></div></div>}
    {aiProposal && <div className="modal-backdrop" onMouseDown={() => setAiProposal(null)}><div className="share-modal ai-modal" onMouseDown={e => e.stopPropagation()}><button className="modal-close" onClick={() => setAiProposal(null)} aria-label="Fechar"><X size={19}/></button><h2>Revise as sugestões da IA</h2><p>O conteúdo pode conter erros. Ele só será salvo no mapa quando você aplicar.</p>{aiProposal.action === 'ai-summary' ? <textarea value={aiProposal.summary} onChange={e => setAiProposal({ ...aiProposal, summary: e.target.value })} maxLength={500} rows={6} aria-label="Resumo sugerido"/> : <div className="ai-items">{aiProposal.items.map((item, index) => <input key={index} value={item} maxLength={140} aria-label={`Sugestão ${index + 1}`} onChange={e => setAiProposal({ ...aiProposal, items: aiProposal.items.map((value, i) => i === index ? e.target.value : value) })}/>)}</div>}<div className="ai-modal-actions"><button className="outline-button" onClick={() => setAiProposal(null)}>Cancelar</button><button className="share-button" onClick={applyAi}>Aplicar ao mapa</button></div></div></div>}
    {shareOpen && active && <div className="modal-backdrop" onMouseDown={() => setShareOpen(false)}><div className="share-modal" onMouseDown={e => e.stopPropagation()}><button className="modal-close" onClick={() => setShareOpen(false)}><X size={19}/></button><h2>Compartilhe suas ideias</h2><p>{localMode ? 'Link de teste: contém uma cópia do mapa e só abre enquanto o servidor local estiver ligado.' : 'Quem tiver este link poderá visualizar o mapa, sem editar.'}</p><label className="field-label">LINK DE VISUALIZAÇÃO</label><div className="copy-field"><input readOnly value={shareUrl}/><button onClick={async () => { await navigator.clipboard.writeText(shareUrl); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }}>{linkCopied ? <Check size={16}/> : <Copy size={16}/>} {linkCopied ? 'Copiado' : 'Copiar'}</button></div></div></div>}
  </div>;
}



