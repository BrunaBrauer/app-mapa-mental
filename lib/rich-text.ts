import type { RichRun } from '../types';

type Marks = Omit<RichRun, 'text'>;
const hexColor = /^#[0-9a-f]{6}$/i;
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);

export function richTextHtml(text: string, runs?: RichRun[]) {
  return (runs?.length ? runs : [{ text }]).map(run => {
    const style = run.highlight && hexColor.test(run.highlight) ? ` style="background-color:${run.highlight}"` : '';
    let html = escapeHtml(run.text).replace(/\n/g, '<br>');
    if (run.bold) html = `<strong>${html}</strong>`;
    if (run.italic) html = `<em>${html}</em>`;
    if (run.underline) html = `<u>${html}</u>`;
    if (run.strike) html = `<s>${html}</s>`;
    return style ? `<mark${style}>${html}</mark>` : html;
  }).join('');
}

// The editor stores plain text plus an allow-listed sequence of marks, never pasted HTML.
export function readRichText(root: HTMLElement): RichRun[] {
  const runs: RichRun[] = [];
  const push = (text: string, marks: Marks) => {
    if (!text) return;
    const previous = runs.at(-1);
    if (previous && previous.bold === marks.bold && previous.italic === marks.italic && previous.underline === marks.underline && previous.strike === marks.strike && previous.highlight === marks.highlight) previous.text += text;
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
    const color = node.style.backgroundColor;
    if (tag === 'mark' || color) {
      const match = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
      const normalized = match ? `#${match.slice(1).map(value => Number(value).toString(16).padStart(2, '0')).join('')}` : color;
      if (hexColor.test(normalized)) next.highlight = normalized;
    }
    const block = ['div', 'p'].includes(tag) && node !== root;
    if (block && runs.length && !runs.at(-1)!.text.endsWith('\n')) push('\n', marks);
    node.childNodes.forEach(child => visit(child, next));
  };
  root.childNodes.forEach(child => visit(child, {}));
  return runs;
}
