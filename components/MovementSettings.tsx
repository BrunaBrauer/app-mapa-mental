'use client';
import { useState } from 'react';
import { ChevronDown, Move } from 'lucide-react';
import type { MindMap, MovementMode } from '../types';

export const movementLabels: Record<MovementMode, string> = { individual: 'Individual', hierarchical: 'Hierárquico', automatic: 'Automático' };

export default function MovementSettings({ map, globalMode, globalAvoidOverlap, onGlobalMode, onGlobalAvoidOverlap, onMapPatch }: {
  map: MindMap;
  globalMode: MovementMode;
  globalAvoidOverlap: boolean;
  onGlobalMode: (mode: MovementMode) => void;
  onGlobalAvoidOverlap: (value: boolean) => void;
  onMapPatch: (patch: Partial<MindMap>) => void;
}) {
  const [open, setOpen] = useState(false);
  return <div className="movement-settings">
    <button className="movement-settings-trigger" onClick={() => setOpen(!open)} aria-expanded={open} title="Modo de movimentação e organização"><Move size={15}/> {movementLabels[map.movementMode || globalMode]} <ChevronDown size={13}/></button>
    {open && <div className="movement-settings-panel">
      <strong>Movimentação e organização</strong>
      <p>O modo controla o arraste. O layout controla a posição ao usar Organizar.</p>
      <label>Modo padrão da conta<select value={globalMode} onChange={event => onGlobalMode(event.target.value as MovementMode)}>{Object.entries(movementLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Modo deste mapa<select value={map.movementMode || 'inherit'} onChange={event => onMapPatch({ movementMode: event.target.value === 'inherit' ? undefined : event.target.value as MovementMode })}><option value="inherit">Usar padrão da conta</option>{Object.entries(movementLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="movement-check"><input type="checkbox" checked={globalAvoidOverlap} onChange={event => onGlobalAvoidOverlap(event.target.checked)}/> Evitar sobreposição por padrão</label>
      <label className="movement-check"><input type="checkbox" checked={map.avoidOverlap ?? globalAvoidOverlap} onChange={event => onMapPatch({ avoidOverlap: event.target.checked })}/> Evitar sobreposição neste mapa</label>
      <label className="movement-check"><input type="checkbox" checked={Boolean(map.siblingReorder)} onChange={event => onMapPatch({ siblingReorder: event.target.checked })}/> Reordenar subnós mantendo alinhamento</label>
      <small>Quando a reordenação está ligada, arraste um subnó entre seus irmãos para trocar a ordem sem alterar tamanhos ou estilos. Desligue para voltar ao posicionamento livre.</small>
      <small>O modo hierárquico move o nó e seus descendentes como um conjunto. Nós bloqueados impedem o arraste do ramo.</small>
    </div>}
  </div>;
}
