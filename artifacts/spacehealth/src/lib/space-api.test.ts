import test from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest, getSupport } from './space-api.ts';

function stubFetch(impl: (url: string, init: RequestInit) => Promise<Response> | Response) {
  const original = globalThis.fetch;
  globalThis.fetch = ((url: string, init: RequestInit) => Promise.resolve(impl(url, init))) as typeof fetch;
  return () => { globalThis.fetch = original; };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('requests use the /api prefix and parse JSON', async () => {
  let seen = '';
  const restore = stubFetch(url => { seen = url; return json({ ok: true }); });
  try {
    assert.deepEqual(await apiRequest('/mission/sync-status'), { status: 'ok', data: { ok: true } });
    assert.equal(seen, '/api/mission/sync-status');
  } finally { restore(); }
});

test('support request never allows online processing', async () => {
  let body = '';
  const restore = stubFetch((_url, init) => { body = String(init.body); return json({}); });
  try {
    await getSupport();
    assert.deepEqual(JSON.parse(body), { astronaut_id: 'AST-01', allow_online: false });
  } finally { restore(); }
});

test('network failures, gateway errors and HTML replies are offline', async () => {
  let restore = stubFetch(() => { throw new TypeError('failed'); });
  try { assert.deepEqual(await apiRequest('/x'), { status: 'offline' }); } finally { restore(); }
  restore = stubFetch(() => new Response('bad gateway', { status: 502 }));
  try { assert.deepEqual(await apiRequest('/x'), { status: 'offline' }); } finally { restore(); }
  restore = stubFetch(() => new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } }));
  try { assert.deepEqual(await apiRequest('/x'), { status: 'offline' }); } finally { restore(); }
});

test('validation and not-found replies become readable errors', async () => {
  let restore = stubFetch(() => json({ detail: [{ loc: ['body', 'title'], msg: 'Field required' }] }, 422));
  try { assert.deepEqual(await apiRequest('/x'), { status: 'error', message: 'title: Field required' }); } finally { restore(); }
  restore = stubFetch(() => json({ detail: "Unknown message '9'" }, 404));
  try { assert.deepEqual(await apiRequest('/x'), { status: 'error', message: "Unknown message '9'" }); } finally { restore(); }
});
