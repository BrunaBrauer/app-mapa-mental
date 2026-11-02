'use client';
import { useRef, useState, type RefObject } from 'react';
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Ban, Bold, CaseSensitive, Highlighter, Pipette, Italic, Minus, Plus, Strikethrough, Underline, Upload } from 'lucide-react';
import type { ImportedFont } from '../lib/fonts';
import type { MindNode } from '../types';
import RichTextEditor, { type RichTextEditorHandle } from './RichTextEditor';

const hex = /^#[0-9a-f]{6}$/i;
const textColors = ['#000000', '#ffffff', '#b91c1c', '#e7983f', '#f2c230', '#77ac62'];
const symbols = ['➔', '▶', '◀︎', '▷', '◁', '➽', '⏹︎', '☐', '◼︎', '◻︎', '◯', 'Ｏ', '⏺︎', '◉', '◎', '●', '○', '⏸︎', '№', 'º', '❰', '❱', '▌', '▏', '┃', '✦', '◆', '★', '✓', '💡', '🎯', '📌', '🚀', '🧩', '📚', '✅', '💬', '🌿', '⚡', '⭐', '❤️', '📈', '🎨', '🔑', '🛠️', '🌍', '🗂️', '💻', '👤', '🔔', '🏆', '🧭', '📝', '🔍', '⚙️', '💰', '🔒', '🎵', '☀️'];
const fontOptions = [['Lexend', 'Lexend, sans-serif'], ['Arial', 'Arial, sans-serif'], ['Arial Narrow', 'Arial Narrow, Liberation Sans Narrow, Arial, sans-serif'], ['Noto Serif', 'Noto Serif, Georgia, serif'], ['Georgia', 'Georgia, serif'], ['Times New Roman', 'Times New Roman, serif'], ['Verdana', 'Verdana, sans-serif'], ['Cambria', 'Cambria, serif'], ['Garamond', 'Garamond, serif'], ['Courier New', 'Courier New, monospace'], ['Comic Sans MS', 'Comic Sans MS, cursive']];

type Props = { node: MindNode; fonts: ImportedFont[]; favorites: string[]; onPatch: (patch: Partial<MindNode>) => void; onImportFont: (file: File) => Promise<void>; onFavorites: (icons: string[]) => void; batch?: boolean; inlineEditor?: RefObject<RichTextEditorHandle | null> };

