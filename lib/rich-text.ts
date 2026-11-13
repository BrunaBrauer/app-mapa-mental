import type { RichRun } from '../types';

type Marks = Omit<RichRun, 'text'>;
const hexColor = /^#[0-9a-f]{6}$/i;
const normalizeColor = (value: string) => {
  const match = value.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/);
  return match ? `#${match.slice(1, 4).map(channel => Number(channel).toString(16).padStart(2, '0')).join('')}` : value;
};
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const safeFamily = (value: string) => /^[\p{L}\p{N}\s,."'_-]{1,120}$/u.test(value);

export function formatWholeText(text: string, runs: RichRun[] | undefined, patch: Partial<RichRun>): RichRun[] {
  return (runs?.length ? runs : [{ text }]).map(run => ({ ...run, ...patch }));
}

// Replace only the reviewed phrase, keeping all marks outside it and the marks at its start.
export function replaceRichTextPhrase(text: string, runs: RichRun[] | undefined, original: string, replacement: string): { text: string; runs: RichRun[] } | null {
  if (!original || !replacement || original === replacement) return null;
  const start = text.indexOf(original);
  if (start < 0 || text.indexOf(original, start + original.length) >= 0) return null;
  const end = start + original.length;
  const source = runs?.length && runs.map(run => run.text).join('') === text ? runs : [{ text }];
  const next: RichRun[] = [];
  let offset = 0;
  let inserted = false;
  for (const run of source) {
    const runEnd = offset + run.text.length;
    if (runEnd <= start || offset >= end) next.push({ ...run });
    else {
      const before = run.text.slice(0, Math.max(0, start - offset));
      const after = run.text.slice(Math.max(0, end - offset));
      if (before) next.push({ ...run, text: before });
      if (!inserted) { next.push({ ...run, text: replacement }); inserted = true; }
      if (after) next.push({ ...run, text: after });
    }
    offset = runEnd;
  }
  return { text: text.slice(0, start) + replacement + text.slice(end), runs: next };
}

export function richTextHtml(text: string, runs?: RichRun[]) {
  return (runs?.length ? runs : [{ text }]).map(run => {
    const styles: string[] = [];
    if (run.highlight && hexColor.test(run.highlight)) styles.push(`background-color:${run.highlight}`);
    if (run.color && hexColor.test(run.color)) styles.push(`color:${run.color}`);
    if (run.fontSize !== undefined && run.fontSize >= 8 && run.fontSize <= 96) styles.push(`font-size:${run.fontSize}px`);
    if (run.fontFamily && safeFamily(run.fontFamily)) styles.push(`font-family:${escapeHtml(run.fontFamily)}`);
    if (run.lineSpacing !== undefined && run.lineSpacing >= 1 && run.lineSpacing <= 2.5) styles.push(`line-height:${run.lineSpacing}`);
    if (run.letterSpacing !== undefined && run.letterSpacing >= -2 && run.letterSpacing <= 12) styles.push(`letter-spacing:${run.letterSpacing}px`);
    if (run.textTransform && ['none','uppercase','lowercase'].includes(run.textTransform)) styles.push(`text-transform:${run.textTransform}`);
    if (run.bold === false) styles.push('font-weight:normal');
    if (run.italic === false) styles.push('font-style:normal');
    let html = escapeHtml(run.text).replace(/\n/g, '<br>');
    if (run.bold) html = `<strong>${html}</strong>`;
    if (run.italic) html = `<em>${html}</em>`;
    if (run.underline) html = `<u>${html}</u>`;
    if (run.strike) html = `<s>${html}</s>`;
    return styles.length ? `<span style="${styles.join(';')}">${html}</span>` : html;
  }).join('');
}

// The editor stores plain text plus an allow-listed sequence of marks, never pasted HTML.
export function readRichText(root: HTMLElement): RichRun[] {
  const runs: RichRun[] = [];
  const push = (text: string, marks: Marks) => {
    if (!text) return;
    const previous = runs.at(-1);
    if (previous && previous.bold === marks.bold && previous.italic === marks.italic && previous.underline === marks.underline && previous.strike === marks.strike && previous.highlight === marks.highlight && previous.color === marks.color && previous.fontSize === marks.fontSize && previous.fontFamily === marks.fontFamily && previous.lineSpacing === marks.lineSpacing && previous.letterSpacing === marks.letterSpacing && previous.textTransform === marks.textTransform) previous.text += text;
    else runs.push({ text, ...marks });
  };
  const visit = (node: Node, marks: Marks) => {
    if (node.nodeType === Node.TEXT_NODE) { push(node.textContent || '', marks); return; }
    if (!(node instanceof HTMLElement)) return;
    if (node.tagName === 'BR') { push('\n', marks); return; }
    const tag = node.tagName.toLowerCase();
    const next: Marks = { ...marks };
    if (tag === 'b' || tag === 'strong' || node.style.fontWeight === 'bold' || Number(node.style.fontWeight) >= 600) next.bold = true;
    if (tag === 'i' || tag === 'em' || node.style.fontStyle === 'italic') next.italic = true;
    if (tag === 'u' || node.style.textDecoration.includes('underline')) next.underline = true;
    if (tag === 's' || tag === 'strike' || node.style.textDecoration.includes('line-through')) next.strike = true;
    if (node.style.textDecoration === 'none' || node.style.textDecorationLine === 'none') { next.underline = false; next.strike = false; }
    if (node.style.fontWeight === 'normal' || Number(node.style.fontWeight) < 600 && Number(node.style.fontWeight) > 0) next.bold = false;
    if (node.style.fontStyle === 'normal') next.italic = false;
    const background = normalizeColor(node.style.backgroundColor);
    if (tag === 'mark' || background) {
      if (hexColor.test(background)) next.highlight = background;
    }
    const foreground = normalizeColor(node.style.color);
    if (hexColor.test(foreground)) next.color = foreground;
    const fontSize = Number.parseFloat(node.style.fontSize);
    if (Number.isFinite(fontSize) && fontSize >= 8 && fontSize <= 96) next.fontSize = fontSize;
    if (node.style.fontFamily && safeFamily(node.style.fontFamily)) next.fontFamily = node.style.fontFamily;
    const lineSpacing = Number.parseFloat(node.style.lineHeight);
    if (Number.isFinite(lineSpacing) && lineSpacing >= 1 && lineSpacing <= 2.5) next.lineSpacing = lineSpacing;
    const letterSpacing = Number.parseFloat(node.style.letterSpacing);
    if (Number.isFinite(letterSpacing) && letterSpacing >= -2 && letterSpacing <= 12) next.letterSpacing = letterSpacing;
    if (['none','uppercase','lowercase'].includes(node.style.textTransform)) next.textTransform = node.style.textTransform as RichRun['textTransform'];
    const block = ['div', 'p'].includes(tag) && node !== root;
    if (block && runs.length && !runs.at(-1)!.text.endsWith('\n')) push('\n', marks);
    node.childNodes.forEach(child => visit(child, next));
  };
  root.childNodes.forEach(child => visit(child, {}));
  return runs;
}
