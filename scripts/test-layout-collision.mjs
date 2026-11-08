import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile('lib/maps.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { layoutConflictCount, layoutMap, layoutSize, packTreeLayout, visibleNodes } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const node = (id, parentId, width = 145, height = 50, extras = {}) => ({ id, parentId, text: id, x: 0, y: 0, width, height, ...extras });
assert.equal(layoutSize({ id: 'compact', parentId: 'root', text: 'Ideia', x: 0, y: 0, width: 145 }).height, 32, 'Short automatic nodes use the compact readable minimum.');
assert.ok(layoutSize({ id: 'wrapped', parentId: 'root', text: 'Um texto longo que precisa quebrar linha para ficar inteiramente visível', x: 0, y: 0, width: 100 }).height > 32, 'Wrapping still grows the node height.');
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
assert.ok(measured[2].y >= measured[1].y + 240 + 16, 'Measured content height keeps a compact, safe gap between siblings');
const siblings = layoutMap([node('compact-root', null), node('first', 'compact-root', 145, 50), node('second', 'compact-root', 145, 80), node('third', 'compact-root', 145, 50)], 'horizontal');
assert.equal(Math.round(siblings[2].y - siblings[1].y - layoutSize(siblings[1]).height), 16, 'Siblings have the minimum gutter after automatic layout');
assert.equal(Math.round(siblings[3].y - siblings[2].y - layoutSize(siblings[2]).height), 16, 'Each subsequent sibling is packed independently');
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
const spaced = [node('space-root', null, 180, 62), node('space-a', 'space-root', 150, 50, { x: 700 }), node('space-b', 'space-a', 140, 50, { x: 1400 })];
const compact = packTreeLayout(spaced, 'horizontal');
assert.equal(compact[1].x, compact[0].x + layoutSize(compact[0]).width + 72, 'The first level uses the standardized connection gap');
assert.equal(compact[2].x, compact[1].x + layoutSize(compact[1]).width + 72, 'An inherited oversized gap is compacted at the next level');
const grown = packTreeLayout(spaced.map(item => item.id === 'space-a' ? { ...item, width: 330 } : item), 'horizontal');
assert.equal(grown[2].x - grown[1].x, layoutSize(grown[1]).width + 72, 'A wider parent pushes its descendants while preserving the gap');
const measuredWidth = packTreeLayout(spaced, 'horizontal', new Map([['space-a', { width: 275, height: 50 }]]));
assert.equal(measuredWidth[2].x - measuredWidth[1].x, 275 + 72, 'Actual rendered width governs the following level');
const compactSpacing = packTreeLayout(spaced, 'horizontal', undefined, { x: 210, y: 82 });
const wideSpacing = packTreeLayout(spaced, 'horizontal', undefined, { x: 320, y: 150 });
assert.equal(compactSpacing[1].x - compactSpacing[0].x - layoutSize(compactSpacing[0]).width, 48, 'Compact spacing keeps a usable minimum connection channel');
assert.equal(wideSpacing[1].x - wideSpacing[0].x - layoutSize(wideSpacing[0]).width, 132, 'Wide spacing remains available when selected');
assert.deepEqual(packTreeLayout(compact, 'horizontal').map(item => item.x), compact.map(item => item.x), 'Compact columns remain stable on repeated layout');
const mixedWidths = packTreeLayout([node('m-root', null, 180, 62), node('wide', 'm-root', 310, 60, { x: 800 }), node('narrow', 'm-root', 120, 60, { x: 800, y: 250 }), node('wide-child', 'wide', 130, 50, { x: 1600 }), node('narrow-child', 'narrow', 130, 50, { x: 1600, y: 250 })], 'horizontal');
const byName = new Map(mixedWidths.map(item => [item.id, item]));
assert.equal(byName.get('wide-child').x, byName.get('narrow-child').x, 'Second-level siblings share a column');
assert.ok(byName.get('narrow-child').x >= byName.get('wide').x + 310 + 72, 'The widest preceding node determines the next column');
for (let i = 0; i < mixedWidths.length; i++) for (let j = i + 1; j < mixedWidths.length; j++) assert.ok(!overlaps(mixedWidths[i], mixedWidths[j]), 'Compaction does not overlap neighboring branches');
const verticalCompact = packTreeLayout([node('v-root', null, 180, 62), node('v-a', 'v-root', 150, 80, { y: 600 }), node('v-b', 'v-a', 140, 50, { y: 1200 })], 'down');
assert.equal(verticalCompact[1].y, verticalCompact[0].y + layoutSize(verticalCompact[0]).height + 72, 'Vertical levels use the same minimum gap');
assert.equal(verticalCompact[2].y, verticalCompact[1].y + layoutSize(verticalCompact[1]).height + 72, 'Vertical resizing also compacts descendants');
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