export default function QuickTextPanel({ node, fonts, favorites, onPatch, onImportFont, onFavorites, batch = false, inlineEditor }: Props) {
  const upload = useRef<HTMLInputElement>(null);
  const textColorInput = useRef<HTMLInputElement>(null);
  const editor = useRef<RichTextEditorHandle>(null);
  const activeEditor = () => inlineEditor?.current ?? editor.current;
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importedName, setImportedName] = useState('');
  const [textColorDraft, setTextColorDraft] = useState<string | null>(null);
  const [textColorPreview, setTextColorPreview] = useState<string | null>(null);
  const [highlight, setHighlight] = useState('#ffff00');
  const [search, setSearch] = useState('');
  const [custom, setCustom] = useState('');
  const color = node.color && hex.test(node.color) ? node.color : '#20243b';
  const shownColor = textColorPreview ?? color;
  const available = [...new Set([...favorites, ...symbols])].filter(value => value.includes(search));
  const format = (name: 'bold' | 'italic' | 'underline' | 'strike', command: string) => {
    if (!batch && activeEditor()?.hasSelection()) activeEditor()?.command(command);
    else onPatch({ [name]: !node[name] });
  };
  const toggleFavorite = (value: string) => onFavorites(favorites.includes(value) ? favorites.filter(item => item !== value) : [...favorites, value]);
  const insert = (value: string) => { if (value && !batch) activeEditor()?.insert(value); };
  const paintText = (value: string) => {
    if (!hex.test(value)) return;
    setTextColorPreview(value);
    if (!batch && activeEditor()?.paintSelection(value)) return;
    onPatch({ color: value });
  };
  const paintHighlight = (value: string) => {
    if (!hex.test(value)) return;
    setHighlight(value);
    activeEditor()?.paintSelection(value, 'highlight');
  };
  const iconButton = (label: string, active: boolean, action: () => void, icon: React.ReactNode) => <button type="button" aria-label={label} title={label} className={active ? 'active' : ''} onMouseDown={event => event.preventDefault()} onClick={action}>{icon}</button>;

  return <div className="quick-style quick-text-panel">
    <div className="text-panel-top">
      <div className="text-font-control"><label className="quick-field">Fonte<select value={node.fontFamily || ''} onChange={event => onPatch({ fontFamily: event.target.value || undefined })}><option value="">Segoe UI (padrão)</option>{fontOptions.map(([name, family]) => <option key={name} value={family}>{name}</option>)}{fonts.map(font => <option key={font.id} value={font.family}>{font.name}</option>)}</select></label><button className="font-upload-shortcut" aria-label="Importar fonte" title="Importar fonte" disabled={importing} onClick={() => upload.current?.click()}><Upload size={19}/></button></div>
      <div className="quick-field"><span>Tamanho</span><div className="text-size-stepper"><button aria-label="Diminuir tamanho" onClick={() => onPatch({ fontSize: Math.max(8, (node.fontSize || 14) - 1) })}><Minus size={14}/></button><input type="number" min="8" max="96" aria-label="Tamanho da fonte" value={node.fontSize || 14} onChange={event => onPatch({ fontSize: Math.max(8, Math.min(96, Number(event.target.value) || 8)) })}/><button aria-label="Aumentar tamanho" onClick={() => onPatch({ fontSize: Math.min(96, (node.fontSize || 14) + 1) })}><Plus size={14}/></button></div></div>
    </div>
    <div className="text-panel-label">Cor da letra</div>
    <div className="text-color-row"><span className="text-color-icon" style={{ borderBottomColor: shownColor }}>A</span><label className="text-color-picker" style={{ background: shownColor }}><Plus size={14}/><input ref={textColorInput} type="color" aria-label="Personalizar cor da letra" value={shownColor} onInput={event => paintText(event.currentTarget.value)}/></label><input className="text-hex" aria-label="Código hexadecimal da cor da letra" maxLength={7} value={textColorDraft ?? shownColor} onChange={event => { setTextColorDraft(event.target.value); if (hex.test(event.target.value)) paintText(event.target.value); }} onBlur={() => setTextColorDraft(null)}/><button className="text-pipette" aria-label="Abrir seletor de cor" title="Abrir seletor de cor" onClick={() => textColorInput.current?.click()}><Pipette size={16}/></button>{textColors.map(value => <button key={value} className="text-color-swatch" aria-label={`Cor da letra ${value}`} title={value} style={{ background: value }} onClick={() => paintText(value)}/>)}</div>
    <input ref={upload} hidden type="file" accept=".woff,.woff2,.ttf,.otf" onChange={async event => { const file = event.target.files?.[0]; if (!file) return; try { setError(''); setImporting(true); await onImportFont(file); setImportedName(file.name); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao importar fonte.'); } finally { setImporting(false); } event.target.value = ''; }}/>
    <div className="quick-section-divider"/>
    <div className="text-panel-grid"><div><div className="text-panel-label">Estilos Tipográficos</div><div className="text-control-group"><button aria-label="Negrito" className={node.bold ? 'active' : ''} onMouseDown={event => event.preventDefault()} onClick={() => format('bold', 'bold')}><Bold/></button><button aria-label="Itálico" className={node.italic ? 'active' : ''} onMouseDown={event => event.preventDefault()} onClick={() => format('italic', 'italic')}><Italic/></button><button aria-label="Sublinhado" className={node.underline ? 'active' : ''} onMouseDown={event => event.preventDefault()} onClick={() => format('underline', 'underline')}><Underline/></button><button aria-label="Riscado" className={node.strike ? 'active' : ''} onMouseDown={event => event.preventDefault()} onClick={() => format('strike', 'strikeThrough')}><Strikethrough/></button></div></div><div><div className="text-panel-label">Marcação de Texto</div><div className="text-highlight-row"><button aria-label="Aplicar grifo" title="Aplicar grifo" onMouseDown={event => event.preventDefault()} onClick={() => activeEditor()?.command('hiliteColor', hex.test(highlight) ? highlight : '#ffff00')} className="text-highlight-apply"><Highlighter size={17}/></button><button aria-label="Sem preenchimento" title="Sem preenchimento" onMouseDown={event => event.preventDefault()} onClick={() => activeEditor()?.command('hiliteColor', 'transparent')} className="text-highlight-clear"><Ban size={18}/></button><label className="text-color-picker" style={{ background: hex.test(highlight) ? highlight : '#ffff00' }}><Plus size={14}/><input type="color" aria-label="Personalizar cor do grifo" value={hex.test(highlight) ? highlight : '#ffff00'} onInput={event => paintHighlight(event.currentTarget.value)}/></label><input className="text-hex" aria-label="Código hexadecimal do grifo" maxLength={7} value={highlight} onChange={event => { setHighlight(event.target.value); if (hex.test(event.target.value)) activeEditor()?.paintSelection(event.target.value, 'highlight'); }} onKeyDown={event => { if (event.key === 'Enter' && hex.test(highlight)) activeEditor()?.command('hiliteColor', highlight); }}/></div></div></div>
    <div className="text-panel-grid text-panel-secondary">
      <div><div className="text-panel-label">Alinhamento de Texto</div><div className="text-control-group">{iconButton('Alinhar à esquerda', (node.textAlign || 'left') === 'left', () => onPatch({ textAlign: 'left' }), <AlignLeft/>)}{iconButton('Centralizar', node.textAlign === 'center', () => onPatch({ textAlign: 'center' }), <AlignCenter/>)}{iconButton('Alinhar à direita', node.textAlign === 'right', () => onPatch({ textAlign: 'right' }), <AlignRight/>)}{iconButton('Justificar', node.textAlign === 'justify', () => onPatch({ textAlign: 'justify' }), <AlignJustify/>)}</div></div>
      <div><div className="text-panel-label">Case</div><div className="text-control-group">{iconButton('Texto normal', (node.textTransform || 'none') === 'none', () => onPatch({ textTransform: 'none' }), <CaseSensitive/>)}{iconButton('Maiúsculas', node.textTransform === 'uppercase', () => onPatch({ textTransform: 'uppercase' }), 'AA')}{iconButton('Minúsculas', node.textTransform === 'lowercase', () => onPatch({ textTransform: 'lowercase' }), 'aa')}</div></div>
    </div>
    <div className="text-panel-label">Espaçamento</div>
    <div className="text-spacing-controls">
      <label>Entre linhas<input type="number" min="1" max="2.5" step="0.1" aria-label="Espaçamento entre linhas" value={node.lineSpacing ?? 1.3} onChange={event => onPatch({ lineSpacing: Math.max(1, Math.min(2.5, Number(event.target.value) || 1)) })}/></label>
      <label>Entre letras (px)<input type="number" min="-2" max="12" step="0.1" aria-label="Espaçamento entre letras" value={node.letterSpacing ?? 0} onChange={event => onPatch({ letterSpacing: Math.max(-2, Math.min(12, Number(event.target.value) || 0)) })}/></label>
    </div>
    <button className="font-import-button" disabled={importing} onClick={() => upload.current?.click()}><Upload size={19}/><span><strong>{importing ? 'Importando…' : 'Importar fonte'}</strong><small>WOFF, WOFF2, TTF ou OTF · até 8 MB</small></span></button>
    <small className="font-import-hint" role="status">{importedName ? `${importedName} importada` : 'A fonte ficará disponível neste navegador.'}</small>{error && <p role="alert">{error}</p>}
    <div className="quick-section-divider"/>
    <div className="text-panel-label">Ícones, emojis e Símbolos</div>
    {batch ? <p>O texto de cada nó permanece individual. Selecione um nó para inserir símbolos no texto.</p> : <>{inlineEditor ? <p>Selecione uma palavra ou frase diretamente no nó para formatar ou inserir símbolos. Fonte, tamanho e alinhamento valem para o nó inteiro.</p> : <><p>Edite o texto abaixo. Clique em um símbolo para inseri-lo na posição do cursor.</p><RichTextEditor ref={editor} nodeId={node.id} text={node.text} runs={node.richText} hideControls onChange={(text, richText) => onPatch({ text, richText })}/></>}<div className="quick-icon-picker"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar símbolo" aria-label="Buscar símbolo"/><label className="quick-field">Colar símbolo ou emoji<input value={custom} onChange={event => setCustom(event.target.value)} maxLength={24} placeholder="Ex.: ✳ ou 🪴"/></label><div className="quick-symbol-actions"><button disabled={!custom} onMouseDown={event => event.preventDefault()} onClick={() => { insert(custom); setCustom(''); }}>Inserir no texto</button><button disabled={!custom} onClick={() => toggleFavorite(custom)}>☆ Favoritar</button></div><div className="quick-symbol-grid">{available.map(value => <div key={value}><button onMouseDown={event => event.preventDefault()} onClick={() => insert(value)} aria-label={`Inserir ${value} no texto`}>{value}</button><button className={favorites.includes(value) ? 'favorite' : ''} onClick={() => toggleFavorite(value)} title={favorites.includes(value) ? 'Remover dos favoritos' : 'Favoritar'} aria-label={`Favoritar ${value}`}>{favorites.includes(value) ? '★' : '☆'}</button></div>)}</div></div></>}
    <div className="quick-section-divider"/>
    <div className="text-panel-options"><label className="quick-field">Alinhamento vertical<select value={node.textVerticalAlign || 'center'} onChange={event => onPatch({ textVerticalAlign: event.target.value as MindNode['textVerticalAlign'] })}><option value="top">Topo</option><option value="center">Centro</option><option value="bottom">Base</option></select></label><label className="quick-check"><input type="checkbox" checked={node.wrapText !== false} onChange={event => onPatch({ wrapText: event.target.checked })}/> Quebrar texto automaticamente</label></div>
  </div>;
}
