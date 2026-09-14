import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { buildPrompt, configSchema, publicProfile, providerInfo, type ModelProfile } from '../shared/models';
import { createProviderRequest, extractImage, generate, normalizeImage } from '../server/adapters';
import { isPublicAddress, validateTarget, PublicError, type Transport } from '../server/network';
import { createApp } from '../server/app';

const png = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#246b48' } }).png().toBuffer();
const image = { buffer: png, dataUrl: `data:image/png;base64,${png.toString('base64')}` };
const profile: ModelProfile = { id: 'test-1', name: '测试模型', provider: 'openai', model: 'gpt-image-2', endpoint: providerInfo.openai.endpoint };
const key = 'unit-test-credential-only';
const input = { profile, apiKey: key, prompt: buildPrompt('shiba', '保留眼镜'), image: image.dataUrl };
const signal = new AbortController().signal;

test('OpenAI edits sends an actual image file, not an image URL hidden in the prompt', async () => {
  const request = createProviderRequest(profile, key, input.prompt, image, signal);
  assert.equal(request.url, providerInfo.openai.endpoint);
  const body = request.init.body as FormData;
  const file = body.get('image') as File;
  assert.equal(file.type, 'image/png'); assert.deepEqual(Buffer.from(await file.arrayBuffer()), png);
  assert.equal(body.get('prompt'), input.prompt); assert.equal(body.get('model'), 'gpt-image-2');
  assert.equal(body.has('response_format'), false);
});
test('Gemini substitutes the model and sends inline image data with image response modalities', () => {
  const request = createProviderRequest({ ...profile, provider: 'gemini', model: 'gemini-3.1-flash-image', endpoint: providerInfo.gemini.endpoint }, key, input.prompt, image, signal);
  assert.match(request.url, /gemini-3.1-flash-image:generateContent$/); assert.ok(!request.url.includes(key));
  const body = JSON.parse(request.init.body as string);
  assert.equal(body.contents[0].parts[1].inline_data.data, png.toString('base64'));
  assert.deepEqual(body.generationConfig.responseModalities, ['TEXT', 'IMAGE']);
  assert.equal((request.init.headers as Record<string, string>)['x-goog-api-key'], key);
});
test('DashScope uses image and text content parts, disables prompt rewrite for comparable input', () => {
  const request = createProviderRequest({ ...profile, provider: 'dashscope', model: 'qwen-image-edit-plus' }, key, input.prompt, image, signal);
  const body = JSON.parse(request.init.body as string);
  assert.equal(body.input.messages[0].content[0].image, image.dataUrl);
  assert.equal(body.input.messages[0].content[1].text, input.prompt); assert.equal(body.parameters.prompt_extend, false);
  const legacy = createProviderRequest({ ...profile, provider: 'dashscope', model: 'qwen-image-edit' }, key, input.prompt, image, signal);
  assert.equal('prompt_extend' in JSON.parse(legacy.init.body as string).parameters, false);
});
test('Seedream uses image-conditioned JSON rather than a text-only generation request', () => {
  const request = createProviderRequest({ ...profile, provider: 'seedream' }, key, input.prompt, image, signal);
  const body = JSON.parse(request.init.body as string);
  assert.equal(body.image, image.dataUrl); assert.equal(body.size, '2K'); assert.equal(body.sequential_image_generation, 'disabled');
});
test('extracts only final Gemini output, never an intermediate thought image', () => {
  const result = extractImage({ candidates: [{ content: { parts: [{ thought: true, inlineData: { data: 'not-final' } }, { inlineData: { data: 'final' } }] } }] });
  assert.equal(result.base64, 'final');
  assert.throws(() => extractImage({ candidates: [{ content: { parts: [{ thought: true, inlineData: { data: 'not-final' } }] } }] }), PublicError);
  assert.throws(() => extractImage({ output: { choices: [{ message: { content: [{ text: 'no image' }] } }] } }), PublicError);
});
test('decodes and rejects malformed image bytes despite an accepted MIME prefix', async () => {
  await assert.rejects(normalizeImage('data:image/png;base64,Ym9ndXM='), /无法读取/);
  assert.equal((await normalizeImage(image.dataUrl)).dataUrl.startsWith('data:image/png;base64,'), true);
});
test('normalizes source orientation and size consistently before sending', async () => {
  const large = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: '#246b48' } }).jpeg().toBuffer();
  const normal = await normalizeImage(`data:image/jpeg;base64,${large.toString('base64')}`);
  const meta = await sharp(normal.buffer).metadata();
  assert.equal(meta.width, 2048); assert.equal(meta.height, 1024); assert.equal(meta.exif, undefined);
});
test('rejects private-network destinations and provider hosts not explicitly enabled', () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '192.168.0.1', '::1', '::ffff:127.0.0.1', 'fc00::1', '100.64.0.1']) assert.equal(isPublicAddress(address), false, address);
  assert.equal(isPublicAddress('8.8.8.8'), true);
  for (const url of ['http://api.openai.com/a', 'https://127.0.0.1/a', 'https://localhost/a', 'https://user:password@api.openai.com/a', 'https://api.openai.com:9000/a', 'https://api.openai.com/a?key=secret', 'https://unapproved.example/a']) assert.throws(() => validateTarget(url), PublicError);
  assert.equal(validateTarget(providerInfo.openai.endpoint).hostname, 'api.openai.com');
  assert.equal(validateTarget('https://workspace-1.cn-beijing.maas.aliyuncs.com/api/v1/a').hostname, 'workspace-1.cn-beijing.maas.aliyuncs.com');
});
test('provider errors are translated without reflecting credential-bearing error bodies', async () => {
  await assert.rejects(generate(input, signal, async () => ({ status: 401, body: Buffer.from(`secret: ${key}`), contentType: 'application/json' })), e => e instanceof Error && !e.message.includes(key) && /密钥无效/.test(e.message));
});
test('full adapter returns decoded image and a stable source fingerprint', async () => {
  const send: Transport = async () => ({ status: 200, body: Buffer.from(JSON.stringify({ data: [{ b64_json: png.toString('base64') }] })), contentType: 'application/json' });
  const first = await generate(input, signal, send); const second = await generate(input, signal, send);
  assert.equal(first.inputHash, second.inputHash); assert.equal(first.width, 16); assert.equal(first.height, 16);
  assert.match(first.image, /^data:image\/png;base64,/); assert.ok(!JSON.stringify(first).includes(key));
});
test('URL image responses are retrieved without forwarding provider credentials', async () => {
  let calls = 0;
  const send: Transport = async (_url, init, _limit, provider) => {
    calls++;
    if (calls === 1) return { status: 200, body: Buffer.from(JSON.stringify({ output: { choices: [{ message: { content: [{ image: 'https://media.example/image.png' }] } }] } })), contentType: 'application/json' };
    assert.equal(provider, false); assert.equal(init.headers, undefined);
    return { status: 200, body: png, contentType: 'image/png' };
  };
  await generate(input, signal, send); assert.equal(calls, 2);
});
test('rejects non-image outputs even when a supplier claims success', async () => {
  await assert.rejects(generate(input, signal, async () => ({ status: 200, body: Buffer.from(JSON.stringify({ data: [{ b64_json: Buffer.from('<html>oops</html>').toString('base64') }] })), contentType: 'application/json' })), /不是可用图片/);
});
test('config import/export whitelists fields and never persists injected keys', () => {
  const polluted = { ...profile, apiKey: key, password: 'other-secret' };
  assert.equal(JSON.stringify(publicProfile(polluted)).includes(key), false);
  const parsed = configSchema.parse({ version: 1, models: [polluted] });
  assert.equal(JSON.stringify(parsed).includes(key), false);
  assert.equal(configSchema.safeParse({ version: 1, models: [{ ...profile, endpoint: 'https://api.openai.com/v1?key=hidden' }] }).success, false);
});
test('HTTP boundary validates requests, disables caching and supports the real response contract', async () => {
  const app = createApp(async () => ({ image: image.dataUrl, mimeType: 'image/png', width: 16, height: 16, durationMs: 20, inputHash: 'unit-input-hash', parameters: { n: 1 } }));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const bad = await fetch(`${base}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: key }) });
    assert.equal(bad.status, 400); assert.ok(!(await bad.text()).includes(key));
    const ok = await fetch(`${base}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    assert.equal(ok.status, 200); assert.equal(ok.headers.get('cache-control'), 'no-store'); assert.equal((await ok.json()).image, image.dataUrl);
    const cross = await fetch(`${base}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'cross-site' }, body: JSON.stringify(input) });
    assert.equal(cross.status, 403);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
});
