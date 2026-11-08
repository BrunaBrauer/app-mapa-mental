'use client';
import { useState } from 'react';
import { ArrowRight, Link2, Plus, Search, Trash2, X } from 'lucide-react';
import type { MindMap, MindNode } from '../types';
import { mapLinksForNode } from '../lib/map-links';

type Props = {
  source: MindMap;
  node: MindNode;
  maps: MindMap[];
  projects: { id: string; name: string }[];
  onClose: () => void;
  onOpen: (id: string) => void;
  onLink: (id: string) => void;
  onUnlink: (id: string) => void;
  onCreate: (title: string) => Promise<void>;
};

export default function MapLinksDialog({ source, node, maps, projects, onClose, onOpen, onLink, onUnlink, onCreate }: Props) {
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState(`${node.text.trim().slice(0, 90) || 'Assunto'} — detalhamento`);
  const [creating, setCreating] = useState(false);
  const links = mapLinksForNode(source, node.id, maps);
  const atLimit = links.length >= 20;
  const available = maps.filter(map => map.id !== source.id && !node.linkedMapIds?.includes(map.id) && map.title.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR')));
  const projectName = (map: MindMap) => projects.find(project => project.id === map.projectId)?.name;
  const create = async () => {
    if (!title.trim() || creating || atLimit) return;
    setCreating(true);
    try { await onCreate(title.trim().slice(0, 160)); } finally { setCreating(false); }
  };
  return <div className="map-links-overlay" onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="map-links-dialog" role="dialog" aria-modal="true" aria-labelledby="map-links-title" onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
      <header><div><span className="map-links-kicker">CONEXÕES ENTRE MAPAS</span><h2 id="map-links-title">Mapas vinculados</h2><p>Assunto: <strong>{node.text || 'Nó sem título'}</strong> · {source.title}</p></div><button className="map-links-close" aria-label="Fechar" onClick={onClose}><X size={19}/></button></header>
      <div className="map-links-body">
        <div className="map-links-section"><h3>Vínculos deste nó <span>{links.length}</span></h3>{links.length ? <div className="map-links-list">{links.map(link => <div className="map-links-item" key={link.id}><Link2 size={17}/><div><strong>{link.map?.title || 'Mapa indisponível'}</strong><small>{link.map ? projectName(link.map) || 'Sem projeto' : 'Este mapa foi excluído ou não está nesta conta'}</small></div>{link.map && <button onClick={() => onOpen(link.id)} title={`Abrir ${link.map!.title}`}>Abrir <ArrowRight size={15}/></button>}<button className="map-links-remove" onClick={() => onUnlink(link.id)} title="Remover somente o vínculo" aria-label={`Desvincular ${link.map?.title || 'mapa indisponível'}`}><Trash2 size={15}/></button></div>)}</div> : <p className="map-links-empty">Este nó ainda não possui mapas associados.</p>}</div>
        <div className="map-links-section"><h3>Criar mapa de detalhamento</h3><div className="map-links-create"><input autoFocus aria-label="Nome do novo mapa" maxLength={160} value={title} onChange={event => setTitle(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void create(); } }}/><button disabled={!title.trim() || creating || atLimit} onClick={() => void create()}><Plus size={16}/>{creating ? 'Criando…' : 'Criar e vincular'}</button></div><small>{atLimit ? 'Limite de 20 vínculos atingido. Remova um antes de adicionar outro.' : 'O novo mapa terá conteúdo, layout e configurações próprios.'}</small></div>
        <div className="map-links-section"><h3>Vincular mapa existente</h3><label className="map-links-search"><Search size={16}/><input aria-label="Pesquisar mapas existentes" placeholder="Pesquisar mapas da conta" value={query} onChange={event => setQuery(event.target.value)}/></label><div className="map-links-options">{available.slice(0, 40).map(map => <div className="map-links-item" key={map.id}><div><strong>{map.title}</strong><small>{projectName(map) || 'Sem projeto'}</small></div><button disabled={atLimit} onClick={() => onLink(map.id)}><Plus size={15}/> Vincular</button></div>)}{available.length === 0 && <p className="map-links-empty">Nenhum mapa disponível para vincular.</p>}{available.length > 40 && <small>Mostrando os primeiros 40 resultados. Refine a pesquisa para encontrar outro mapa.</small>}</div></div>
      </div><footer>Remover um vínculo não exclui o mapa associado. Até 20 mapas por nó.</footer>
    </section>
  </div>;
}
