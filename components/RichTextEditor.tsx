'use client';
import { useEffect, useRef, useState } from 'react';
import { Bold, Italic, Strikethrough, Underline } from 'lucide-react';
import { readRichText, richTextHtml } from '../lib/rich-text';
import type { RichRun } from '../types';

type Props = { nodeId: string; text: string; runs?: RichRun[]; onChange: (text: string, runs: RichRun[]) => void; compact?: boolean; autoFocus?: boolean; onDone?: () => void };
export default function RichTextEditor({ nodeId, text, runs, onChange, compact, autoFocus, onDone }: Props) {
  const editor = useRef<HTMLDivElement>(null);
  const [color, setColor] = useState('#fff0a8');
  const selection = useRef<Range | null>(null);
  const lastNode = useRef<string | null>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSubmitted = useRef('');
  useEffect(() => {
    if (!editor.current) return;
    const key = JSON.stringify({ text, runs });
    if (lastNode.current === nodeId && (editor.current.contains(document.activeElement) || key === lastSubmitted.current)) return;
    lastNode.current = nodeId;
    lastSubmitted.current = key;
    editor.current.innerHTML = richTextHtml(text, runs);
    if (autoFocus) editor.current.focus();
  }, [nodeId, autoFocus, text, runs]);
  const rememberSelection = () => {
    const current = window.getSelection();
    if (current?.rangeCount && editor.current?.contains(current.anchorNode)) selection.current = current.getRangeAt(0).cloneRange();
  };
  const save = () => {
    if (pending.current) { clearTimeout(pending.current); pending.current = null; }
    if (!editor.current) return;
    const next = readRichText(editor.current);
    const plain = next.map(run => run.text).join('').trim() || 'Nova ideia';
    lastSubmitted.current = JSON.stringify({ text: plain, runs: next });
    if (plain !== text || JSON.stringify(next) !== JSON.stringify(runs || [{ text }])) onChange(plain, next);
  };
  const command = (name: string, value?: string) => {
    editor.current?.focus();
    if (selection.current) { const current = window.getSelection(); current?.removeAllRanges(); current?.addRange(selection.current); }
    document.execCommand(name, false, value);
    rememberSelection();
    save();
  };
  return <div className={`rich-text-editor ${compact ? 'rich-compact' : ''}`}>
    {!compact && <div className="rich-controls">
      <button type="button" onMouseDown={event => event.preventDefault()} title="Negrito no trecho selecionado" onClick={() => command('bold')}><Bold size={15}/></button>
      <button type="button" onMouseDown={event => event.preventDefault()} title="Itálico no trecho selecionado" onClick={() => command('italic')}><Italic size={15}/></button>
      <button type="button" onMouseDown={event => event.preventDefault()} title="Sublinhado no trecho selecionado" onClick={() => command('underline')}><Underline size={15}/></button>
      <button type="button" onMouseDown={event => event.preventDefault()} title="Riscado no trecho selecionado" onClick={() => command('strikeThrough')}><Strikethrough size={15}/></button>
      {['#fff0a8','#ffcce0','#b7efc5','#bcdfff'].map(value => <button key={value} type="button" aria-label={`Grifar com ${value}`} title={value} style={{ background: value, width: 24 }} onMouseDown={event => event.preventDefault()} onClick={() => command('hiliteColor', value)}/>)}
      <input type="color" aria-label="Escolher cor do grifo" value={/^#[0-9a-f]{6}$/i.test(color) ? color : '#fff0a8'} onChange={event => { setColor(event.target.value); command('hiliteColor', event.target.value); }}/><label title="Cor hexadecimal do destaque"><input type="text" value={color} maxLength={7} aria-label="Cor hexadecimal do destaque" style={{ width: 82 }} onChange={event => { setColor(event.target.value); }}/></label>
      <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => { if (/^#[0-9a-f]{6}$/i.test(color)) command('hiliteColor', color); }}>Grifar</button>
      <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => command('hiliteColor', 'transparent')}>Sem grifo</button>
    </div>}
    <div ref={editor} className="rich-editable nodrag" contentEditable role="textbox" aria-label="Texto formatado do nó" aria-multiline="true" suppressContentEditableWarning onInput={() => { if (pending.current) clearTimeout(pending.current); pending.current = setTimeout(save, 450); }} onMouseUp={rememberSelection} onKeyUp={rememberSelection} onBlur={() => { save(); onDone?.(); }} onPaste={event => { event.preventDefault(); document.execCommand('insertText', false, event.clipboardData.getData('text/plain')); }} onKeyDown={event => { if (compact && event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); editor.current?.blur(); } if (event.key === 'Escape') editor.current?.blur(); }} />
  </div>;
}
