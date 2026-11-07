'use client';
import { useState } from 'react';
import { Plus, Tag, Trash2, X } from 'lucide-react';
import type { TagDefinition } from '../types';

export default function BoundaryToolbar({ tags, assigned, onToggleTag, onCreateTag, onDelete, onClose }: {
  tags: TagDefinition[];
  assigned: string[];
  onToggleTag: (id: string) => void;
  onCreateTag: (name: string, color: string) => Promise<boolean>;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#7057e8');
  const [busy, setBusy] = useState(false);
  return <section className="boundary-toolbar" aria-label="Editar limite">
    <div className="boundary-toolbar-head"><strong>Limite selecionado</strong><button onClick={onClose} aria-label="Fechar edição do limite"><X size={15}/></button></div>
    <p>Clique na borda para selecionar. Pressione Delete para excluir.</p>
    <div className="boundary-toolbar-tags">{tags.map(tag => <label key={tag.id}><input type="checkbox" checked={assigned.includes(tag.id)} onChange={() => onToggleTag(tag.id)}/><Tag size={14} fill={tag.color} color={tag.color}/><span>{tag.name}</span></label>)}{!tags.length && <small>Nenhuma etiqueta criada.</small>}</div>
    <form className="boundary-toolbar-create" onSubmit={async event => { event.preventDefault(); if (!name.trim() || busy) return; setBusy(true); try { if (await onCreateTag(name, color)) setName(''); } finally { setBusy(false); } }}>
      <input aria-label="Nome da etiqueta do limite" placeholder="Nova etiqueta" value={name} maxLength={100} onChange={event => setName(event.target.value)}/>
      <div><input type="color" aria-label="Escolher cor da etiqueta" value={/^#[0-9a-f]{6}$/i.test(color) ? color : '#7057e8'} onChange={event => setColor(event.target.value)}/><input aria-label="Cor hexadecimal" value={color} maxLength={7} onChange={event => setColor(event.target.value)}/><button disabled={busy || !name.trim() || !/^#[0-9a-f]{6}$/i.test(color)}><Plus size={14}/> Criar</button></div>
    </form>
    <button className="boundary-toolbar-delete" onClick={onDelete}><Trash2 size={14}/> Excluir limite</button>
  </section>;
}
