'use client';
import { useState } from 'react';
import { ChevronDown, ClipboardPaste, Paintbrush } from 'lucide-react';
import type { FormattingCopyMode } from '../lib/node-style';

export default function StyleCopyControls({ canCopy, canPaste, onCopy, onPaste }: {
  canCopy: boolean; canPaste: boolean; onCopy: (mode: FormattingCopyMode) => void; onPaste: () => void;
}) {
  const [open, setOpen] = useState(false);
  return <div className="style-shortcuts">
    <div className="style-copy-wrap">
      <button type="button" className="organize" disabled={!canCopy} aria-expanded={open} title="Copiar formatação do nó selecionado" onClick={() => setOpen(value => !value)}><Paintbrush size={15}/> Copiar estilo <ChevronDown size={13}/></button>
      {open && <div className="style-copy-menu">
        <strong>Copiar formatação</strong>
        <button onClick={() => { onCopy('all'); setOpen(false); }}>Copiar todas as propriedades <small>Estilo e tamanho</small></button>
        <button onClick={() => { onCopy('visual'); setOpen(false); }}>Copiar estilo visual <small>Cores do texto, preenchimento e borda</small></button>
        <button onClick={() => { onCopy('size'); setOpen(false); }}>Copiar tamanho <small>Dimensões do nó e tamanho da letra</small></button>
      </div>}
    </div>
    <button type="button" className="organize" disabled={!canPaste} title="Aplicar formatação copiada aos nós selecionados" onClick={onPaste}><ClipboardPaste size={15}/> Aplicar estilo</button>
  </div>;
}
