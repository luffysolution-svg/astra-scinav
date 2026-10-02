import test from 'node:test';
import assert from 'node:assert/strict';
import { createFeedbackHandler } from '../lib/feedback.mjs';

const fixtures = [
  { 'form-name': 'suggest', name: '测试', url: 'https://example.org/', desc: '科研资源' },
  { 'form-name': 'suggest-skill', url: 'https://github.com/example/repo', desc: '文献技能' },
  { 'form-name': 'suggest-prompt', title: '写作', prompt: '请帮助我分析[内容]', url: '' },
  { 'form-name': 'suggest-figure', url: 'https://example.org/plot', desc: '图表' },
  { 'form-name': 'report', item: 'https://example.org/', page: '/', url: 'https://example.org/', reason: '链接失效', note: '404' },
];
async function call(handler, body = fixtures[0], override = {}) {
  let status, data; const headers = {};
  await handler({ method: 'POST', headers: { origin: 'https://nav.luffysite.top', host: 'nav.luffysite.top', 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString(), ...override }, {
    setHeader: (k, v) => { headers[k] = v; }, status(code) { status = code; return this; }, json(value) { data = value; },
  });
  return { status, data, headers };
}

test('five form types are persisted privately before acknowledging success', async () => {
  const saved = []; const handler = createFeedbackHandler({ env: { BLOB_READ_WRITE_TOKEN: 'test-only' }, put: async (...args) => saved.push(args) });
  for (const form of fixtures) {
    const r = await call(handler, { ...form, unexpected: 'discard' });
    assert.equal(r.status, 201); assert.equal(r.data.ok, true); assert.equal(r.headers['Cache-Control'], 'no-store');
    const [path, content, opts] = saved.at(-1), row = JSON.parse(content);
    assert.match(path, /^feedback\/\d{4}-\d{2}-\d{2}\/.*\.json$/);
    assert.equal(opts.access, 'private'); assert.equal(row.type, form['form-name']); assert.equal(row.id, r.data.id);
    assert.equal(row.fields.unexpected, undefined); assert.equal(r.data.url, undefined);
  }
});
test('missing credentials and storage errors never return success', async () => {
  const noEnv = createFeedbackHandler({ env: {}, put: () => assert.fail('must not store') });
  assert.equal((await call(noEnv)).status, 503);
  const failure = createFeedbackHandler({ env: { BLOB_READ_WRITE_TOKEN: 'test-only' }, put: async () => { throw new Error('storage unavailable'); } });
  const r = await call(failure); assert.equal(r.status, 503); assert.equal(r.data.ok, false);
});
test('honeypot, cross-origin, methods and invalid fields do not write', async () => {
  const handler = createFeedbackHandler({ env: { BLOB_READ_WRITE_TOKEN: 'test-only' }, put: () => assert.fail('must not store') });
  assert.equal((await call(handler, { ...fixtures[0], 'bot-field': 'spam' })).status, 200);
  assert.equal((await call(handler, fixtures[0], { method: 'GET' })).status, 405);
  assert.equal((await call(handler, fixtures[0], { headers: { origin: 'https://evil.example', host: 'nav.luffysite.top' } })).status, 403);
  for (const form of [
    { ...fixtures[0], 'form-name': 'toString' }, { ...fixtures[0], url: 'javascript:alert(1)' },
    { ...fixtures[1], url: 'https://other.example/repo' }, { ...fixtures[2], prompt: '' },
    { ...fixtures[2], prompt: 'a'.repeat(4001) }, { ...fixtures[4], reason: 'invalid' },
  ]) assert.equal((await call(handler, form)).status, 400);
  assert.equal((await call(handler, fixtures[0], { headers: { origin: 'https://nav.luffysite.top', host: 'nav.luffysite.top', 'content-type': 'application/x-www-form-urlencoded', 'content-length': '999999' } })).status, 413);
});
test('a full-length Chinese prompt is accepted and burst submissions are limited', async () => {
  const handler = createFeedbackHandler({ env: { BLOB_READ_WRITE_TOKEN: 'test-only' }, put: async () => {} });
  assert.equal((await call(handler, { ...fixtures[2], prompt: '字'.repeat(4000) })).status, 201);
  for (let i = 0; i < 9; i++) assert.equal((await call(handler)).status, 201);
  assert.equal((await call(handler)).status, 429);
});

test('unsafe schemes, embedded URL credentials and inherited form names are rejected', async () => {
  const handler = createFeedbackHandler({ env: { BLOB_READ_WRITE_TOKEN: 'test-only' }, put: () => assert.fail('must not store') });
  for (const url of ['data:text/html,test', 'file:///tmp/test', 'https://user:pass@example.org/', 'https://github.com@example.org/repo']) {
    assert.equal((await call(handler, { ...fixtures[0], url })).status, 400);
  }
  for (const type of ['__proto__', 'constructor']) assert.equal((await call(handler, { ...fixtures[0], 'form-name': type })).status, 400);
});

test('same-host lookalikes, missing origin and unexpected content types cannot submit', async () => {
  const handler = createFeedbackHandler({ env: { BLOB_READ_WRITE_TOKEN: 'test-only' }, put: () => assert.fail('must not store') });
  for (const origin of [undefined, 'null', 'https://nav.luffysite.top.evil.example', 'https://nav.luffysite.top@evil.example']) {
    assert.equal((await call(handler, fixtures[0], { headers: { origin, host: 'nav.luffysite.top', 'content-type': 'application/x-www-form-urlencoded' } })).status, 403);
  }
  assert.equal((await call(handler, fixtures[0], { headers: { origin: 'https://nav.luffysite.top', host: 'nav.luffysite.top', 'content-type': 'application/json' } })).status, 415);
});

test('streamed bodies remain bounded when Content-Length is absent or dishonest', async () => {
  const handler = createFeedbackHandler({ env: { BLOB_READ_WRITE_TOKEN: 'test-only' }, put: () => assert.fail('must not store') });
  const request = {
    body: undefined,
    async *[Symbol.asyncIterator]() { yield Buffer.alloc(32000, 97); yield Buffer.alloc(32001, 97); },
  };
  assert.equal((await call(handler, fixtures[0], request)).status, 413);
  assert.equal((await call(handler, fixtures[0], { ...request, headers: { origin: 'https://nav.luffysite.top', host: 'nav.luffysite.top', 'content-type': 'application/x-www-form-urlencoded', 'content-length': '1' } })).status, 413);
});
