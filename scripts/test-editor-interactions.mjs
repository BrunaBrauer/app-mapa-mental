import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [editor, canvas, richText, movementSettings, css] = await Promise.all([
  readFile('components/Editor.tsx', 'utf8'),
  readFile('components/MapCanvas.tsx', 'utf8'),
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

console.log('Interações do editor: Backspace seguro, espaços editáveis, cursor visível e arraste sem auto-pan OK.');
