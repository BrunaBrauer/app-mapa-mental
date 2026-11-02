import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile('lib/maps.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { autoLayout } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

const root = { id: 'root', parentId: null, text: 'Centro', x: 0, y: 0 };
const stages = Array.from({ length: 4 }, (_, index) => ({ id: `stage-${index}`, parentId: root.id, text: `Etapa ${index}`, x: 0, y: 0 }));
const children = [{ id: 'child-a', parentId: stages[0].id, text: 'A', x: 0, y: 0 }, { id: 'child-b', parentId: stages[1].id, text: 'B', x: 0, y: 0 }];
const floating = { id: 'floating', parentId: null, floating: true, text: 'Livre', x: 900, y: 600 };
const original = [root, ...stages, ...children, floating];
const center = { x: 91, y: 36 };
const distance = node => Math.hypot(node.x + 80 - center.x, node.y + 32 - center.y);

const cycle = autoLayout(original, 'cycle');
assert.deepEqual(cycle.map(node => node.id), original.map(node => node.id));
assert.deepEqual(cycle.at(-1), floating);
assert.ok(cycle.slice(1, 5).every(node => Math.abs(distance(node) - distance(cycle[1])) < 0.01), 'Stages occupy one ring');
assert.ok(cycle.slice(5, 7).every(node => distance(node) > distance(cycle[1]) + 100), 'Substeps stay outside the stage ring');
assert.equal(original[1].x, 0, 'Layout does not mutate input nodes');

const concentric = autoLayout(original, 'concentric');
assert.deepEqual(concentric.at(-1), floating);
assert.ok(concentric.slice(1, 5).every(node => Math.abs(distance(node) - distance(concentric[1])) < 0.01), 'First level occupies one ring');
assert.ok(concentric.slice(5, 7).every(node => Math.abs(distance(node) - distance(concentric[5])) < 0.01), 'Second level occupies another ring');
assert.ok(distance(concentric[5]) > distance(concentric[1]));

const collapsed = autoLayout([{ ...root, collapsed: true }, ...stages], 'cycle');
assert.ok(collapsed.slice(1).every(node => node.x === 0 && node.y === 0), 'Collapsed descendants keep their saved positions');

const decision = { ...root, flowDecision: true };
const no = { id: 'no', parentId: root.id, text: 'Alternativa não', x: 0, y: 0, flowAnswer: 'no' };
const yes = { id: 'yes', parentId: root.id, text: 'Alternativa sim', x: 0, y: 0, flowAnswer: 'yes' };
const flow = autoLayout([decision, no, yes, floating], 'flowchart');
assert.ok(flow[2].x < flow[1].x, 'Yes path stays left of No regardless of input order');
assert.equal(flow[1].y, flow[2].y, 'Decision alternatives share a level');
assert.ok(flow[1].y > flow[0].y, 'Flow advances downward');
assert.deepEqual(flow[3], floating);
console.log('Diagramas: ciclo, anéis, fluxograma Sim/Não, nós flutuantes e ramos recolhidos OK.');
