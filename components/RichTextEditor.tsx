'use client';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bold, Check, Italic, Languages, LoaderCircle, Strikethrough, Underline, X } from 'lucide-react';
import { readRichText, replaceRichTextPhrase, richTextHtml } from '../lib/rich-text';
import { normalizeProofIssues, type ProofIssue, type ProofLanguage } from '../lib/proofreading';
import type { RichRun } from '../types';

export type RichTextEditorHandle = { command: (name: string, value?: string) => void; insert: (value: string) => void; hasSelection: () => boolean; getSelectionMetric: (kind: 'fontSize' | 'lineSpacing' | 'letterSpacing') => number | null; paintSelection: (value: string, kind?: 'color' | 'highlight' | 'fontSize' | 'fontFamily' | 'lineSpacing' | 'letterSpacing' | 'textTransform') => boolean; replaceRuns: (next: RichRun[]) => void };
type Props = { nodeId: string; text: string; runs?: RichRun[]; onChange: (text: string, runs: RichRun[]) => void; language?: ProofLanguage; onLanguageChange?: (language: ProofLanguage) => void; compact?: boolean; autoFocus?: boolean; selectAllOnFocus?: boolean; hideControls?: boolean; onDone?: (relatedTarget: EventTarget | null) => void };
const RichTextEditor = forwardRef<RichTextEditorHandle, Props>(function RichTextEditor({ nodeId, text, runs, onChange, language = 'pt-BR', onLanguageChange, compact, autoFocus, selectAllOnFocus, hideControls, onDone }, ref) {
  const editor = useRef<HTMLDivElement>(null);
  const [color, setColor] = useState('#ffff00');
  const selection = useRef<Range | null>(null);
  const paintSpan = useRef<HTMLSpanElement | null>(null);
  const lastNode = useRef<string | null>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSubmitted = useRef('');
  const reviewController = useRef<AbortController | null>(null);
  const lastReviewed = useRef('');
  const lastReviewAttempt = useRef(0);
  const [issues, setIssues] = useState<ProofIssue[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState('');
  useLayoutEffect(() => {
    if (!editor.current) return;
    const key = JSON.stringify({ text, runs });
    if (lastNode.current === nodeId && (editor.current.contains(document.activeElement) || key === lastSubmitted.current)) return;
    lastNode.current = nodeId;
    lastSubmitted.current = key;
    editor.current.innerHTML = richTextHtml(text, runs);
    if (autoFocus) {
      editor.current.focus();
      if (selectAllOnFocus) {
        const range = document.createRange();
        range.selectNodeContents(editor.current);
        const current = window.getSelection();
        current?.removeAllRanges(); current?.addRange(range);
        selection.current = range.cloneRange();
      }
    }
  }, [nodeId, autoFocus, selectAllOnFocus, text, runs]);
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
    if (name === 'hiliteColor' && value) { paintSelection(value, 'highlight'); return; }
    if (name === 'foreColor' && value) { paintSelection(value, 'color'); return; }
    if (!editor.current) return;
    const selected = selection.current && !selection.current.collapsed && editor.current.contains(selection.current.commonAncestorContainer);
    const whole = name !== 'insertText' && !selected;
    editor.current.focus();
    const range = whole ? document.createRange() : selection.current;
    if (whole) range?.selectNodeContents(editor.current);
    if (range) { const current = window.getSelection(); current?.removeAllRanges(); current?.addRange(range); }
    document.execCommand(name, false, value);
    if (whole) {
      const end = document.createRange();
      end.selectNodeContents(editor.current);
      end.collapse(false);
      const current = window.getSelection();
      current?.removeAllRanges(); current?.addRange(end);
      selection.current = end.cloneRange();
    }
    rememberSelection();
    save();
  };
  const paintSelection = (value: string, kind: 'color' | 'highlight' | 'fontSize' | 'fontFamily' | 'lineSpacing' | 'letterSpacing' | 'textTransform' = 'color') => {
    if (!editor.current) return false;
    const numeric = Number(value);
    const valid = kind === 'color' || kind === 'highlight' ? /^#[0-9a-f]{6}$/i.test(value) || kind === 'highlight' && value === 'transparent' : kind === 'fontFamily' ? /^[\p{L}\p{N}\s,."'_-]{1,120}$/u.test(value) : kind === 'textTransform' ? ['none','uppercase','lowercase'].includes(value) : Number.isFinite(numeric) && (kind === 'fontSize' ? numeric >= 8 && numeric <= 96 : kind === 'lineSpacing' ? numeric >= 1 && numeric <= 2.5 : numeric >= -2 && numeric <= 12);
    if (!valid) return false;
    const selected = selection.current && !selection.current.collapsed && editor.current.contains(selection.current.commonAncestorContainer);
    const range = selected ? selection.current! : document.createRange();
    if (!selected) { paintSpan.current = null; range.selectNodeContents(editor.current); }
    if (range.collapsed) return false;
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
      else if (kind === 'color') child.style.removeProperty('color');
      else if (kind === 'fontSize') child.style.removeProperty('font-size');
      else if (kind === 'fontFamily') child.style.removeProperty('font-family');
      else if (kind === 'lineSpacing') child.style.removeProperty('line-height');
      else if (kind === 'letterSpacing') child.style.removeProperty('letter-spacing');
      else if (kind === 'textTransform') child.style.removeProperty('text-transform');
    }
    if (kind === 'highlight') paintSpan.current.style.backgroundColor = value;
    else if (kind === 'color') paintSpan.current.style.color = value;
    else if (kind === 'fontSize') paintSpan.current.style.fontSize = `${Number(value)}px`;
    else if (kind === 'fontFamily') paintSpan.current.style.fontFamily = value;
    else if (kind === 'lineSpacing') paintSpan.current.style.lineHeight = value;
    else if (kind === 'textTransform') paintSpan.current.style.textTransform = value;
    else paintSpan.current.style.letterSpacing = `${Number(value)}px`;
    if (!selected) {
      const end = document.createRange();
      end.selectNodeContents(editor.current);
      end.collapse(false);
      const current = window.getSelection();
      current?.removeAllRanges(); current?.addRange(end);
      selection.current = end.cloneRange();
      paintSpan.current = null;
    }
    save();
    return true;
  };
  const replaceRuns = (next: RichRun[]) => {
    if (!editor.current) return;
    const root = editor.current;
    const range = selection.current;
    let caret: number | null = null;
    if (range?.collapsed && root.contains(range.startContainer)) {
      const before = document.createRange();
      before.selectNodeContents(root);
      before.setEnd(range.startContainer, range.startOffset);
      caret = before.toString().length;
    }
    const plain = next.map(run => run.text).join('');
    root.innerHTML = richTextHtml(plain, next);
    lastSubmitted.current = JSON.stringify({ text: plain, runs: next });
    paintSpan.current = null;
    if (caret !== null) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let remaining = caret;
      let current: Node | null = walker.nextNode();
      while (current && remaining > (current.textContent?.length || 0)) {
        remaining -= current.textContent?.length || 0;
        current = walker.nextNode();
      }
      const restored = document.createRange();
      if (current) restored.setStart(current, Math.min(remaining, current.textContent?.length || 0));
      else { restored.selectNodeContents(root); restored.collapse(false); }
      restored.collapse(true);
      selection.current = restored.cloneRange();
      if (root.contains(document.activeElement)) {
        const active = window.getSelection();
        active?.removeAllRanges(); active?.addRange(restored);
      }
    }
  };
  const reviewText = useCallback(async (manual: boolean) => {
    if (!editor.current) return;
    const source = readRichText(editor.current).map(run => run.text).join('').trim();
    if (!source || source.length > 1000 || !manual && (source.length < 12 || ['Nova ideia', 'Nova etapa', 'Ideia central', 'Ideia flutuante'].includes(source))) return;
    if (process.env.NEXT_PUBLIC_STORAGE_MODE !== 'cloud') { if (manual) { setReviewError('A revisão gramatical por IA requer uma conta conectada. O corretor do navegador continua disponível.'); setReviewOpen(true); } return; }
    const signature = `${language}:${source}`;
    if (!manual && signature === lastReviewed.current) return;
    reviewController.current?.abort();
    const controller = new AbortController(); reviewController.current = controller;
    lastReviewAttempt.current = Date.now();
    setReviewBusy(true); setReviewError('');
    try {
      const response = await fetch('/api/proofread', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: source, language }) });
      const result = await response.json() as { issues?: unknown; error?: string };
      if (!response.ok) throw new Error(result.error || 'Não foi possível revisar o texto.');
      if (!editor.current || readRichText(editor.current).map(run => run.text).join('').trim() !== source) return;
      const found = normalizeProofIssues(result.issues, source);
      lastReviewed.current = signature; setIssues(found); setReviewOpen(manual || found.length > 0);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (manual) { setReviewError(error instanceof Error ? error.message : 'Não foi possível revisar o texto.'); setReviewOpen(true); }
    } finally { if (reviewController.current === controller) { reviewController.current = null; setReviewBusy(false); } }
  }, [language]);
  useEffect(() => {
    if (!compact || !autoFocus || text.trim().length < 12) return;
    const delay = Math.max(4000, 10_500 - (Date.now() - lastReviewAttempt.current));
    const timer = setTimeout(() => { void reviewText(false); }, delay);
    return () => clearTimeout(timer);
  }, [compact, autoFocus, text, language, reviewText]);
  useEffect(() => () => reviewController.current?.abort(), []);
  const applySuggestion = (issue: ProofIssue, replacement: string) => {
    if (!editor.current) return;
    const currentRuns = readRichText(editor.current);
    const currentText = currentRuns.map(run => run.text).join('');
    const next = replaceRichTextPhrase(currentText, currentRuns, issue.original, replacement);
    if (!next) { setReviewError('Este trecho mudou. Revise o texto novamente.'); return; }
    replaceRuns(next.runs);
    onChange(next.text, next.runs);
    setIssues(current => current.filter(item => item !== issue));
    lastReviewed.current = '';
    editor.current.focus();
  };
  const getSelectionMetric = (kind: 'fontSize' | 'lineSpacing' | 'letterSpacing') => {
    const range = selection.current;
    if (!range || range.collapsed || !editor.current?.contains(range.startContainer)) return null;
    const element = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;
    if (!element) return null;
    const style = getComputedStyle(element);
    const fontSize = Number.parseFloat(style.fontSize);
    const measured = kind === 'fontSize' ? fontSize : kind === 'letterSpacing' ? Number.parseFloat(style.letterSpacing) : Number.parseFloat(style.lineHeight) / fontSize;
    return Number.isFinite(measured) ? measured : null;
  };
  useImperativeHandle(ref, () => ({ command, insert: value => command('insertText', value), hasSelection: () => Boolean(selection.current && !selection.current.collapsed), getSelectionMetric, paintSelection, replaceRuns }));
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
    <div ref={editor} className="rich-editable nodrag" contentEditable spellCheck lang={language} role="textbox" aria-label="Texto formatado do nó" aria-multiline="true" suppressContentEditableWarning onInput={() => { setIssues([]); setReviewOpen(false); if (pending.current) clearTimeout(pending.current); pending.current = setTimeout(save, 450); }} onMouseUp={() => { paintSpan.current = null; rememberSelection(); }} onKeyUp={() => { paintSpan.current = null; rememberSelection(); }} onBlur={event => { save(); onDone?.(event.relatedTarget); }} onPaste={event => { event.preventDefault(); document.execCommand('insertText', false, event.clipboardData.getData('text/plain')); }} onKeyDown={event => { event.stopPropagation(); if (compact && event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); editor.current?.blur(); } if (event.key === 'Escape') editor.current?.blur(); }} />
    {compact && <div className="rich-proof-controls nodrag nopan nowheel"><Languages size={13}/><select aria-label="Idioma da correção" value={language} onChange={event => { onLanguageChange?.(event.target.value as ProofLanguage); setIssues([]); setReviewOpen(false); editor.current?.focus(); }}><option value="pt-BR">Português (Brasil)</option><option value="en-US">English (US)</option></select><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => void reviewText(true)} disabled={reviewBusy} title="Revisar ortografia e gramática"><span>{reviewBusy ? 'Revisando…' : 'Revisar escrita'}</span>{reviewBusy ? <LoaderCircle size={12} className="spin"/> : issues.length > 0 ? <b>{issues.length}</b> : null}</button>{issues.length > 0 && <button type="button" aria-label="Mostrar sugestões" onMouseDown={event => event.preventDefault()} onClick={() => setReviewOpen(true)}>{issues.length} sugestão(ões)</button>}</div>}
    {compact && reviewOpen && typeof document !== 'undefined' && createPortal(<div className={`rich-proof-panel ${editor.current?.closest(".app-shell.dark") ? "dark" : ""}`} role="dialog" aria-label="Sugestões de correção"><div className="rich-proof-header"><strong>Revisão de escrita</strong><button type="button" aria-label="Fechar sugestões" onMouseDown={event => event.preventDefault()} onClick={() => setReviewOpen(false)}><X size={15}/></button></div>{reviewError && <p role="alert">{reviewError}</p>}{!reviewError && !issues.length && <p>Nenhuma correção sugerida.</p>}{issues.map((issue, index) => <div className="rich-proof-issue" key={`${issue.original}:${index}`}><small>{issue.kind === 'grammar' ? 'Gramática' : 'Ortografia'}</small><strong>{issue.original}</strong>{issue.reason && <p>{issue.reason}</p>}<div>{issue.suggestions.map(suggestion => <button type="button" key={suggestion} onMouseDown={event => event.preventDefault()} onClick={() => applySuggestion(issue, suggestion)}><Check size={13}/>{suggestion}</button>)}</div></div>)}<small>As sugestões podem conter erros. Confira antes de aplicar.</small></div>, document.body)}
  </div>;
});
export default RichTextEditor;
