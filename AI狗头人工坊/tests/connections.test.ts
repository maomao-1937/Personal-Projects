import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import { connectionStore, installConnections } from '../server/connections';
const profile = { id: 'render', name: '绘图', provider: 'openai' as const, model: 'test-image', endpoint: 'https://api.openai.com/v1/images/edits' };
const fixture = { models: [{ profile, key: 'test-only-render-key' }], director: { config: { name: '助手', model: 'test-vision', endpoint: 'https://api.openai.com/v1/chat/completions', inputMode: 'vision' as const }, key: 'test-only-director-key' }, defaultModel: profile.id };
test('encrypted connection store survives restart and will not reuse secrets for a changed endpoint', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'goutou-vault-'));
  try {
    await connectionStore(dir).write(fixture);
    const raw = await readFile(path.join(dir, 'connections.enc'));
    assert.ok(!raw.includes(Buffer.from('test-only-render-key')));
    const reopened = connectionStore(dir); assert.deepEqual(await reopened.read(), fixture);
    await reopened.write({ ...fixture, models: [{ profile, key: '' }] });
    assert.equal((await reopened.read()).models[0].key, fixture.models[0].key);
    await assert.rejects(reopened.write({ ...fixture, models: [{ profile: { ...profile, endpoint: 'https://api.other.example/edits' }, key: '' }] }));
    assert.equal((await reopened.read()).models[0].profile.endpoint, profile.endpoint);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('management rejects cross-site and unauthenticated writes; public config excludes keys; saved generation ignores client endpoint overrides', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'goutou-http-vault-'));
  const app = express(); const store = connectionStore(dir); const resolve = installConnections(app, store);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r));
  const addr = server.address(); assert.ok(addr && typeof addr !== 'string'); const base = `http://127.0.0.1:${addr.port}`;
  try {
    const post = (headers: Record<string, string>) => fetch(base + '/api/connections', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(fixture) });
    assert.equal((await post({})).status, 403);
    assert.equal((await post({ Origin: 'https://evil.example' })).status, 403);
    assert.equal((await post({ Origin: base, 'Sec-Fetch-Site': 'cross-site' })).status, 403);
    const ok = await post({ Origin: base }); assert.equal(ok.status, 200); assert.ok(!(await ok.text()).includes('test-only'));
    assert.ok(!(await (await fetch(base + '/api/connections')).text()).includes('test-only'));
    const resolved = await resolve({ connectionId: 'render', image: 'image', prompt: 'prompt', profile: { endpoint: 'https://evil.example' } }, false);
    assert.deepEqual(resolved.profile, profile); assert.equal(resolved.apiKey, fixture.models[0].key);
    await assert.rejects(resolve({ connectionId: 'not-found' }, false), /不存在/);
    const agent = await resolve({ connectionId: 'render', useSavedDirector: true, maxRenders: 1 }, true);
    assert.equal(agent.directorKey, fixture.director.key);
  } finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); await rm(dir, { recursive: true, force: true }); }
});

test('production connection edits require the management token and shared calls reserve their full limit', async () => {
  const previous = { mode: process.env.NODE_ENV, token: process.env.STUDIO_ADMIN_TOKEN, limit: process.env.STUDIO_DAILY_RENDER_LIMIT };
  const dir = await mkdtemp(path.join(tmpdir(), 'goutou-production-vault-'));
  process.env.NODE_ENV = 'production'; delete process.env.STUDIO_ADMIN_TOKEN; process.env.STUDIO_DAILY_RENDER_LIMIT = '2';
  const app = express(); const resolve = installConnections(app, connectionStore(dir));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r));
  const addr = server.address(); assert.ok(addr && typeof addr !== 'string'); const base = `http://127.0.0.1:${addr.port}`;
  const post = (token = '') => fetch(base + '/api/connections', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, 'x-studio-admin': token }, body: JSON.stringify(fixture) });
  try {
    assert.equal((await post()).status, 403);
    process.env.STUDIO_ADMIN_TOKEN = 'test-management-only';
    assert.equal((await post('wrong-token')).status, 403);
    assert.equal((await post('test-management-only')).status, 200);
    resolve.reserve({ apiKey: 'visitor-own-key' }, false);
    resolve.reserve({ connectionId: profile.id, maxRenders: 2 }, true);
    assert.throws(() => resolve.reserve({ connectionId: profile.id }, false), /额度已用完/);
  } finally {
    server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); await rm(dir, { recursive: true, force: true });
    for (const [key, value] of Object.entries({ NODE_ENV: previous.mode, STUDIO_ADMIN_TOKEN: previous.token, STUDIO_DAILY_RENDER_LIMIT: previous.limit })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
