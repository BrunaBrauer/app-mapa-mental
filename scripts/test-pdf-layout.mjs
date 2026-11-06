import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile('lib/pdf-layout.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { pdfPaperSizes, pdfPageDimensions, pdfImagePlacement } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
assert.deepEqual(Object.keys(pdfPaperSizes), ['A4', 'A3', 'A2', 'A1', 'A0']);
assert.deepEqual(pdfPageDimensions('A4', 'portrait', 0, 0, 2), { width: 210, height: 297 });
assert.deepEqual(pdfPageDimensions('A4', 'auto', 0, 0, 2), { width: 297, height: 210 });
assert.deepEqual(pdfPageDimensions('A0', 'landscape', 0, 0, 2), { width: 1189, height: 841 });
assert.deepEqual(pdfPageDimensions('custom', 'auto', 500, 220, 0.5), { width: 500, height: 220 });
assert.deepEqual(pdfPageDimensions('custom', 'portrait', 500, 220, 2), { width: 220, height: 500 });
assert.throws(() => pdfPageDimensions('custom', 'auto', 0, 200, 1), /50 e 2.000/);
const placement = pdfImagePlacement(297, 210, 1600, 800);
assert.equal(placement.width, 277);
assert.ok(placement.x >= 10 && placement.y >= 10);
assert.ok(placement.y + placement.height <= 200);
console.log('PDF: formatos A4–A0, medidas personalizadas, orientação e ajuste proporcional OK.');
