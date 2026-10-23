import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const moduleUrl = text => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
const compile = async path => ts.transpileModule(await readFile(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
let user = { id: 'test-user', user_metadata: {} };
let updates = 0;
globalThis.testAuth = async () => ({ user, client: { auth: { updateUser: async ({ data }) => { updates++; user = { ...user, user_metadata: { ...user.user_metadata, ...data } }; return { data: { user }, error: null }; } } } });
const auth = moduleUrl('export const requireUser = () => globalThis.testAuth();');
const preferences = moduleUrl(await compile('lib/preferences.ts'));
const { PUT } = await import(moduleUrl((await compile('app/api/preferences/route.ts')).replace("'../../../lib/supabase/server'", JSON.stringify(auth)).replace("'../../../lib/preferences'", JSON.stringify(preferences))));
const request = body => new Request('https://example.com/api/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const settings = { dark: true, grid: false, sidebar: false, alwaysToolbar: true };
assert.equal((await PUT(request(settings))).status, 200);
assert.deepEqual(user.user_metadata.nodum_preferences, settings);
assert.equal((await PUT(request({ dark: 'yes' }))).status, 400);
assert.equal(updates, 1);
user = null;
assert.equal((await PUT(request(settings))).status, 401);
assert.equal(updates, 1);

process.env.NEXT_PUBLIC_STORAGE_MODE = 'cloud';
process.env.GEMINI_API_KEY = 'test-only';
const aiCode = (await compile('app/api/ai/route.ts')).replace("'../../../lib/supabase/server'", JSON.stringify(auth)).replace("'next/server'", JSON.stringify(moduleUrl('export const NextResponse = Response;')));
const { POST } = await import(moduleUrl(aiCode));
const originalFetch = globalThis.fetch;
try {
  let called = false;
  globalThis.fetch = async (_url, options) => {
    called = true;
    const body = JSON.parse(options.body);
    assert.ok(body.generationConfig.responseFormat.text.schema);
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ items: ['Uma ideia'], summary: 'Resumo' }) }] } }] });
  };
  assert.equal((await POST(request({ action: 'ideas', text: 'Teste' }))).status, 401);
  assert.equal(called, false);
  user = { id: 'ai-user', user_metadata: {} };
  const response = await POST(request({ action: 'ideas', text: 'Teste' }));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).items, ['Uma ideia']);
  assert.equal((await POST(request({ action: 'ideas', text: 'Teste' }))).status, 429);
} finally { globalThis.fetch = originalFetch; delete globalThis.testAuth; }
console.log('Preferências: validação, isolamento e gravação OK. IA: autenticação, resposta e limite OK (serviços simulados).');
