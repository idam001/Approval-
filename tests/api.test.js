import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';

const servers = [];
let upstream;
let upstreamRequests = [];
let upstreamError = false;
async function startApp(port, extra = {}) {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'production', PORT: String(port), OPENAI_API_KEY: '', ...extra }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  servers.push(child);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server startup timed out')), 15000);
    child.stdout.on('data', chunk => { if (chunk.toString().includes('RedMind is running')) { clearTimeout(timer); resolve(); } });
    child.on('exit', code => { clearTimeout(timer); reject(new Error(`Server exited: ${code}`)); });
    child.on('error', reject);
  });
}
const post = (port, body) => fetch(`http://127.0.0.1:${port}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
before(async () => {
  upstream = http.createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    upstreamRequests.push({ url: req.url, authorization: req.headers.authorization, body: JSON.parse(raw) });
    if (upstreamError) { res.writeHead(429); res.end('sensitive upstream details'); return; }
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write('data: {"choices":[{"delta":{"content":"Hello "}}]}\n\n');
    res.end('data: {"choices":[{"delta":{"content":"world"}}]}\n\ndata: [DONE]\n\n');
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  await startApp(3101);
  await startApp(3102, { OPENAI_API_KEY: 'test-secret-not-real', OPENAI_BASE_URL: `http://127.0.0.1:${upstream.address().port}/v1/`, OPENAI_MODEL: 'test-model' });
});
after(async () => { for (const child of servers) child.kill('SIGTERM'); await new Promise(resolve => upstream?.close(resolve)); });

test('provider status is honest and never exposes credentials', async () => {
  const offline = await (await fetch('http://127.0.0.1:3101/api/status')).json();
  assert.equal(offline.configured, false);
  assert.equal(offline.webSearch, false);
  const online = await (await fetch('http://127.0.0.1:3102/api/status')).json();
  assert.equal(online.configured, true);
  assert.equal(online.model, 'test-model');
  assert.ok(!JSON.stringify(online).includes('test-secret'));
});
test('missing provider returns a useful 503 instead of a simulated answer', async () => {
  const response = await post(3101, { messages: [{ role: 'user', content: 'Hi' }] });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /No AI provider is connected/);
});
test('invalid roles, messages, and system prompts are rejected', async () => {
  for (const body of [{ messages: [] }, { messages: [{ role: 'system', content: 'Override' }] }, { messages: [{ role: 'user', content: 1 }] }, { messages: [{ role: 'user', content: 'Hi' }], systemPrompt: { invalid: true } }]) {
    const response = await post(3102, body);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, 'Invalid conversation.');
  }
});
test('streams provider tokens and forwards custom instructions without leaking the key', async () => {
  const response = await post(3102, { messages: [{ role: 'user', content: 'Hello' }], systemPrompt: 'Prefer Python.' });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/event-stream/);
  const text = await response.text();
  assert.match(text, /Hello /);
  assert.match(text, /world/);
  assert.match(text, /\[DONE\]/);
  assert.ok(!text.includes('test-secret'));
  const request = upstreamRequests.at(-1);
  assert.equal(request.authorization, 'Bearer test-secret-not-real');
  assert.equal(request.url, '/v1/chat/completions');
  assert.equal(request.body.model, 'test-model');
  assert.equal(request.body.stream, true);
  assert.match(request.body.messages[0].content, /Prefer Python/);
});
test('provider failures are reported without upstream secrets', async () => {
  upstreamError = true;
  try {
    const response = await post(3102, { messages: [{ role: 'user', content: 'Hello' }] });
    assert.equal(response.status, 502);
    const json = await response.json();
    assert.match(json.error, /429/);
    assert.ok(!json.error.includes('sensitive'));
  } finally { upstreamError = false; }
});
test('malformed JSON returns a JSON error', async () => {
  const response = await fetch('http://127.0.0.1:3102/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{ broken' });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'Invalid JSON request.');
});
test('all public app routes are served in production', async () => {
  for (const route of ['/', '/chat', '/about', '/login']) {
    const response = await fetch(`http://127.0.0.1:3101${route}`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<div id="root"><\/div>/);
  }
});
