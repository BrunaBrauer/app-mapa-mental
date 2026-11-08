import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const compile = async path => ts.transpileModule(await readFile(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const url = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const { selectionForExport } = await import(url(await compile('lib/export-selection.ts')));
const { toMarkdown } = await import(url(await compile('lib/maps.ts')));
const map = { id: 'map', title: 'Projeto', layout: 'horizontal', updatedAt: 1, nodes: [
  { id: 'root', parentId: null, text: 'Raiz', x: 0, y: 0 },
  { id: 'a', parentId: 'root', text: 'Alfa', x: 200, y: 0 },
  { id: 'a1', parentId: 'a', text: 'Detalhe', x: 400, y: 0 },
  { id: 'b', parentId: 'root', text: 'Beta', x: 200, y: 100 },
], relationships: [{ id: 'rel', source: 'a', target: 'b' }] };
const chosen = selectionForExport(map, ['a', 'a1', 'b']);
assert.deepEqual(chosen.nodes.map(node => [node.id, node.parentId]), [['a', null], ['a1', 'a'], ['b', null]]);
assert.equal(chosen.relationships.length, 1);
assert.ok(!chosen.nodes.some(node => node.text === 'Raiz'));
const markdown = toMarkdown(chosen);
assert.match(markdown, /Alfa/);
assert.match(markdown, /Detalhe/);
assert.match(markdown, /Beta/);
assert.doesNotMatch(markdown, /Raiz/);
console.log('Exportação da seleção: nós explícitos, raízes independentes e Markdown completo OK.');
