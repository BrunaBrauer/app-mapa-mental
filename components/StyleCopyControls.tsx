'use client';
import { useState } from 'react';
import { ChevronDown, ClipboardPaste, Paintbrush } from 'lucide-react';

export default function StyleCopyControls({ canCopy, canPaste, onCopy, onPaste }: {
  canCopy: boolean; canPaste: boolean; onCopy: (includeDimensions: boolean) => void; onPaste: () => void;
}) {
  const [open, setOpen] = useState(false);
  return <div className="style-shortcuts">
    <div className="style-copy-wrap">
      <button type="button" className="organize" disabled={!canCopy} aria-expanded={open} title="Copiar formatação do nó selecionado" onClick={() => setOpen(value => !value)}><Paintbrush size={15}/> Copiar estilo <ChevronDown size={13}/></button>
      {open && <div className="style-copy-menu">
        <strong>Copiar formatação</strong>
        <button onClick={() => { onCopy(true); setOpen(false); }}>Copiar tudo <small>Inclui dimensões e linha</small></button>
        <button onClick={() => { onCopy(false); setOpen(false); }}>Copiar tudo, menos dimensões <small>Mantém os tamanhos do destino</small></button>
      </div>}
    </div>
    <button type="button" className="organize" disabled={!canPaste} title="Aplicar formatação copiada aos nós selecionados" onClick={onPaste}><ClipboardPaste size={15}/> Aplicar estilo</button>
  </div>;
}
