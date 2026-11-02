'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Bold, Italic, Strikethrough, Underline } from 'lucide-react';
import { readRichText, richTextHtml } from '../lib/rich-text';
import type { RichRun } from '../types';

export type RichTextEditorHandle = { command: (name: string, value?: string) => void; insert: (value: string) => void; hasSelection: () => boolean; paintSelection: (color: string, kind?: 'color' | 'highlight') => boolean };
type Props = { nodeId: string; text: string; runs?: RichRun[]; onChange: (text: string, runs: RichRun[]) => void; compact?: boolean; autoFocus?: boolean; hideControls?: boolean; onDone?: (relatedTarget: EventTarget | null) => void };
const RichTextEditor = forwardRef<RichTextEditorHandle, Props>(function RichTextEditor({ nodeId, text, runs, onChange, compact, autoFocus, hideControls, onDone }, ref) {
  const editor = useRef<HTMLDivElement>(null);
  const [color, setColor] = useState('#ffff00');
  const selection = useRef<Range | null>(null);
  const paintSpan = useRef<HTMLSpanElement | null>(null);
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
    if (current?.rangeCount && editor.current?.contains(current.anchorNode)) {
      const range = current.getRangeAt(0);
      if (range.collapsed && selection.current && !selection.current.collapsed && !editor.current.contains(document.activeElement)) return;
      selection.current = range.cloneRange();
    }
  };
  useEffect(() => {
    document.addEventListener('selectionchange', rememberSelection);
    return () => document.removeEventListener('selectionchange', rememberSelection);
  });
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
  const paintSelection = (value: string, kind: 'color' | 'highlight' = 'color') => {
    const range = selection.current;
    if (!/^#[0-9a-f]{6}$/i.test(value) || !range || range.collapsed || !editor.current?.contains(range.commonAncestorContainer)) return false;
    if (!paintSpan.current?.isConnected) {
      const span = document.createElement('span');
      span.appendChild(range.extractContents());
      range.insertNode(span);
      range.selectNodeContents(span);
      selection.current = range.cloneRange();
      paintSpan.current = span;
    }
    for (const child of paintSpan.current.querySelectorAll<HTMLElement>('*')) {
      if (kind === 'highlight') {
        child.style.removeProperty('background-color');
        if (child.tagName === 'MARK') child.style.backgroundColor = 'transparent';
      }
      else child.style.removeProperty('color');
    }
    if (kind === 'highlight') paintSpan.current.style.backgroundColor = value;
    else paintSpan.current.style.color = value;
    save();
    return true;
  };
  useImperativeHandle(ref, () => ({ command, insert: value => command('insertText', value), hasSelection: () => Boolean(selection.current && !selection.current.collapsed), paintSelection }));
  return <div className={`rich-text-editor ${compact ? 'rich-compact' : ''}`}>
    {!compact && !hideControls && <div className="rich-controls">
      <button type="button" onMouseDown={event => event.preventDefault()} title="Negrito no trecho selecionado" onClick={() => command('bold')}><Bold size={15}/></button>
      <button type="button" onMouseDown={event => event.preventDefault()} title="Itálico no trecho selecionado" onClick={() => command('italic')}><Italic size={15}/></button>
      <button type="button" onMouseDown={event => event.preventDefault()} title="Sublinhado no trecho selecionado" onClick={() => command('underline')}><Underline size={15}/></button>
      <button type="button" onMouseDown={event => event.preventDefault()} title="Riscado no trecho selecionado" onClick={() => command('strikeThrough')}><Strikethrough size={15}/></button>
      {['#ffff00','#ffcce0','#b7efc5','#bcdfff'].map(value => <button key={value} type="button" aria-label={`Grifar com ${value}`} title={value} style={{ background: value, width: 24 }} onMouseDown={event => event.preventDefault()} onClick={() => command('hiliteColor', value)}/>)}
      <input type="color" aria-label="Escolher cor do grifo" value={/^#[0-9a-f]{6}$/i.test(color) ? color : '#ffff00'} onInput={event => { setColor(event.currentTarget.value); paintSelection(event.currentTarget.value, 'highlight'); }}/><label title="Cor hexadecimal do destaque"><input type="text" value={color} maxLength={7} aria-label="Cor hexadecimal do destaque" style={{ width: 82 }} onChange={event => { setColor(event.target.value); }}/></label>
      <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => { if (/^#[0-9a-f]{6}$/i.test(color)) command('hiliteColor', color); }}>Grifar</button>
      <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => command('hiliteColor', 'transparent')}>Sem grifo</button>
    </div>}
    <div ref={editor} className="rich-editable nodrag" contentEditable role="textbox" aria-label="Texto formatado do nó" aria-multiline="true" suppressContentEditableWarning onInput={() => { if (pending.current) clearTimeout(pending.current); pending.current = setTimeout(save, 450); }} onMouseUp={() => { paintSpan.current = null; rememberSelection(); }} onKeyUp={() => { paintSpan.current = null; rememberSelection(); }} onBlur={event => { save(); onDone?.(event.relatedTarget); }} onPaste={event => { event.preventDefault(); document.execCommand('insertText', false, event.clipboardData.getData('text/plain')); }} onKeyDown={event => { event.stopPropagation(); if (compact && event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); editor.current?.blur(); } if (event.key === 'Escape') editor.current?.blur(); }} />
  </div>;
});
export default RichTextEditor;
