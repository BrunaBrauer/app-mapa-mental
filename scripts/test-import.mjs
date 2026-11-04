import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const compile = async path => ts.transpileModule(await readFile(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const url = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const migration = url(await compile('lib/layout-migration.ts'));
const serverMaps = url((await compile('lib/server-maps.ts')).replace("'./layout-migration'", JSON.stringify(migration)));
const source = (await compile('lib/import-map.ts'))
  .replace("'./maps'", JSON.stringify(url(await compile('lib/maps.ts'))))
  .replace("'./server-maps'", JSON.stringify(serverMaps))
  .replace("'./layout-migration'", JSON.stringify(migration))
  .replace("'fast-xml-parser'", JSON.stringify(import.meta.resolve('fast-xml-parser')));
const { parseMapFile, parseMindomoArchive } = await import(url(source.replace("'fflate'", JSON.stringify(import.meta.resolve('fflate')))));
const { validMap } = await import(serverMaps);
const { migrateMapLayouts } = await import(migration);
const { autoLayout, toMarkdown } = await import(url(await compile('lib/maps.ts')));
const xml = `<?xml version="1.0"?><map xmlns="http://schemas.mindomo.com/application/version-3.6"><name>Planejamento</name><topics><topic><text>Raiz &amp; ação</text><subTopics><topic><text>Filho</text><notes>Uma nota</notes><hyperlink>https://example.com</hyperlink></topic><topic deleted="true"><text>Removido</text></topic></subTopics></topic></topics></map>`;
const result = parseMapFile(xml, 'teste.mom');
assert.equal(result.map.title, 'Planejamento');
assert.equal(result.map.nodes.length, 2);
assert.equal(result.map.nodes[0].text, 'Raiz & ação');
assert.equal(result.map.nodes[1].parentId, result.map.nodes[0].id);
assert.equal(result.map.nodes[1].note, 'Uma nota');
assert.equal(result.map.nodes[1].url, 'https://example.com');
assert.ok(result.map.nodes[1].x > result.map.nodes[0].x);
const copy = parseMapFile(JSON.stringify({ ...result.map, shareToken: 'public-token' }), 'backup.json').map;
assert.notEqual(copy.id, result.map.id);
assert.equal(copy.shareToken, null);
assert.deepEqual(copy.nodes, result.map.nodes);
const legacy = { ...copy, layout: 'balanced', nodes: copy.nodes.map((node, index) => index ? { ...node, branchLayout: 'free' } : node) };
const converted = migrateMapLayouts(legacy);
assert.equal(converted.layout, 'bilateral');
assert.equal(converted.nodes[1].branchLayout, 'network');
assert.deepEqual(converted.nodes.map(({ id, x, y }) => ({ id, x, y })), legacy.nodes.map(({ id, x, y }) => ({ id, x, y })));
assert.equal(migrateMapLayouts(converted), converted, 'Migration is idempotent');
const floating = { id: 'floating', parentId: null, floating: true, text: 'Livre', x: 810, y: 440 };
const arranged = autoLayout([...copy.nodes, floating], 'horizontal');
assert.deepEqual(arranged.find(node => node.id === floating.id), floating, 'Horizontal layout preserves floating nodes');
assert.throws(() => parseMapFile('<!DOCTYPE x><map/>', 'bad.mom'));
assert.throws(() => parseMapFile('PK\u0003\u0004', 'archive.mom'));
assert.throws(() => parseMapFile(JSON.stringify({ ...copy, nodes: [{ ...copy.nodes[0], parentId: copy.nodes[0].id }] }), 'cycle.json'));
assert.throws(() => parseMapFile(JSON.stringify({ ...copy, nodes: [copy.nodes[0], copy.nodes[0]] }), 'duplicate.json'));
assert.throws(() => parseMapFile(JSON.stringify({ ...copy, movementMode: 'inexistente' }), 'invalid-movement.json'));
assert.throws(() => parseMapFile(JSON.stringify({ ...copy, nodes: [{ ...copy.nodes[0], positionLocked: 'sim' }] }), 'invalid-lock.json'));
const styledBackup = parseMapFile(JSON.stringify({ ...copy, levelStyles: [{ depth: 1, style: { background: '#ffffff' }, autoWidth: true }], nodes: copy.nodes.map(node => ({ ...node, childAlignment: 'center', sizeLocked: false, styleOverrides: ['background'] })) }), 'styled.json').map;
assert.equal(styledBackup.levelStyles[0].style.background, '#ffffff');
const sizedBackup = parseMapFile(JSON.stringify({ ...copy, nodes: copy.nodes.map(node => ({ ...node, minWidth: 110, maxWidth: 420, minHeight: 40, maxHeight: 240 })) }), 'sized.json').map;
assert.equal(sizedBackup.nodes[0].maxWidth, 420);
assert.equal(styledBackup.nodes[0].childAlignment, 'center');
assert.throws(() => parseMapFile(JSON.stringify({ ...copy, levelStyles: [{ depth: -1, style: {} }] }), 'invalid-level.json'));
assert.equal(validMap(copy), true);
const multipleNotes = { ...copy, nodes: copy.nodes.map((node, index) => index ? { ...node, note: undefined, notes: [{ id: 'note-1', text: 'Primeira', createdAt: 1 }, { id: 'note-2', text: 'Segunda', createdAt: 2 }] } : node) };
assert.equal(validMap(multipleNotes), true, 'Multiple notes can be saved with a map');
assert.match(toMarkdown(multipleNotes), /Nota 1: Primeira[\s\S]*Nota 2: Segunda/, 'Markdown export includes every note in order');
assert.equal(validMap({ ...multipleNotes, nodes: multipleNotes.nodes.map((node, index) => index ? { ...node, notes: [{ id: 'bad', text: 'x'.repeat(200_001), createdAt: 1 }] } : node) }), false, 'Oversized note payload is rejected');
assert.equal(validMap({ ...copy, layout: 'cycle' }), true);
assert.equal(validMap({ ...copy, layout: 'concentric' }), true);
for (const layout of ['swimlane', 'concept', 'matrix', 'treemap']) assert.equal(validMap({ ...copy, layout }), true);
assert.equal(validMap({ ...copy, layout: 'matrix', nodes: [{ ...copy.nodes[0], matrixRows: ['Impacto', 'Esforço'], matrixColumns: ['Baixo', 'Alto'] }, ...copy.nodes.slice(1)] }), true);
assert.equal(validMap({ ...copy, layout: 'treemap', nodes: [copy.nodes[0], { ...copy.nodes[1], treemapValue: 2.5 }] }), true);
assert.equal(validMap({ ...copy, nodes: [copy.nodes[0], { ...copy.nodes[1], treemapValue: -1 }] }), false);
const flowchart = { ...copy, layout: 'flowchart', nodes: copy.nodes.map((node, index) => index ? { ...node, flowAnswer: 'yes' } : { ...node, flowDecision: true }) };
assert.equal(validMap(flowchart), true);
assert.equal(parseMapFile(JSON.stringify(flowchart), 'fluxograma.json').map.nodes[1].flowAnswer, 'yes');
assert.equal(validMap({ ...flowchart, nodes: [{ ...flowchart.nodes[0], flowDecision: 'yes' }, ...flowchart.nodes.slice(1)] }), false);
assert.equal(validMap({ ...flowchart, nodes: [flowchart.nodes[0], { ...flowchart.nodes[1], flowAnswer: 'maybe' }] }), false);
assert.equal(validMap({ ...copy, nodes: [] }), false);
assert.equal(validMap({ ...copy, nodes: [copy.nodes[0], { ...copy.nodes[0], id: crypto.randomUUID() }] }), false, 'Only one central root is allowed');
assert.equal(validMap({ ...copy, nodes: [{ ...copy.nodes[0], parentId: 'missing' }] }), false);
assert.equal(validMap({ ...copy, nodes: [{ ...copy.nodes[0], floating: true, parentId: copy.nodes[1].id }] }), false);
assert.equal(validMap({ ...copy, nodes: [{ ...copy.nodes[0], richText: [{ text: { invalid: true } }] }] }), false);
assert.equal(validMap({ ...copy, nodes: [{ ...copy.nodes[0], richText: [{ text: 'Parcial', bold: true, highlight: '#fff0a8', fontSize: 20, fontFamily: 'Georgia, serif', lineSpacing: 1.5, letterSpacing: 0.4, textTransform: 'uppercase' }] }] }), true, 'Partial typography survives cloud validation');
assert.equal(validMap({ ...copy, nodes: [{ ...copy.nodes[0], richText: [{ text: 'Inválido', fontSize: 200 }] }] }), false);
assert.equal(validMap({ ...copy, nodes: [{ ...copy.nodes[0], richText: [{ text: 'x'.repeat(1001) }] }] }), false);
assert.equal(validMap({ ...copy, nodes: [{ ...copy.nodes[0], comments: [{ id: 'comment', text: 123, createdAt: Date.now() }] }] }), false);
assert.equal(validMap({ ...copy, nodes: [{ ...copy.nodes[0], task: { done: false, progress: 101 } }] }), false);
assert.equal(validMap({ ...copy, nodes: [{ ...copy.nodes[0], url: 'javascript:alert(1)' }] }), false);
assert.equal(validMap({ ...copy, nodes: [{ ...copy.nodes[0], mediaUrl: 'data:text/html,unsafe' }] }), false);
assert.equal(validMap({ ...copy, siblingReorder: 'yes' }), false);
assert.equal(validMap({ ...copy, nodes: [{ ...copy.nodes[0], url: '', image: '', mediaUrl: '' }] }), true, 'Clearing optional URL fields remains saveable');
assert.equal(validMap({ ...copy, nodes: [{ ...copy.nodes[0], url: 'nodumapp.site' }] }), true, 'Existing scheme-less links remain saveable');
assert.equal(validMap({ ...copy, relationships: 'invalid' }), false);
assert.equal(validMap({ ...copy, relationships: [{ id: 'link', source: copy.nodes[0].id, target: 'missing' }] }), false);
assert.equal(validMap({ ...copy, relationships: [{ id: 'link', source: copy.nodes[0].id, target: copy.nodes[0].id }] }), false);
assert.equal(validMap({ ...copy, stylePresets: [{ id: 'preset', name: 'Inválido', style: { width: 20 } }] }), false);
assert.equal(validMap({ ...copy, levelReferences: [{ parentId: 'missing', mode: 'both', style: {} }] }), false);
assert.equal(validMap({ ...copy, levelConnections: [{ parentId: 'missing', style: {} }] }), false);
const deepNodes = [{ ...copy.nodes[0], id: 'depth-0' }];
for (let depth = 1; depth <= 101; depth++) deepNodes.push({ ...copy.nodes[0], id: `depth-${depth}`, parentId: `depth-${depth - 1}` });
assert.equal(validMap({ ...copy, nodes: deepNodes }), false, 'Hierarchy depth is limited to 100');
const fullMap = {
  ...copy, siblingReorder: true,
  favoriteIcons: ['✦'], spacing: { x: 260, y: 112 }, movementMode: 'hierarchical', avoidOverlap: true,
  defaultNodeStyle: { background: '#ffffff', width: 145, wrapText: true },
  stylePresets: [{ id: 'preset', name: 'Modelo', style: { color: '#20243b' } }],
  levelReferences: [{ parentId: copy.nodes[0].id, mode: 'both', style: { fontSize: 14 } }],
  levelStyles: [{ depth: 1, style: { border: '#000000' }, autoWidth: true, repeatAfter: true }],
  levelConnections: [{ parentId: copy.nodes[0].id, style: { color: '#7057e8', width: 2, end: 'arrow' } }],
  relationships: [{ id: 'relation', source: copy.nodes[0].id, target: copy.nodes[1].id, label: 'liga', style: { pattern: 'dashed' } }],
  nodes: copy.nodes.map((node, index) => index ? { ...node, url: 'https://example.com', mediaUrl: 'https://example.com/audio', mediaType: 'audio', comments: [{ id: 'comment', text: 'Texto', createdAt: Date.now() }], task: { done: false, progress: 50, due: '2026-10-30' }, richText: [{ text: node.text, bold: true, highlight: '#fff0a8' }] } : node),
};
assert.equal(validMap(fullMap), true, 'All supported nested fields remain valid');
const largeMap = { ...copy, nodes: Array.from({ length: 270 }, (_, index) => ({ ...copy.nodes[0], id: `large-${index}`, parentId: index ? 'large-0' : null, note: 'x'.repeat(100_000) })) };
assert.ok(new TextEncoder().encode(JSON.stringify(largeMap)).length > 25 * 1024 * 1024);
assert.equal(validMap(largeMap), true, 'Persisted maps may exceed 25 MB');
const jsonMom = parseMapFile(JSON.stringify({ name: 'Mapa', topics: [{ text: 'Centro', subTopics: [{ text: 'Filho' }] }] }), 'mapa.mom');
assert.equal(jsonMom.map.nodes.length, 2);
const archive = zipSync({ 'document.json': strToU8(JSON.stringify({ mapInfo: { rootId: 'root', name: 'Exemplo' } })), 'nodes.json': strToU8(JSON.stringify([{ id: 'root', title: 'Centro' }, { id: 'child', parentId: 'root', title: 'Filho' }, { id: 'gone', parentId: 'root', title: 'Excluído', deleted: true }])) });
const importedArchive = parseMindomoArchive(archive, 'exemplo.mom').map;
assert.equal(importedArchive.nodes.length, 2);
assert.equal(importedArchive.nodes[1].parentId, importedArchive.nodes[0].id);
const packaged = zipSync({ 'maps/exemplo.mom': archive, 'attachments/image.png': new Uint8Array([1, 2, 3]) });
assert.equal(parseMindomoArchive(packaged, 'exemplo.pmom').map.nodes.length, 2);
const folderPackage = zipSync({ 'map/document.json': strToU8(JSON.stringify({ mapInfo: { rootId: 'root', name: 'Exemplo' } })), 'map/nodes.json': strToU8(JSON.stringify([{ id: 'root', title: 'Centro' }, { id: 'child', parentId: 'root', title: 'Filho' }])) });
assert.equal(parseMindomoArchive(folderPackage, 'exemplo.pmom').map.nodes.length, 2);
const tooManyEntries = Object.fromEntries(Array.from({ length: 1001 }, (_, index) => [`attachments/${index}.txt`, new Uint8Array()]));
assert.throws(() => parseMindomoArchive(zipSync({ ...tooManyEntries, 'document.json': strToU8('{}'), 'nodes.json': strToU8('[]') }), 'muitas-entradas.mom'));
const nineMb = new Uint8Array(9 * 1024 * 1024);
assert.throws(() => parseMindomoArchive(zipSync({ 'a/document.json': nineMb, 'a/nodes.json': nineMb, 'b/document.json': nineMb }), 'expandido.mom'), /Não foi possível abrir/);
const disconnected = zipSync({ 'document.json': strToU8(JSON.stringify({ mapInfo: { rootId: 'root', name: 'Exemplo' } })), 'nodes.json': strToU8(JSON.stringify([{ id: 'root', title: 'Mind Map' }, { id: 'branch', parentId: 'missing', title: 'Ramo' }, { id: 'leaf', parentId: 'branch', title: 'Folha' }])) });
const recovered = parseMindomoArchive(disconnected, 'desconectado.mom');
assert.equal(recovered.map.nodes.length, 3);
assert.match(recovered.warning, /recuperados/);
assert.equal(recovered.map.nodes[2].parentId, recovered.map.nodes[1].id);
const txt = parseMapFile('Centro\n\tFilho\n\t\tNeto\n\tOutro', 'exemplo.txt').map;
assert.deepEqual(txt.nodes.map(node => node.text), ['Centro', 'Filho', 'Neto', 'Outro']);
assert.equal(txt.nodes[2].parentId, txt.nodes[1].id);
assert.equal(txt.nodes[3].parentId, txt.nodes[0].id);
const md = parseMapFile('# Centro\n## Filho\n### Neto\n## Outro', 'exemplo.md').map;
assert.equal(md.nodes.length, 4);
assert.equal(md.nodes[2].parentId, md.nodes[1].id);
const mindomoMarkdown = parseMapFile('# Centro\n## Ramo\n- Subtópico\n\t- Neto', 'mindomo.md').map;
assert.equal(mindomoMarkdown.nodes[2].parentId, mindomoMarkdown.nodes[1].id);
assert.equal(mindomoMarkdown.nodes[3].parentId, mindomoMarkdown.nodes[2].id);
const floatingMarkdown = parseMapFile('# Centro\n# Ideia flutuante\n- Detalhe', 'flutuante.md').map;
assert.equal(floatingMarkdown.nodes.length, 3);
assert.equal(floatingMarkdown.nodes[2].parentId, floatingMarkdown.nodes[1].id);
const ownMarkdown = parseMapFile('# Título do mapa\n\n- Raiz\n  - Filho\n    - Neto', 'meu.md').map;
assert.equal(ownMarkdown.nodes.length, 4);
assert.equal(ownMarkdown.nodes[1].parentId, ownMarkdown.nodes[0].id);
const bigNodes = [{ id: 'root', title: 'Mind Map' }, ...Array.from({ length: 4 }, (_, i) => ({ id: `branch-${i}`, parentId: 'root', title: `Ramo ${i}` })), ...Array.from({ length: 120 }, (_, i) => ({ id: `child-${i}`, parentId: `branch-${Math.floor(i / 30)}`, title: `Tópico ${i}` }))];
const bigArchive = zipSync({ 'document.json': strToU8(JSON.stringify({ mapInfo: { rootId: 'root', name: 'Projeto real' } })), 'nodes.json': strToU8(JSON.stringify(bigNodes)) });
const bigMap = parseMindomoArchive(bigArchive, 'grande.mom').map;
assert.equal(bigMap.nodes.length, 125);
assert.equal(bigMap.nodes[0].text, 'Projeto real');
assert.equal(bigMap.nodes.filter(node => node.collapsed).length, 4);
if (process.env.MINDOMO_SAMPLE) {
  const sample = await readFile(process.env.MINDOMO_SAMPLE);
  const actual = parseMindomoArchive(sample, 'amostra.mom').map;
  assert.ok(actual.nodes.length > 1, 'O arquivo real precisa manter os subtópicos.');
  assert.ok(actual.nodes.some(node => node.parentId === actual.nodes[0].id), 'O arquivo real precisa manter os ramos principais.');
  console.log(`Arquivo Mindomo real: ${actual.nodes.length} tópicos preservados, ${actual.nodes.filter(node => node.parentId === actual.nodes[0].id).length} ramos principais.`);
}
console.log('Importação: XML Mindomo, JSON hierárquico, backup nodum, isolamento e rejeição de arquivos inválidos OK.');
