'use client';
import { useRef, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Box, GitBranch, Move, MoveDiagonal2, Scan, Scaling, Trash2, Type, X } from 'lucide-react';
import type { ImportedFont } from '../lib/fonts';
import type { AlignCommand } from '../lib/movement';
import type { MindMap, MindNode } from '../types';
import type { VisualOperation, VisualScope, VisualStyleGroup } from '../lib/visual-standardization';
import { QuickLinePanel, QuickNodePanel, QuickTextPanel } from './QuickStylePanels';
import VisualStandardsPanel from './VisualStandardsPanel';

type Props = {
  map: MindMap;
  nodes: MindNode[];
  fonts: ImportedFont[];
  favoriteIcons: string[];
  onPatch: (patch: Partial<MindNode>) => void;
  onImportFont: (file: File) => Promise<void>;
  onFavoriteIcons: (icons: string[]) => void;
  onAlign: (command: AlignCommand) => void;
  onVisual: (scope: VisualScope, operation: VisualOperation, value?: number, styleGroups?: VisualStyleGroup[]) => void;
  onDelete: () => void;
  onBoundary: () => void;
  onClear: () => void;
  onResizeStart: () => void;
  onResizePreview: (dx: number, dy: number) => void;
  onResizeEnd: (dx: number, dy: number) => void;
  onResizeCancel: () => void;
};

