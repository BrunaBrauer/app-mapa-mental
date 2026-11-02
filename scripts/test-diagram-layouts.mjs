import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile('lib/maps.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { autoLayout, treemapRects } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

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

const lanes = autoLayout(original, 'swimlane');
assert.ok(lanes[1].x < lanes[2].x && lanes[2].x < lanes[3].x, 'Main branches define ordered lanes');
assert.ok(lanes[5].x >= lanes[1].x && lanes[5].x < lanes[2].x, 'Descendant stays in its lane');
assert.ok(lanes[5].y > lanes[1].y);

const matrixRoot = { ...root, matrixRows: ['Baixo', 'Alto'], matrixColumns: ['Urgente', 'Depois'] };
const matrix = autoLayout([matrixRoot, { ...stages[0], matrixRow: 1, matrixColumn: 0 }, { ...stages[1], matrixRow: 0, matrixColumn: 1 }], 'matrix');
assert.ok(matrix[1].y > matrix[2].y && matrix[1].x < matrix[2].x, 'Row and column assignments determine cells');
assert.equal(matrix[0].x, 0, 'Matrix root remains anchored');

const blocks = treemapRects([root, { ...stages[0], treemapValue: 3 }, { ...stages[1], treemapValue: 1 }, { ...children[0], treemapValue: 2 }]);
assert.ok(Math.abs(blocks.get(stages[0].id).width / blocks.get(stages[1].id).width - 3) < .01, 'Treemap area follows editable values');
assert.ok(blocks.get(children[0].id).x > blocks.get(stages[0].id).x, 'Nested blocks remain inside their category');

const chronological = autoLayout([root, { ...stages[0], timelineDate: '2028-01-01' }, { ...stages[1], timelineDate: '2026-01-01' }], 'timeline');
assert.ok(chronological[2].x < chronological[1].x, 'Earlier milestones precede later ones');
const rotated = autoLayout([{ ...root, radialStartAngle: 90, radialRadius: 420 }, stages[0]], 'radial');
assert.ok(Math.abs(rotated[1].x) < 1 && rotated[1].y > 250, 'Radial angle and radius affect position');
console.log('Diagramas: ciclo, anéis, fluxograma, raias, matriz, treemap, linha do tempo e radial OK.');
