'use client';
import { useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Box, GitBranch, Trash2, Type, X } from 'lucide-react';
import type { ImportedFont } from '../lib/fonts';
import type { MindNode } from '../types';
import { QuickLinePanel, QuickNodePanel, QuickTextPanel } from './QuickStylePanels';

type Props = {
  nodes: MindNode[];
  fonts: ImportedFont[];
  favoriteIcons: string[];
  onPatch: (patch: Partial<MindNode>) => void;
  onImportFont: (file: File) => Promise<void>;
  onFavoriteIcons: (icons: string[]) => void;
  onAlign: (edge: 'left' | 'center' | 'right') => void;
  onDelete: () => void;
  onClear: () => void;
};

export default function MultiNodeToolbar({ nodes, fonts, favoriteIcons, onPatch, onImportFont, onFavoriteIcons, onAlign, onDelete, onClear }: Props) {
  const [panel, setPanel] = useState<'text' | 'node' | 'line' | null>(null);
  const exemplar = nodes.at(-1)!;
  const lineExemplar = nodes.find(node => node.parentId);
  // O menu aparece do lado oposto ao ramo selecionado para manter a prévia visível.
  const side = nodes.reduce((sum, node) => sum + node.x, 0) / nodes.length > 0 ? 'left' : 'right';
  return <div className={side === 'left' ? 'multi-selection-bar multi-left nodrag nopan nowheel' : 'multi-selection-bar nodrag nopan nowheel'} role="toolbar" aria-label={`Editar ${nodes.length} nós selecionados`}>
    <div className="multi-selection-main"><span className="multi-selection-count">{nodes.length} nós selecionados</span><span className="multi-selection-divider"/>
      <button className={panel === 'text' ? 'active' : ''} onClick={() => setPanel(panel === 'text' ? null : 'text')} title="Editar texto e ícones do grupo"><Type size={17}/> Texto</button>
      <button className={panel === 'node' ? 'active' : ''} onClick={() => setPanel(panel === 'node' ? null : 'node')} title="Editar nós do grupo"><Box size={17}/> Nó</button>
      <button className={panel === 'line' ? 'active' : ''} disabled={!lineExemplar} onClick={() => setPanel(panel === 'line' ? null : 'line')} title="Editar linhas do grupo"><GitBranch size={17}/> Linha</button>
      <span className="multi-selection-divider"/><button onClick={() => onAlign('left')} title="Alinhar à esquerda" aria-label="Alinhar nós à esquerda"><AlignLeft size={17}/></button><button onClick={() => onAlign('center')} title="Alinhar ao centro" aria-label="Alinhar nós ao centro"><AlignCenter size={17}/></button><button onClick={() => onAlign('right')} title="Alinhar à direita" aria-label="Alinhar nós à direita"><AlignRight size={17}/></button>
      <span className="multi-selection-divider"/><button className="multi-danger" onClick={onDelete} title="Excluir nós selecionados"><Trash2 size={16}/></button><button onClick={onClear} title="Limpar seleção"><X size={17}/></button>
    </div>
    {panel && <div className="multi-selection-panel"><p className="multi-selection-hint">Os valores exibidos pertencem ao último nó selecionado. Cada alteração abaixo é aplicada a todos os nós selecionados.</p>
      {panel === 'text' && <QuickTextPanel node={exemplar} fonts={fonts} favorites={favoriteIcons} onPatch={onPatch} onImportFont={onImportFont} onFavorites={onFavoriteIcons} batch/>}
      {panel === 'node' && <QuickNodePanel node={exemplar} onPatch={onPatch} batch/>}
      {panel === 'line' && lineExemplar && <QuickLinePanel node={lineExemplar} onPatch={onPatch} batch/>}
    </div>}
  </div>;
}
