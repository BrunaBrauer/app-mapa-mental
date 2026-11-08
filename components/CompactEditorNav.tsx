'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, FileText, Folder, Menu, Search } from 'lucide-react';
import type { MindMap } from '../types';
import type { Project } from '../lib/workspace';

export type EditorCommand = { label: string; shortcut?: string; action: () => void; disabled?: boolean };
type Props = { map: MindMap | null; maps: MindMap[]; projects: Project[]; onOpen: (id: string) => void; onOpenSidebar: () => void; commands: EditorCommand[] };

export default function CompactEditorNav({ map, maps, projects, onOpen, onOpenSidebar, commands }: Props) {
  const [panel, setPanel] = useState<'maps' | 'commands' | null>(null);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setPanel(null); };
    const keyboard = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPanel('commands'); setQuery(''); } if (event.key === 'Escape') setPanel(null); };
    document.addEventListener('pointerdown', outside); window.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('keydown', keyboard); };
  }, []);
  const project = projects.find(item => item.id === map?.projectId)?.name || 'Sem projeto';
  const run = (command: EditorCommand) => { setPanel(null); command.action(); };
  return <div className="compact-nav" ref={ref}><Link className="compact-nav-back" href="/dashboard" title="Voltar aos projetos" aria-label="Voltar aos projetos"><ArrowLeft size={17}/></Link><div className="compact-nav-map-wrap" onMouseEnter={() => setPanel(current => current === 'commands' ? current : 'maps')} onMouseLeave={() => setPanel(current => current === 'maps' ? null : current)}><button className="compact-nav-map" aria-expanded={panel === 'maps'} onClick={() => { setPanel(panel === 'maps' ? null : 'maps'); setQuery(''); }}><span><small>{project}</small><strong>{map?.title || 'Escolher mapa'}</strong></span><ChevronDown size={15}/></button>{panel === 'maps' && <div className="compact-nav-popover compact-map-popover"><label><Search size={15}/><input autoFocus placeholder="Pesquisar mapas ou projetos" value={query} onChange={event => setQuery(event.target.value)}/></label><div className="compact-map-list">{maps.filter(item => `${item.title} ${projects.find(project => project.id === item.projectId)?.name || ''}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))).map(item => <button key={item.id} className={item.id === map?.id ? 'active' : ''} onClick={() => { onOpen(item.id); setPanel(null); }}><FileText size={15}/><span><strong>{item.title}</strong><small><Folder size={11}/>{projects.find(project => project.id === item.projectId)?.name || 'Sem projeto'}</small></span></button>)}</div><button className="compact-nav-footer" onClick={() => { setPanel(null); onOpenSidebar(); }}>Abrir painel de projetos</button></div>}</div><div className="compact-command-wrap"><button className="compact-command-trigger" aria-label="Abrir comandos" aria-expanded={panel === 'commands'} onClick={() => { setPanel(panel === 'commands' ? null : 'commands'); setQuery(''); }}><Menu size={19}/></button>{panel === 'commands' && <div className="compact-nav-popover compact-command-popover"><label><Search size={15}/><input autoFocus placeholder="Pesquisar comandos" value={query} onChange={event => setQuery(event.target.value)}/></label><div className="compact-command-list">{commands.filter(command => command.label.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))).map(command => <button key={command.label} disabled={command.disabled} onClick={() => run(command)}>{command.label}{command.shortcut && <kbd>{command.shortcut}</kbd>}</button>)}</div></div>}</div></div>;
}
