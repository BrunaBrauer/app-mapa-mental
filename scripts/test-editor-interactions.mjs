import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const [editor, canvas, nodeView, richText, movementSettings, css] = await Promise.all([
  readFile('components/Editor.tsx', 'utf8'),
  readFile('components/MapCanvas.tsx', 'utf8'),
  readFile('components/MindNodeView.tsx', 'utf8'),
  readFile('components/RichTextEditor.tsx', 'utf8'),
  readFile('components/MovementSettings.tsx', 'utf8'),
  readFile('app/globals.css', 'utf8'),
]);

assert.doesNotMatch(editor, /event\.key === 'Delete' \|\| event\.key === 'Backspace'/, 'Backspace must not delete selected nodes');
assert.match(editor, /event\.key === 'Delete' && selectedId/, 'Delete remains the explicit node-removal shortcut');
assert.match(canvas, /closest\('input,textarea,select,\[contenteditable="true"\]'\)/, 'Canvas navigation must ignore text editors');
assert.match(canvas, /panActivationKeyCode=\{null\}/, 'React Flow must not capture Space independently');
assert.match(canvas, /autoPanOnNodeDrag=\{false\}/, 'Dragging must not pan the map out of view');
assert.match(richText, /onKeyDown=\{event => \{ event\.stopPropagation\(\);/, 'Text keystrokes must stay inside the editor');
assert.match(css, /caret-color:var\(--accent\)/, 'The insertion caret must remain visible');
assert.match(css, /react-flow__node\.draggable\.dragging \.mind-node\{cursor:grabbing\}/, 'Dragging must expose a stable cursor');
assert.match(canvas, /map\.siblingReorder && requested\.size === 1/, 'Aligned reordering must be opt-in');
assert.match(movementSettings, /checked=\{Boolean\(map\.siblingReorder\)\}/, 'The map must expose an aligned-reordering toggle');
for (const side of ['left', 'right', 'top', 'bottom']) assert.match(nodeView, new RegExp(`type="target" id="target-${side}"`), `Tree edges need a registered ${side} target handle`);
assert.match(canvas, /map\.layout === 'horizontal'[\s\S]*?sourceHandle: 'source-right', targetHandle: 'target-left'/, 'Every horizontal tree edge starts at the right side');
assert.match(canvas, /map\.layout === 'vertical' \|\| map\.layout === 'flowchart'[\s\S]*?sourceHandle: 'source-bottom', targetHandle: 'target-top'/, 'Every vertical tree edge starts at the bottom');

const richCode = ts.transpileModule(await readFile('lib/rich-text.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { richTextHtml, formatWholeText } = await import(`data:text/javascript;base64,${Buffer.from(richCode).toString('base64')}`);
const colored = richTextHtml('texto', [{ text: 'texto', color: '#123456', highlight: '#ffff00', bold: true }]);
assert.match(colored, /<span style="background-color:#ffff00;color:#123456"><strong>texto<\/strong><\/span>/);
const partial = [{ text: 'uma ', italic: true }, { text: 'palavra', bold: true }];
assert.deepEqual(formatWholeText('uma palavra', partial, { highlight: '#ffcc00' }), [
  { text: 'uma ', italic: true, highlight: '#ffcc00' },
  { text: 'palavra', bold: true, highlight: '#ffcc00' },
], 'Whole-text formatting preserves other partial styles');
assert.match(richTextHtml('x', [{ text: 'x', fontSize: 20, fontFamily: 'Georgia, serif', lineSpacing: 1.5, letterSpacing: 0.4 }]), /font-size:20px;font-family:Georgia, serif;line-height:1.5;letter-spacing:0.4px/);
assert.doesNotMatch(richTextHtml('x', [{ text: '<script>', color: 'red" onmouseover="evil' }]), /<script>|onmouseover/);

console.log('Interações do editor: Backspace seguro, espaços editáveis, cursor visível, arraste e conexões alinhadas OK.');
