import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function readCss(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const chunks = await Promise.all(entries.map(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? readCss(path) : entry.name.endsWith('.css') ? readFile(path, 'utf8') : '';
  }));
  return chunks.join('\n');
}

// Uma compilação TypeScript válida não garante que o CSS correto entrou no deploy.
const css = await readCss('.next/static');
for (const selector of ['.multi-selection-bar', '.multi-selection-main', '.multi-selection-panel', '.relationship-quick-toolbar', '.react-flow__selection', '.react-flow__node.dragging']) {
  if (!css.includes(selector)) throw new Error(`Build sem estilo obrigatório do editor: ${selector}`);
}
console.log('CSS de seleção, menus e arraste presente no build de produção.');
