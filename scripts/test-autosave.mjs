import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Execute the editor's actual callbacks with controlled requests and timers.
// This avoids introducing a runtime abstraction or a React test dependency.
const source = await readFile('components/Editor.tsx', 'utf8');
const parsed = ts.createSourceFile('Editor.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const editor = parsed.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === 'Editor');
const names = ['saveTimers', 'pendingSaves', 'runningSaves', 'failedSaves', 'flushSave', 'save', 'flushSaves', 'signOut', 'deleteMap'];
const callbacks = names.map(name => {
  const statement = editor.body.statements.find(statement => ts.isVariableStatement(statement)
    && statement.declarationList.declarations.some(declaration => declaration.name.getText(parsed) === name));
  assert.ok(statement, `Editor declaration missing: ${name}`);
  return statement.getText(parsed);
});
const lifecycle = editor.body.statements.find(statement => ts.isExpressionStatement(statement)
  && statement.expression.getText(parsed).startsWith('useEffect(')
  && statement.getText(parsed).includes("'beforeunload'"));
assert.ok(lifecycle, 'Editor must guard pending writes on page exit');
const executable = ts.transpileModule(`${callbacks.join('\n')}\n${lifecycle.getText(parsed)}
  return { save, flushSave, flushSaves, signOut, deleteMap, pendingSaves, runningSaves };`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
const createCallbacks = new Function('useRef', 'useCallback', 'useEffect', 'api', 'setMaps', 'setStatus', 'setSaveStatus', 'setTimeout', 'clearTimeout', 'window', 'document', 'signOutPath', 'activeId', 'switchMap', executable);

function harness() {
  let maps = [];
  let status = 'saved';
  let timerId = 0;
  let cleanup;
  const timers = new Map();
  const requests = [];
  const navigation = [];
  const windowEvents = new Map();
  const documentEvents = new Map();
  const document = { visibilityState: 'visible', addEventListener: (name, handler) => documentEvents.set(name, handler), removeEventListener: name => documentEvents.delete(name) };
  const window = { confirm: () => true, location: { assign: path => navigation.push(path) }, addEventListener: (name, handler) => windowEvents.set(name, handler), removeEventListener: name => windowEvents.delete(name) };
  const callbacks = createCallbacks(value => ({ current: value }), fn => fn, effect => { cleanup = effect(); }, (_url, options) => new Promise((resolve, reject) => {
    const map = options.body ? JSON.parse(options.body) : undefined;
    requests.push({ map, method: options.method, succeed: () => resolve({ map: { ...map, updatedAt: 999 } }), fail: () => reject(new Error('Offline')) });
  }), update => { maps = update(maps); }, () => {}, value => { status = value; }, (callback, delay) => {
    assert.equal(delay, 650);
    timers.set(++timerId, callback);
    return timerId;
  }, id => timers.delete(id), window, document, '/auth/signout', null, () => {});
  return {
    ...callbacks, requests, navigation, windowEvents, documentEvents, document, timers,
    get status() { return status; },
    get maps() { return maps; },
    edit(map) { maps = [...maps.filter(item => item.id !== map.id), map]; callbacks.save(map); },
    fireTimers() { for (const [id, callback] of [...timers]) { timers.delete(id); callback(); } },
    cleanup() { cleanup(); },
  };
}
const map = (title, id = 'map-1') => ({ id, title, updatedAt: 1 });
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

{
  const h = harness();
  h.edit(map('A')); h.edit(map('B'));
  assert.equal(h.timers.size, 1);
  assert.equal(h.requests.length, 0);
  h.fireTimers();
  assert.equal(h.requests[0].map.title, 'B');
  h.requests[0].succeed(); await settle();
  assert.equal(h.maps[0].updatedAt, 999);
  assert.equal(h.status, 'saved');
}
{
  const h = harness();
  h.edit(map('A')); h.fireTimers();
  h.edit(map('B')); h.edit(map('C'));
  assert.equal(h.requests.length, 1, 'Same-map writes must not overlap');
  h.requests[0].succeed(); await settle();
  assert.equal(h.maps[0].updatedAt, 1, 'Older acknowledgement must not alter an edit with the same timestamp');
  assert.equal(h.requests.length, 2);
  assert.equal(h.requests[1].map.title, 'C', 'Intermediate queued edits should be coalesced');
  assert.equal(h.status, 'saving');
  h.requests[1].succeed(); await settle();
  assert.equal(h.maps[0].title, 'C');
  assert.equal(h.status, 'saved');
  assert.equal(h.timers.size, 0);
}
{
  const h = harness();
  h.edit(map('A', 'one')); h.edit(map('B', 'two')); h.fireTimers();
  h.requests[0].succeed(); await settle();
  assert.equal(h.status, 'saving', 'Another map is still being saved');
  h.requests[1].fail(); await settle();
  assert.equal(h.status, 'error');
  h.edit(map('C', 'one')); h.fireTimers();
  h.requests[2].succeed(); await settle();
  assert.equal(h.status, 'error', 'Saving another map must not hide a failure');
  const retry = h.flushSaves();
  assert.equal(h.requests[3].map.id, 'two');
  h.requests[3].succeed();
  assert.equal(await retry, true);
  assert.equal(h.status, 'saved');
}
{
  const h = harness();
  h.edit(map('A')); h.fireTimers(); h.edit(map('B'));
  h.requests[0].fail(); await settle();
  assert.equal(h.requests[1].map.title, 'B', 'A failed older write must not discard a newer edit');
  h.requests[1].succeed(); await settle();
  assert.equal(h.status, 'saved');
}
{
  const h = harness();
  let prevented = false;
  h.edit(map('A'));
  const leaving = h.signOut({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.deepEqual(h.navigation, []);
  h.requests[0].fail(); await leaving;
  assert.deepEqual(h.navigation, [], 'Failed saves must keep the editor open');
  assert.equal(h.status, 'error');
  const retry = h.signOut({ preventDefault() {} });
  h.requests[1].succeed(); await retry;
  assert.deepEqual(h.navigation, ['/auth/signout']);
}
{
  const h = harness();
  const clean = { preventDefault() { assert.fail('Clean editor should not warn'); } };
  h.windowEvents.get('beforeunload')(clean);
  h.edit(map('A'));
  let prevented = false;
  const event = { preventDefault() { prevented = true; } };
  h.windowEvents.get('beforeunload')(event);
  assert.equal(prevented, true);
  assert.equal(event.returnValue, '');
  h.requests[0].succeed(); await settle();
  h.windowEvents.get('beforeunload')(clean);
  h.edit(map('B'));
  h.document.visibilityState = 'hidden';
  h.documentEvents.get('visibilitychange')();
  assert.equal(h.requests[1].map.title, 'B');
  h.requests[1].succeed(); await settle();
  h.edit(map('C'));
  h.cleanup();
  assert.equal(h.windowEvents.size, 0);
  assert.equal(h.documentEvents.size, 0);
  assert.equal(h.requests[2].map.title, 'C');
  h.requests[2].succeed(); await settle();
  assert.equal(h.timers.size, 0);
}

{
  const h = harness();
  const original = map('A');
  h.edit(original); h.fireTimers();
  const deleting = h.deleteMap(original);
  assert.equal(h.requests.length, 1, 'Deletion must wait for an in-flight write');
  h.requests[0].fail(); await settle();
  assert.equal(h.requests[1].method, 'DELETE');
  h.requests[1].succeed(); await deleting;
  assert.deepEqual(h.maps, []);
  assert.equal(h.pendingSaves.current.size, 0, 'Deleted maps must not remain queued for retry');
  assert.equal(h.timers.size, 0);
  assert.equal(h.status, 'saved');
}

console.log('Autosave: debounce, ordering, coalescing, cross-map status, retry, sign-out, deletion and exit lifecycle OK (requests/browser events simulated).');
