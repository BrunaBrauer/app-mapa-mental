import type { RichRun } from '../types';

type Marks = Omit<RichRun, 'text'>;
const hexColor = /^#[0-9a-f]{6}$/i;
const normalizeColor = (value: string) => {
  const match = value.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/);
  return match ? `#${match.slice(1, 4).map(channel => Number(channel).toString(16).padStart(2, '0')).join('')}` : value;
};
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);

export function richTextHtml(text: string, runs?: RichRun[]) {
  return (runs?.length ? runs : [{ text }]).map(run => {
    const style = run.highlight && hexColor.test(run.highlight) ? ` style="background-color:${run.highlight}"` : '';
    let html = escapeHtml(run.text).replace(/\n/g, '<br>');
    if (run.bold) html = `<strong>${html}</strong>`;
    if (run.italic) html = `<em>${html}</em>`;
    if (run.underline) html = `<u>${html}</u>`;
    if (run.strike) html = `<s>${html}</s>`;
    if (run.color && hexColor.test(run.color)) html = `<span style="color:${run.color}">${html}</span>`;
    return style ? `<mark${style}>${html}</mark>` : html;
  }).join('');
}

// The editor stores plain text plus an allow-listed sequence of marks, never pasted HTML.
export function readRichText(root: HTMLElement): RichRun[] {
  const runs: RichRun[] = [];
  const push = (text: string, marks: Marks) => {
    if (!text) return;
    const previous = runs.at(-1);
    if (previous && previous.bold === marks.bold && previous.italic === marks.italic && previous.underline === marks.underline && previous.strike === marks.strike && previous.highlight === marks.highlight && previous.color === marks.color) previous.text += text;
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
    const background = normalizeColor(node.style.backgroundColor);
    if (tag === 'mark' || background) {
      if (hexColor.test(background)) next.highlight = background;
    }
    const foreground = normalizeColor(node.style.color);
    if (hexColor.test(foreground)) next.color = foreground;
    const block = ['div', 'p'].includes(tag) && node !== root;
    if (block && runs.length && !runs.at(-1)!.text.endsWith('\n')) push('\n', marks);
    node.childNodes.forEach(child => visit(child, next));
  };
  root.childNodes.forEach(child => visit(child, {}));
  return runs;
}
