import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import { writePrompt, installPromptWriter } from '../server/prompt-writer';
import { connectionStore, installConnections } from '../server/connections';
import { promptWriterRequestSchema, type PromptWriterRequest } from '../shared/prompt-writer';
const input: PromptWriterRequest = { model: 'user-entered-deepseek', apiKey: 'fake-test-only-key', idea: '闭上嘴，保留眼镜', breed: '柴犬', style: 'photo', freedom: 'head', task: 'edit', previousPrompt: '保留身体和背景' };
test('DeepSeek prompt writer sends only text and the exact user model, with dog-head editing constraints', async () => {
  const result = await writePrompt(input, new AbortController().signal, async (url, init) => {
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    const body = JSON.parse(String(init.body));
    assert.equal(body.model, input.model); assert.equal(body.thinking.type, 'disabled');
    assert.ok(body.messages.every((m: {content: unknown}) => typeof m.content === 'string'));
    assert.ok(!JSON.stringify(body).includes('image_url')); assert.ok(!body.tools);
    assert.match(body.messages[0].content, /保留人类身体/); assert.match(body.messages[0].content, /禁止从零重设计/);
    assert.equal(JSON.parse(body.messages[1].content).想法, input.idea);
    return { status: 200, contentType: 'application/json', body: Buffer.from(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '保持柴犬造型，将嘴巴闭上，保留眼镜、人类身体、姿势和背景。', reasoning_content: 'internal-only' } }] })) };
  });
  assert.ok(!JSON.stringify(result).includes('internal-only')); assert.ok(!JSON.stringify(result).includes(input.apiKey));
  assert.equal(promptWriterRequestSchema.safeParse({ ...input, model: '' }).success, false);
});
test('prompt writer refuses incomplete/empty responses and never reflects credential-bearing vendor errors', async () => {
  for (const choice of [{ finish_reason: 'length', message: { content: '半句' } }, { finish_reason: 'stop', message: { content: '' } }]) {
    await assert.rejects(writePrompt(input, new AbortController().signal, async () => ({ status: 200, contentType: 'application/json', body: Buffer.from(JSON.stringify({ choices: [choice] })) })), /未完整生成/);
  }
  await assert.rejects(writePrompt(input, new AbortController().signal, async () => ({ status: 401, contentType: 'application/json', body: Buffer.from(input.apiKey) })), e => e instanceof Error && /密钥无效/.test(e.message) && !e.message.includes(input.apiKey));
});
test('prompt-only saved connections remain encrypted, survive other settings saves, and never require a drawing connection', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'goutou-prompt-test-')); const store = connectionStore(dir);
  const app = express(); installConnections(app, store);
  let calls = 0;
  installPromptWriter(app, store, async (actual) => { calls++; assert.equal(actual.apiKey, input.apiKey); assert.equal(actual.model, input.model); return { prompt: '闭嘴柴犬，保留身体。', model: actual.model }; });
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r));
  const address = server.address(); assert.ok(address && typeof address !== 'string'); const base = `http://127.0.0.1:${address.port}`;
  const post = (route: string, data: unknown, origin = base) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(data) });
  try {
    const payload = { config: { model: input.model }, key: input.apiKey };
    assert.equal((await post('/api/prompt-writer/connection', payload, 'https://untrusted.example')).status, 403);
    assert.equal((await post('/api/prompt-writer/connection', payload)).status, 200);
    assert.equal(calls, 0);
    assert.ok(!(await readFile(path.join(dir, 'connections.enc'))).includes(Buffer.from(input.apiKey)));
    await store.write({ models: [], director: null, defaultModel: '' });
    assert.equal((await connectionStore(dir).read()).promptWriter?.key, input.apiKey);
    const publicText = await (await fetch(base + '/api/connections')).text(); assert.ok(!publicText.includes(input.apiKey));
    const { apiKey: _, ...task } = input;
    assert.equal((await post('/api/prompt-writer', { ...task, useSaved: true })).status, 200); assert.equal(calls, 1);
    assert.equal((await post('/api/prompt-writer', { ...task, useSaved: true, model: 'changed' })).status, 400); assert.equal(calls, 1);
    assert.equal((await post('/api/prompt-writer', { ...task, useSaved: true, idea: '' })).status, 400); assert.equal(calls, 1);
    await store.writePromptWriter({ config: { model: 'new-user-id' }, key: '' });
    assert.equal((await store.read()).promptWriter?.key, input.apiKey);
  } finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); await rm(dir, { recursive: true, force: true }); }
});
