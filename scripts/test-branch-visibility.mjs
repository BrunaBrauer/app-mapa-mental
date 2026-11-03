import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile('lib/maps.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { branchCounts, branchDirection, layoutMap, toggleBranch, visibleNodes } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const node = (id, parentId, collapsed = false) => ({ id, parentId, text: id, x: 0, y: 0, collapsed });
// Six levels; one deeply collapsed branch must retain its own state after an ancestor reopens.
const nodes = [node('root', null), node('a', 'root'), node('b', 'root'), node('c', 'a', true), node('d', 'c'), node('e', 'd', true), node('f', 'e'), node('g', 'd')];
const counts = branchCounts(nodes);
assert.deepEqual(counts.get('root'), { direct: 2, total: 7 });
assert.deepEqual(counts.get('c'), { direct: 1, total: 4 });
assert.deepEqual(counts.get('e'), { direct: 1, total: 1 });
assert.deepEqual(counts.get('f'), { direct: 0, total: 0 });
assert.strictEqual(toggleBranch(nodes, 'f'), nodes, 'Terminal nodes cannot collapse');
assert.deepEqual(visibleNodes(nodes).map(item => item.id), ['root', 'a', 'b', 'c']);

const opened = toggleBranch(nodes, 'c');
assert.deepEqual(visibleNodes(opened).map(item => item.id), ['root', 'a', 'b', 'c', 'd', 'e', 'g']);
assert.equal(opened.find(item => item.id === 'e').collapsed, true);
const closedAncestor = toggleBranch(opened, 'a');
assert.deepEqual(visibleNodes(closedAncestor).map(item => item.id), ['root', 'a', 'b']);
assert.equal(closedAncestor.find(item => item.id === 'e').collapsed, true);
const restored = toggleBranch(closedAncestor, 'a');
assert.deepEqual(visibleNodes(restored).map(item => item.id), ['root', 'a', 'b', 'c', 'd', 'e', 'g']);
assert.equal(restored.find(item => item.id === 'e').collapsed, true);
assert.deepEqual(nodes.map(item => item.collapsed), [false, false, false, true, false, true, false, false], 'Original data remains untouched');

const positions = layoutMap(restored, 'horizontal');
const byId = new Map(positions.map(item => [item.id, item]));
assert.equal(byId.get('a').x, byId.get('b').x, 'Visible siblings share a column');
assert.ok(byId.get('d').x > byId.get('c').x, 'Hierarchy remains ordered');
assert.equal(byId.get('e').collapsed, true);
const compacted = layoutMap(toggleBranch(restored, 'a'), 'horizontal');
const remaining = visibleNodes(compacted);
assert.deepEqual(remaining.map(item => item.id), ['root', 'a', 'b']);
assert.ok(Math.abs(remaining.find(item => item.id === 'a').y - remaining.find(item => item.id === 'b').y) <= 112, 'Collapsed descendants do not reserve empty rows');
assert.deepEqual(compacted.map(item => item.parentId), nodes.map(item => item.parentId));

assert.equal(branchDirection(nodes[0], [nodes[1]], 'horizontal'), 'right');
assert.equal(branchDirection(nodes[0], [nodes[1]], 'left'), 'left');
assert.equal(branchDirection(nodes[0], [nodes[1]], 'up'), 'top');
assert.equal(branchDirection(nodes[0], [nodes[1]], 'down'), 'bottom');
assert.equal(branchDirection(nodes[0], [{ ...nodes[1], x: -200 }], 'balanced'), 'left');
console.log('Ramificações: estado individual, contagens, direção e compactação OK.');
