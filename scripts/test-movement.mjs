import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const compile = async path => ts.transpileModule(await readFile(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const url = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const movementUrl = url((await compile('lib/movement.ts')).replace("'./maps'", JSON.stringify(url(await compile('lib/maps.ts')))));
const movement = await import(movementUrl);
const { effectiveMovementMode, movementModes, childMovementSettings, projectDrag, reorganizeBranch, alignNodes, snapMoveAwayFromOverlap, overlappingIds } = movement;
const { alignedHandles } = await import(url((await compile('lib/edge-geometry.ts')).replace("'./movement'", JSON.stringify(movementUrl))));
const nodes = [
  { id: 'root', parentId: null, text: 'Centro', x: 0, y: 0 },
  { id: 'branch', parentId: 'root', text: 'Ramo', x: 260, y: 0 },
  { id: 'leaf', parentId: 'branch', text: 'Filho', x: 520, y: 0 },
  { id: 'other', parentId: 'root', text: 'Outro', x: 260, y: 200 },
];
const map = { id: 'test-map', title: 'Teste', layout: 'right', nodes, updatedAt: 0 };
assert.equal(effectiveMovementMode(map, 'leaf'), 'hierarchical');
assert.equal(movementModes(map).get('leaf'), 'hierarchical');
assert.equal(effectiveMovementMode({ ...map, movementMode: 'individual' }, 'leaf'), 'individual');
assert.equal(effectiveMovementMode({ ...map, movementMode: 'individual', nodes: nodes.map(node => node.id === 'branch' ? { ...node, movementMode: 'automatic' } : node) }, 'leaf'), 'automatic');
assert.equal(effectiveMovementMode({ ...map, movementMode: 'individual', nodes: nodes.map(node => node.id === 'leaf' ? { ...node, inheritMovement: false } : node.id === 'branch' ? { ...node, movementMode: 'automatic' } : node) }, 'leaf'), 'individual');
assert.deepEqual(childMovementSettings({ ...nodes[1], inheritMovementToChildren: false }), { inheritMovement: false });

const requested = new Map([['branch', { x: 310, y: 40 }]]);
const hierarchical = projectDrag(map, requested, 'hierarchical');
assert.deepEqual(hierarchical.positions.get('branch'), { x: 310, y: 40 });
assert.deepEqual(hierarchical.positions.get('leaf'), { x: 570, y: 40 });
assert.equal(hierarchical.positions.has('other'), false);
const individual = projectDrag(map, requested, 'individual');
assert.equal(individual.positions.has('leaf'), false);
assert.equal(projectDrag(map, requested, 'individual', 'branch').positions.get('leaf').x, 570);
assert.equal(projectDrag(map, requested, 'automatic').automaticRoots[0], 'branch');
const locked = { ...map, nodes: nodes.map(node => node.id === 'leaf' ? { ...node, positionLocked: true } : node) };
assert.equal(projectDrag(locked, requested, 'hierarchical').positions.size, 0);
assert.match(projectDrag(locked, requested, 'hierarchical').blocked, /bloqueada/);

const messy = { ...map, nodes: nodes.map(node => node.id === 'leaf' ? { ...node, x: 700, y: 400 } : node) };
const organized = reorganizeBranch(messy, 'branch', false);
assert.equal(organized.nodes.find(node => node.id === 'root').x, 0);
assert.equal(organized.nodes.find(node => node.id === 'other').y, 200);
assert.equal(organized.nodes.find(node => node.id === 'leaf').x, 520);
assert.equal(organized.nodes.find(node => node.id === 'leaf').y, 0);
const lockedOrganized = reorganizeBranch({ ...messy, nodes: messy.nodes.map(node => node.id === 'leaf' ? { ...node, positionLocked: true } : node) }, 'branch', true);
assert.equal(lockedOrganized.nodes.find(node => node.id === 'leaf').y, 400);
const screenshotLike = { ...map, nodes: nodes.map(node => node.id === 'branch' ? { ...node, x: 370, y: 245 } : node.id === 'other' ? { ...node, x: 400, y: 218 } : node) };
assert.ok(overlappingIds(screenshotLike.nodes, new Set(['branch', 'other'])).size > 0);
assert.equal(overlappingIds(reorganizeBranch(screenshotLike, 'root', true).nodes, new Set(['branch', 'other'])).size, 0);
const aligned = alignNodes(locked, ['root', 'branch', 'leaf'], 'top');
assert.equal(aligned.nodes.find(node => node.id === 'leaf').y, 0);
assert.equal(aligned.nodes.find(node => node.id === 'branch').y, 0);
assert.equal(alignNodes({ ...locked, nodes: locked.nodes.map(node => node.id === 'leaf' ? { ...node, y: 50, positionLocked: true } : node) }, ['root', 'branch', 'leaf'], 'top').nodes.find(node => node.id === 'leaf').y, 50);
assert.equal(alignNodes(map, ['root', 'branch', 'leaf'], 'distribute-x').nodes.length, 4);

const colliding = { ...map, nodes: nodes.map(node => node.id === 'other' ? { ...node, x: 300, y: 30 } : node) };
const landing = snapMoveAwayFromOverlap(colliding, new Set(['other']));
assert.equal(landing.adjusted, true);
assert.equal(overlappingIds(landing.map.nodes, new Set(['other'])).size, 0);
const branchCollision = { ...map, nodes: nodes.map(node => node.id === 'branch' ? { ...node, x: 10, y: 10 } : node.id === 'leaf' ? { ...node, x: 270, y: 10 } : node) };
const branchLanding = snapMoveAwayFromOverlap(branchCollision, new Set(['branch', 'leaf']));
assert.equal(branchLanding.adjusted, true);
assert.equal(branchLanding.map.nodes.find(node => node.id === 'leaf').x - branchLanding.map.nodes.find(node => node.id === 'branch').x, 260);
assert.equal(overlappingIds(branchLanding.map.nodes, new Set(['branch', 'leaf'])).size, 0);
assert.deepEqual(alignedHandles(nodes[0], nodes[1]), { sourceHandle: 'source-right', targetHandle: 'source-left' });
assert.deepEqual(alignedHandles(nodes[0], { ...nodes[1], x: 0, y: -260 }), { sourceHandle: 'source-top', targetHandle: 'source-bottom' });
assert.deepEqual(alignedHandles(nodes[0], { ...nodes[1], x: -300, y: 0 }), { sourceHandle: 'source-left', targetHandle: 'source-right' });

const many = { ...map, nodes: [nodes[0], nodes[1], ...Array.from({ length: 150 }, (_, index) => ({ id: `n-${index}`, parentId: 'branch', text: 'Nó', x: 520, y: index * 80 }))] };
const start = performance.now();
const movedMany = projectDrag(many, requested, 'hierarchical');
assert.equal(movedMany.positions.size, 151);
assert.ok(performance.now() - start < 200, 'O arraste de 150 nós deve continuar fluido.');
const organizeStart = performance.now();
assert.equal(reorganizeBranch(many, 'branch', true).nodes.length, 152);
assert.ok(performance.now() - organizeStart < 1500, 'A prévia automática de 150 nós não deve bloquear o editor.');
console.log('Movimentação: herança, três modos, bloqueio, ramo, alinhamento e 150 nós OK.');
