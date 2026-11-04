import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile('lib/maps.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { layoutConflictCount, layoutMap, layoutSize, packTreeLayout, visibleNodes } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const node = (id, parentId, width = 145, height = 50, extras = {}) => ({ id, parentId, text: id, x: 0, y: 0, width, height, ...extras });
const sourceNodes = [
  node('root', null, 182, 62),
  node('level-1-a', 'root', 230, 70, { branchLayout: 'down' }),
  node('level-1-b', 'root', 175, 58),
  node('level-1-c', 'root', 180, 58),
  node('level-2-a', 'level-1-a', 290, 95),
  node('level-2-b', 'level-1-a', 220, 70),
  node('level-3', 'level-2-a', 200, 80),
  node('level-2-c', 'level-1-b', 260, 65),
];
const originalPositions = sourceNodes.map(item => [item.x, item.y]);
assert.ok(layoutConflictCount(sourceNodes, 'horizontal') > 0, 'A saved legacy layout with stacked nodes is detected');
const overlaps = (a, b) => a.x < b.x + b.width + 12 && a.x + a.width + 12 > b.x && a.y < b.y + b.height + 12 && a.y + a.height + 12 > b.y;
for (const mode of ['horizontal', 'right', 'left', 'balanced', 'down', 'up', 'vertical', 'org', 'radial', 'concentric', 'cycle', 'fishbone', 'timeline', 'split-down', 'matrix', 'swimlane']) {
  const nodes = visibleNodes(layoutMap(sourceNodes, mode));
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    assert.ok(!overlaps(nodes[i], nodes[j]), `${mode}: ${nodes[i].id} overlaps ${nodes[j].id}`);
  }
  assert.equal(layoutConflictCount(nodes, mode), 0, `${mode}: no visible node or connection conflict`);
  assert.deepEqual(nodes.map(item => item.parentId), sourceNodes.map(item => item.parentId), `${mode}: hierarchy stays unchanged`);
}
const horizontal = visibleNodes(layoutMap(sourceNodes, 'horizontal'));
assert.deepEqual(sourceNodes.map(item => [item.x, item.y]), originalPositions, 'Reorganization does not mutate saved snapshots');
assert.deepEqual(layoutMap(horizontal, 'horizontal').map(item => [item.x, item.y]), horizontal.map(item => [item.x, item.y]), 'Reorganization is stable when repeated');
const longText = node('long', 'root', 100, 36, { text: 'Uma frase extensa com várias palavras e uma segunda linha\nque precisa aparecer integralmente.', note: 'Nota disponível no ícone', comments: [{ id: 'comment', text: 'Comentário', createdAt: 0 }] });
assert.ok(layoutSize(longText).height > longText.height, 'User height acts as a minimum; wrapped text and attachment icons remain visible');
assert.ok(layoutSize({ ...longText, wrapText: false }).width > longText.width, 'Opting out of wrapping expands width instead of clipping the title');
const measured = packTreeLayout([node('root', null), node('a', 'root', 145, 50, { x: 260 }), node('b', 'root', 145, 50, { x: 260, y: 100 })], 'horizontal', new Map([['a', { width: 145, height: 240 }]]));
assert.ok(measured[2].y >= measured[1].y + 240 + 28, 'Measured content height pushes the sibling branch below it');
const inlineSource = node('inline-root', null, 182, 62);
const inlineChild = node('inline-child', inlineSource.id, 210, 50, { x: 310, y: 0, shape: 'underline', text: 'Texto longo sobre a linha que deve quebrar em várias linhas sem deslocar a conexão' });
const inline = packTreeLayout([inlineSource, inlineChild], 'horizontal');
const baseline = item => item.y + layoutSize(item).height - 1;
assert.ok(Math.abs(inline[0].y + layoutSize(inline[0]).height / 2 - baseline(inline[1])) < 1, 'The underline meets the source at one horizontal baseline');
const narrowed = packTreeLayout([inlineSource, { ...inlineChild, width: 110 }], 'horizontal');
assert.ok(layoutSize(narrowed[1]).height > layoutSize(inline[1]).height, 'User width wraps the title and increases its height');
assert.ok(Math.abs(narrowed[0].y + layoutSize(narrowed[0]).height / 2 - baseline(narrowed[1])) < 1, 'Wrapping leaves the connection horizontally aligned');
const leftInline = layoutMap([inlineSource, { ...inlineChild, x: -310 }], 'left');
assert.ok(leftInline[1].x + layoutSize(leftInline[1]).width < leftInline[0].x, 'The underlined child can sit to the left of its parent');
assert.ok(Math.abs(leftInline[0].y + layoutSize(leftInline[0]).height / 2 - baseline(leftInline[1])) < 1, 'The left-facing underline also shares the source baseline');
assert.deepEqual(packTreeLayout(narrowed, 'horizontal').map(item => item.y), narrowed.map(item => item.y), 'Repeated packing preserves the underline alignment');
const measuredInline = packTreeLayout([inlineSource, inlineChild], 'horizontal', new Map([[inlineChild.id, { width: 210, height: 180 }]]));
assert.ok(Math.abs(measuredInline[0].y + layoutSize(measuredInline[0]).height / 2 - measuredInline[1].y - 179) < 1, 'The measured text height realigns the underline');
for (const child of horizontal.filter(item => item.parentId)) {
  const parent = horizontal.find(item => item.id === child.parentId);
  if (parent.branchLayout && parent.branchLayout !== 'horizontal') continue;
  const trunkX = parent.x + parent.width + 24;
  const fromY = parent.y + parent.height / 2;
  const toY = child.y + child.height / 2;
  for (const other of horizontal.filter(item => item.id !== parent.id && item.id !== child.id)) {
    assert.ok(!(trunkX > other.x && trunkX < other.x + other.width && Math.max(fromY, toY) > other.y && Math.min(fromY, toY) < other.y + other.height), `Connection ${parent.id} → ${child.id} crosses ${other.id}`);
  }
}
const locked = layoutMap([node('root', null), node('a', 'root', 180, 60, { x: 260, y: 0, positionLocked: true }), node('b', 'root', 180, 60)], 'right');
assert.equal(locked[1].x, 260);
assert.equal(locked[1].y, 0);
console.log('Layout: subárvores mistas, dimensões grandes e bloqueio de posição OK.');
