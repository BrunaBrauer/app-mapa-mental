import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const compiled = ts.transpileModule(await readFile('lib/boundary-geometry.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { createBoundaryGeometry } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const boxes = [
  { id: 'root', parentId: null, x: 0, y: 0, width: 170, height: 56 },
  { id: 'child-a', parentId: 'root', x: 270, y: 0, width: 160, height: 60 },
  { id: 'grandchild', parentId: 'child-a', x: 540, y: 0, width: 190, height: 56 },
  { id: 'child-b', parentId: 'root', x: 270, y: 240, width: 160, height: 60 },
  { id: 'outsider', parentId: null, x: 540, y: 236, width: 190, height: 58 },
];
const scope = new Set(['root', 'child-a', 'grandchild', 'child-b']);
const geometry = createBoundaryGeometry(boxes, scope);
assert.ok(geometry?.path.length);
assert.equal(geometry.parts.length >= 4, true, 'Every visible scoped node is included');
const unrelated = boxes.at(-1);
const collision = part => part.x < unrelated.x + unrelated.width && part.x + part.width > unrelated.x && part.y < unrelated.y + unrelated.height && part.y + part.height > unrelated.y;
assert.equal(geometry.parts.some(collision), false, 'No part of the outline may cover an unrelated node');
assert.ok(geometry.x + geometry.width > 730 && geometry.y + geometry.height > 300, 'The full scope is included');
const folded = createBoundaryGeometry(boxes.filter(box => box.id !== 'grandchild'), scope);
assert.ok(folded.width < geometry.width, 'The boundary follows branch visibility');
const resized = createBoundaryGeometry(boxes.map(box => box.id === 'child-a' ? { ...box, width: 220, height: 90 } : box), scope);
assert.ok(resized.parts.some(part => part.x <= 270 && part.x + part.width >= 490), 'Resizing changes the outline');
assert.equal(createBoundaryGeometry(boxes, new Set()), null);
console.log('Limites: escopo completo, nós externos excluídos, recolhimento e redimensionamento OK.');
