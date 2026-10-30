'use client';
import { useState } from 'react';
import { visualScopeIds, type VisualOperation, type VisualScope, type VisualStyleGroup } from '../lib/visual-standardization';
import type { MindMap } from '../types';
import { styleModels } from '../lib/style-models';

const scopes: { value: VisualScope; label: string }[] = [
  { value: 'selection', label: 'Seleção' }, { value: 'siblings', label: 'Irmãos' },
  { value: 'level', label: 'Nível inteiro' }, { value: 'branch', label: 'Ramo' }, { value: 'map', label: 'Mapa inteiro' },
];

export default function VisualStandardsPanel({ onApply, multiple = false, reference, map, selectedIds }: {
  onApply: (scope: VisualScope, operation: VisualOperation, value?: number, styleGroups?: VisualStyleGroup[]) => void;
  multiple?: boolean;
  reference: string;
  map: MindMap;
  selectedIds: string[];
}) {
  const [scope, setScope] = useState<VisualScope>(multiple ? 'selection' : 'siblings');
  const [width, setWidth] = useState(180);
  const [height, setHeight] = useState(60);
  const [styleGroups, setStyleGroups] = useState<VisualStyleGroup[]>(['fill','contour','shape','padding','text']);
  const [modelId, setModelId] = useState(styleModels[0].id);
  const count = visualScopeIds(map, selectedIds, scope).length;
  const run = (operation: VisualOperation, value?: number) => onApply(scope, operation, value);
  return <div className="visual-standards">
    <strong>Layout e organização</strong>
    <p>Referência: <b>{reference}</b>. As medidas usam o tamanho visível de cada nó e não alteram a hierarquia.</p>
    <label>Aplicar a<select value={scope} onChange={event => setScope(event.target.value as VisualScope)}>{scopes.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    <span className="visual-standards-count">{count} {count === 1 ? 'nó será afetado' : 'nós serão afetados'} · uma ação para desfazer</span>
    <span className="visual-standards-caption">Alinhamento horizontal</span>
    <div className="visual-standards-row"><button onClick={() => run('align-left')}>Esquerda</button><button onClick={() => run('align-center')}>Centro</button><button onClick={() => run('align-right')}>Direita</button></div>
    <button onClick={() => run('restore-alignment')}>Restaurar alinhamento padrão à esquerda</button>
    <span className="visual-standards-caption">Dimensões</span>
    <div className="visual-standards-grid"><button onClick={() => run('size-auto')}>Automático pelo conteúdo</button><button onClick={() => run('match-both')}>Igualar à referência</button><button onClick={() => run('uniform-both')}>Igualar ao maior</button><button onClick={() => run('smallest-both')}>Igualar ao menor</button><button onClick={() => run('uniform-width')}>Igualar larguras</button><button onClick={() => run('uniform-height')}>Igualar alturas</button><button onClick={() => run('match-width')}>Largura da referência</button><button onClick={() => run('match-height')}>Altura da referência</button><button onClick={() => run('width-auto')}>Largura automática</button><button onClick={() => run('height-auto')}>Altura automática</button><button onClick={() => run('restore-level-size')}>Restaurar tamanho do nível</button></div>
    <div className="visual-standards-exact"><label>Largura exata (px)<input type="number" min="80" max="800" value={width} onChange={event => setWidth(Number(event.target.value))}/><button onClick={() => run('fixed-width', width)}>Aplicar</button></label><label>Altura exata (px)<input type="number" min="36" max="500" value={height} onChange={event => setHeight(Number(event.target.value))}/><button onClick={() => run('fixed-height', height)}>Aplicar</button></label></div>
    <div className="quick-section-divider"/>
    <span className="visual-standards-caption">Copiar aparência da referência</span>
    <div className="visual-style-groups">{([['fill','Preenchimento'],['contour','Contorno e cantos'],['shape','Forma'],['padding','Espaçamento'],['text','Texto'],['dimensions','Dimensões']] as [VisualStyleGroup,string][]).map(([group,label]) => <label key={group}><input type="checkbox" checked={styleGroups.includes(group)} onChange={event => setStyleGroups(current => event.target.checked ? [...current, group] : current.filter(item => item !== group))}/>{label}</label>)}</div>
    <button disabled={!styleGroups.length} onClick={() => onApply(scope, 'copy-style', undefined, styleGroups)}>Aplicar propriedades marcadas</button>
    <button className="visual-standards-level" onClick={() => run('save-level-style')}>Usar estilo da referência neste nível ({visualScopeIds(map, selectedIds, 'level').length} nós)</button>
    <button onClick={() => run('restore-level-style')}>Restaurar estilo herdado no escopo</button>
    <small>O estilo do nível vale para nós existentes e futuros. Personalizações feitas depois permanecem ao atualizar o estilo.</small>
    <span className="visual-standards-caption">Modelos de formatação do mapa</span>
    <label>Modelo<select value={modelId} onChange={event => setModelId(event.target.value)}>{styleModels.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}</select></label>
    <small>{styleModels.find(model => model.id === modelId)?.description} O modelo substitui a formatação atual do mapa inteiro.</small>
    <button onClick={() => { if (window.confirm('Aplicar este modelo ao mapa inteiro? As formatações personalizadas serão substituídas. Você poderá desfazer a ação.')) onApply('map', `model:${modelId}`); }}>Aplicar modelo ao mapa</button>
  </div>;
}