export default function MultiNodeToolbar({ map, nodes, fonts, favoriteIcons, onPatch, onImportFont, onFavoriteIcons, onAlign, onVisual, onDelete, onBoundary, onClear, onResizeStart, onResizePreview, onResizeEnd, onResizeCancel }: Props) {
  const [panel, setPanel] = useState<'text' | 'node' | 'line' | 'arrange' | null>(null);
  const [resizeMode, setResizeMode] = useState(false);
  const [resizeDelta, setResizeDelta] = useState({ dx: 0, dy: 0 });
  const drag = useRef<{ x: number; y: number; zoom: number; dx: number; dy: number } | null>(null);
  const resizeMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return;
    const dx = Math.round((event.clientX - drag.current.x) / drag.current.zoom);
    const dy = Math.round((event.clientY - drag.current.y) / drag.current.zoom);
    drag.current.dx = dx; drag.current.dy = dy;
    setResizeDelta({ dx, dy }); onResizePreview(dx, dy);
  };
  const resizeStop = (cancel = false) => {
    if (!drag.current) return;
    const { dx, dy } = drag.current;
    drag.current = null; setResizeMode(false); setResizeDelta({ dx: 0, dy: 0 });
    if (cancel) onResizeCancel(); else onResizeEnd(dx, dy);
  };
  const exemplar = nodes.at(-1)!;
  const lineExemplar = nodes.find(node => node.parentId);
  // O menu aparece do lado oposto ao ramo selecionado para manter a prévia visível.
  const side = nodes.reduce((sum, node) => sum + node.x, 0) / nodes.length > 0 ? 'left' : 'right';
  return <div className={side === 'left' ? 'multi-selection-bar multi-left nodrag nopan nowheel' : 'multi-selection-bar nodrag nopan nowheel'} role="toolbar" aria-label={`Editar ${nodes.length} nós selecionados`}>
    <div className="multi-selection-main"><span className="multi-selection-count">{nodes.length} nós selecionados</span><span className="multi-selection-divider"/>
      <button className={panel === 'text' ? 'active' : ''} onClick={() => setPanel(panel === 'text' ? null : 'text')} title="Editar texto e ícones do grupo"><Type size={17}/> Texto</button>
      <button className={panel === 'node' ? 'active' : ''} onClick={() => setPanel(panel === 'node' ? null : 'node')} title="Editar nós do grupo"><Box size={17}/> Nó</button>
      <button className={resizeMode ? 'active' : ''} onClick={() => { setResizeMode(value => !value); setPanel(null); onResizeCancel(); }} title="Redimensionar todos os nós selecionados com um arraste"><Scaling size={17}/> Tamanho</button>
      <button className={panel === 'line' ? 'active' : ''} disabled={!lineExemplar} onClick={() => setPanel(panel === 'line' ? null : 'line')} title="Editar linhas do grupo"><GitBranch size={17}/> Linha</button>
      <button onClick={onBoundary} title="Criar ou remover limite dos nós selecionados e seus descendentes"><Scan size={17}/> Limite</button>
      <span className="multi-selection-divider"/><button onClick={() => onAlign('left')} title="Alinhar à esquerda" aria-label="Alinhar nós à esquerda"><AlignLeft size={17}/></button><button onClick={() => onAlign('center-x')} title="Centralizar horizontalmente" aria-label="Centralizar horizontalmente"><AlignCenter size={17}/></button><button onClick={() => onAlign('right')} title="Alinhar à direita" aria-label="Alinhar nós à direita"><AlignRight size={17}/></button><button className={panel === 'arrange' ? 'active' : ''} onClick={() => setPanel(panel === 'arrange' ? null : 'arrange')} title="Mais opções de alinhamento e distribuição"><Move size={16}/> Organizar</button>
      <span className="multi-selection-divider"/><button className="multi-danger" onClick={onDelete} title="Excluir nós selecionados"><Trash2 size={16}/></button><button onClick={onClear} title="Limpar seleção"><X size={17}/></button>
    </div>
    {resizeMode && <div className="multi-resize-control"><span>Arraste a alça para ajustar todos os nós · {resizeDelta.dx >= 0 ? '+' : ''}{resizeDelta.dx} px largura · {resizeDelta.dy >= 0 ? '+' : ''}{resizeDelta.dy} px altura</span><button type="button" aria-label="Arrastar para redimensionar todos os nós selecionados" title="Arraste para redimensionar todos os nós" onPointerDown={event => { event.preventDefault(); event.stopPropagation(); const viewport = document.querySelector('.react-flow__viewport'); const transform = viewport ? getComputedStyle(viewport).transform : 'none'; const zoom = transform !== 'none' ? new DOMMatrixReadOnly(transform).a || 1 : 1; drag.current = { x: event.clientX, y: event.clientY, zoom, dx: 0, dy: 0 }; event.currentTarget.setPointerCapture(event.pointerId); onResizeStart(); }} onPointerMove={resizeMove} onPointerUp={() => resizeStop()} onPointerCancel={() => resizeStop(true)}><MoveDiagonal2 size={19}/></button></div>}
    {panel && <div className="multi-selection-panel">{panel !== 'arrange' && <p className="multi-selection-hint">Os valores exibidos pertencem ao último nó selecionado. Cada alteração abaixo é aplicada a todos os nós selecionados.</p>}
      {panel === 'text' && <QuickTextPanel node={exemplar} fonts={fonts} favorites={favoriteIcons} onPatch={onPatch} onImportFont={onImportFont} onFavorites={onFavoriteIcons} batch/>}
      {panel === 'node' && <QuickNodePanel node={exemplar} onPatch={onPatch} batch/>}
      {panel === 'line' && lineExemplar && <QuickLinePanel node={lineExemplar} onPatch={onPatch} batch/>}
      {panel === 'arrange' && <><div className="multi-arrange"><strong>Alinhar e distribuir</strong><p>Nós bloqueados ficam no lugar. Cada comando pode ser desfeito.</p>{([
        ['left','Alinhar à esquerda'],['center-x','Centro horizontal'],['right','Alinhar à direita'],
        ['top','Alinhar ao topo'],['center-y','Centro vertical'],['bottom','Alinhar à base'],
        ['distribute-x','Distribuir horizontalmente'],['distribute-y','Distribuir verticalmente'],['uniform','Espaçamento uniforme'],
      ] as [AlignCommand,string][]).map(([command,label]) => <button key={command} onClick={() => onAlign(command)}>{label}</button>)}</div><div className="quick-section-divider"/><VisualStandardsPanel map={map} selectedIds={nodes.map(node => node.id)} multiple reference={exemplar.text} onApply={onVisual}/></>}
    </div>}
  </div>;
}
