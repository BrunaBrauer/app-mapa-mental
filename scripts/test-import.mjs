import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const compile = async path => ts.transpileModule(await readFile(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const url = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const source = (await compile('lib/import-map.ts'))
  .replace("'./maps'", JSON.stringify(url(await compile('lib/maps.ts'))))
  .replace("'./server-maps'", JSON.stringify(url(await compile('lib/server-maps.ts'))))
  .replace("'fast-xml-parser'", JSON.stringify(import.meta.resolve('fast-xml-parser')));
const { parseMapFile, parseMindomoArchive } = await import(url(source.replace("'fflate'", JSON.stringify(import.meta.resolve('fflate')))));
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
assert.throws(() => parseMapFile('<!DOCTYPE x><map/>', 'bad.mom'));
assert.throws(() => parseMapFile('PK\u0003\u0004', 'archive.mom'));
assert.throws(() => parseMapFile(JSON.stringify({ ...copy, nodes: [{ ...copy.nodes[0], parentId: copy.nodes[0].id }] }), 'cycle.json'));
assert.throws(() => parseMapFile(JSON.stringify({ ...copy, nodes: [copy.nodes[0], copy.nodes[0]] }), 'duplicate.json'));
const jsonMom = parseMapFile(JSON.stringify({ name: 'Mapa', topics: [{ text: 'Centro', subTopics: [{ text: 'Filho' }] }] }), 'mapa.mom');
assert.equal(jsonMom.map.nodes.length, 2);
const archive = zipSync({ 'document.json': strToU8(JSON.stringify({ mapInfo: { rootId: 'root', name: 'Exemplo' } })), 'nodes.json': strToU8(JSON.stringify([{ id: 'root', title: 'Centro' }, { id: 'child', parentId: 'root', title: 'Filho' }, { id: 'gone', parentId: 'root', title: 'Excluído', deleted: true }])) });
const importedArchive = parseMindomoArchive(archive, 'exemplo.mom').map;
assert.equal(importedArchive.nodes.length, 2);
assert.equal(importedArchive.nodes[1].parentId, importedArchive.nodes[0].id);
console.log('Importação: XML Mindomo, JSON hierárquico, backup nodum, isolamento e rejeição de arquivos inválidos OK.');
