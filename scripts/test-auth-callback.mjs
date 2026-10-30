import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const authUrl = moduleUrl(`
  export const codes = [];
  export let clientCount = 0;
  let error = null;
  export const setError = value => { error = value; };
  export async function createClient() {
    clientCount++;
    return { auth: { exchangeCodeForSession: async code => {
      codes.push(code);
      return { error };
    } } };
  }
`);
const auth = await import(authUrl);
const source = ts.transpileModule(await readFile('app/auth/callback/route.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { GET } = await import(moduleUrl(source
  .replace("'next/server'", JSON.stringify(import.meta.resolve('next/server.js')))
  .replace("'../../../lib/supabase/server'", JSON.stringify(authUrl))));

const origin = 'https://nodumapp.site';
async function callback(next, code = 'valid-code') {
  const url = new URL('/auth/callback', origin);
  if (code !== null) url.searchParams.set('code', code);
  if (next !== undefined) url.searchParams.set('next', next);
  return GET(new Request(url));
}

for (const next of [undefined, '', '/', '/?map=123&node=456', '/share/token#details', '/mapa%20mental']) {
  const response = await callback(next);
  assert.equal(response.status, 307);
  assert.equal(response.headers.get('location'), new URL(next || '/', origin).href);
}

for (const next of [
  'https://evil.example', '//evil.example', '/\\evil.example',
  '/\t/evil.example', '/\n/evil.example', '/\r/evil.example',
  '/\\[invalid-host', 'javascript:alert(1)', 'relative/path',
]) {
  const response = await callback(next);
  assert.equal(response.status, 307);
  assert.equal(response.headers.get('location'), `${origin}/`, `Unsafe return path: ${JSON.stringify(next)}`);
}

assert.equal(auth.codes.length, 15);
assert.ok(auth.codes.every(code => code === 'valid-code'));
const clientsBeforeMissingCode = auth.clientCount;
assert.equal((await callback('/safe', null)).headers.get('location'), `${origin}/login?error=auth`);
assert.equal(auth.clientCount, clientsBeforeMissingCode);
auth.setError({ message: 'Invalid or expired code' });
assert.equal((await callback('/safe', 'expired-code')).headers.get('location'), `${origin}/login?error=auth`);
assert.equal(auth.codes.at(-1), 'expired-code');

console.log('Auth callback: internal redirects, external redirect rejection, missing/expired codes OK (Supabase mocked).');
