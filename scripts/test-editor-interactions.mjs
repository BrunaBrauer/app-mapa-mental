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
assert.match(canvas, /map\.siblingReorder !== false && requested\.size === 1/, 'Aligned reordering is enabled by default and can be disabled');
assert.match(movementSettings, /checked=\{map\.siblingReorder !== false\}/, 'The map must expose an aligned-reordering toggle');
for (const side of ['left', 'right', 'top', 'bottom']) assert.match(nodeView, new RegExp(`type="target" id="target-${side}"`), `Tree edges need a registered ${side} target handle`);
assert.match(nodeView, /node-underline-rule[\s\S]*?item\.connectionStyle\?\.width[\s\S]*?item\.connectionStyle\?\.pattern[\s\S]*?item\.connectionStyle\?\.color/, 'The underlined rule follows the incoming line width, pattern and color');
assert.match(canvas, /reparentBranches\(next, sourceIds, targetId\)/, 'Dropping selected nodes over another updates their hierarchy together');
assert.match(canvas, /const edgeLayout = parent\.branchLayout \|\| map\.layout/, 'Connections follow the parent branch layout');
assert.match(canvas, /horizontalTree[\s\S]*?sourceHandle: 'source-right', targetHandle: 'target-left'/, 'Horizontal tree edges start on the right when the child is actually to the right');
assert.match(canvas, /edgeLayout === 'vertical' \|\| edgeLayout === 'flowchart'[\s\S]*?sourceHandle: 'source-bottom', targetHandle: 'target-top'/, 'Vertical tree edges start at the bottom');

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

const styleCode = ts.transpileModule(await readFile('lib/node-style.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { copyNodeFormatting } = await import(`data:text/javascript;base64,${Buffer.from(styleCode).toString('base64')}`);
const sourceStyle = { id: 'styled', parentId: 'root', text: 'Styled', x: 0, y: 0, width: 230, height: 90, padding: 18, fontSize: 20, color: '#123456', background: '#eeeeee', border: '#ff0000', connectionStyle: { color: '#ff0000', width: 4, pattern: 'dashed' } };
const fullStyle = copyNodeFormatting(sourceStyle, 'all');
const visualStyle = copyNodeFormatting(sourceStyle, 'visual');
const sizeStyle = copyNodeFormatting(sourceStyle, 'size');
assert.equal(fullStyle.width, 230);
assert.equal(fullStyle.height, 90);
assert.equal(fullStyle.connectionStyle.pattern, 'dashed', 'All properties include the connection style');
assert.deepEqual(visualStyle, { color: '#123456', background: '#eeeeee', border: '#ff0000' }, 'Visual mode copies exactly the three requested colors');
assert.equal(sizeStyle.width, 230);
assert.equal(sizeStyle.height, 90);
assert.equal(sizeStyle.fontSize, 20);
assert.equal(sizeStyle.color, undefined, 'Size mode leaves the destination colors untouched');
assert.match(editor, /command && event\.altKey && key === 'v' && selectedIds\.length/, 'Ctrl+Alt+V applies copied style to the selection');
assert.match(editor, /window\.addEventListener\('paste', onClipboard\)/, 'Plain text paste is handled through the browser clipboard event');
assert.match(editor, /application\/x-nodum-branch/, 'Internal branch copies preserve their own clipboard marker');
assert.match(editor, /parentId: selectedId, text: label/, 'Pasted lines become direct children of the selected node');
assert.match(editor, /const nodes = layoutMap\(/, 'Pasted nodes follow the active layout');
assert.doesNotMatch(editor, /selectedId && command && key === 'v'/, 'Ctrl+V must not be swallowed before the clipboard paste event');
const toolbar = await readFile('components/NodeQuickToolbar.tsx', 'utf8');
assert.match(toolbar, /'Editar nó',<span className="quick-rounded-node-icon"/, 'Node editing uses the rounded node shape icon');
const pastedCode = ts.transpileModule(await readFile('lib/paste-text.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { clipboardTextLines } = await import(`data:text/javascript;base64,${Buffer.from(pastedCode).toString('base64')}`);
assert.deepEqual(clipboardTextLines('Primeiro\r\n\r\n Segundo \nTerceiro'), ['Primeiro', 'Segundo', 'Terceiro']);
assert.throws(() => clipboardTextLines('x'.repeat(1001)), /1.000 caracteres/);

const notesCode = ts.transpileModule(await readFile('lib/node-notes.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { notesForNode, appendNodeNote, updateNodeNote, removeNodeNote } = await import(`data:text/javascript;base64,${Buffer.from(notesCode).toString('base64')}`);
const legacyNote = { id: 'old', note: 'Nota antiga' };
assert.equal(notesForNode(legacyNote)[0].text, 'Nota antiga');
const migratedNotes = appendNodeNote(legacyNote, 'Nova nota');
assert.equal(migratedNotes.note, undefined);
assert.deepEqual(migratedNotes.notes.map(note => note.text), ['Nota antiga', 'Nova nota']);
assert.equal(notesForNode({ ...legacyNote, notes: [] }).length, 0, 'An explicitly emptied note list does not revive a legacy note');
const editedNotes = updateNodeNote({ ...legacyNote, ...migratedNotes }, migratedNotes.notes[1].id, 'Atualizada');
assert.deepEqual(editedNotes.notes.map(note => note.text), ['Nota antiga', 'Atualizada']);
const remainingNotes = removeNodeNote({ ...legacyNote, ...editedNotes }, editedNotes.notes[0].id);
assert.deepEqual(remainingNotes.notes.map(note => note.text), ['Atualizada'], 'Deleting one note preserves the others');
assert.deepEqual(removeNodeNote({ ...legacyNote, ...remainingNotes }, remainingNotes.notes[0].id).notes, [], 'The final note can be deleted without restoring legacy content');

console.log('Interações do editor: Backspace seguro, espaços editáveis, cursor visível, arraste e conexões alinhadas OK.');
