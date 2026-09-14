import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { profileSchema, publicProfile } from '../shared/models';
import { directorSchema } from '../shared/agent';
import { PublicError } from './network';
import { promptWriterConfigSchema } from '../shared/prompt-writer';
const keySchema = z.string().trim().min(8).max(2048).regex(/^[^\r\n]+$/);
const vaultSchema = z.object({
  models: z.array(z.object({ profile: profileSchema, key: keySchema })).max(30),
  director: z.object({ config: directorSchema, key: keySchema }).nullable(),
  defaultModel: z.string(),
  promptWriter: z.object({ config: promptWriterConfigSchema, key: keySchema }).nullable().optional(),
});
type Vault = z.infer<typeof vaultSchema>;
const editSchema = z.object({
  models: z.array(z.object({ profile: profileSchema, key: z.union([keySchema, z.literal('')]) })).max(30),
  director: z.object({ config: directorSchema, key: z.union([keySchema, z.literal('')]) }).nullable(),
  defaultModel: z.string(),
});
export function connectionStore(directory = process.env.STUDIO_DATA_DIR || path.resolve('.studio-data')) {
  let cache: Vault | undefined;
  let serial: Promise<unknown> = Promise.resolve();
  async function cipherKey() {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const file = path.join(directory, 'vault.key');
    try { await writeFile(file, randomBytes(32), { flag: 'wx', mode: 0o600 }); }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; }
    const key = await readFile(file); if (key.length !== 32) throw new Error('Invalid vault key'); return key;
  }
  async function read(): Promise<Vault> {
    if (cache) return cache;
    let file: Buffer;
    try { file = await readFile(path.join(directory, 'connections.enc')); }
    catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { models: [], director: null, defaultModel: '' }; throw e; }
    const decrypt = createDecipheriv('aes-256-gcm', await cipherKey(), file.subarray(0, 12));
    decrypt.setAuthTag(file.subarray(12, 28));
    cache = vaultSchema.parse(JSON.parse(Buffer.concat([decrypt.update(file.subarray(28)), decrypt.final()]).toString()));
    return cache;
  }
  async function write(data: unknown, writerOnly = false) {
    const job = serial.catch(() => {}).then(async () => {
      const old = await read();
      if (writerOnly) {
        const parsed = z.object({ config: promptWriterConfigSchema, key: z.union([keySchema, z.literal('')]) }).nullable().parse(data);
        const promptWriter = parsed ? { config: parsed.config, key: parsed.key || old.promptWriter?.key || '' } : null;
        const validWriter = vaultSchema.shape.promptWriter.parse(promptWriter);
        await encryptVault({ ...old, promptWriter: validWriter }); return;
      }
      const next = editSchema.parse(data);
      if (new Set(next.models.map(m => m.profile.id)).size !== next.models.length) throw new PublicError('模型 ID 不能重复。', 400);
      const models = next.models.map(m => {
        const previous = old.models.find(x => x.profile.id === m.profile.id && x.profile.endpoint === m.profile.endpoint && x.profile.provider === m.profile.provider);
        return { profile: publicProfile(m.profile), key: m.key || previous?.key || '' };
      });
      const director = next.director ? { config: next.director.config, key: next.director.key || (old.director?.config.endpoint === next.director.config.endpoint ? old.director.key : '') } : null;
      const valid = vaultSchema.parse({ models, director, defaultModel: next.defaultModel, ...(old.promptWriter !== undefined ? { promptWriter: old.promptWriter } : {}) });
      if (valid.defaultModel && !valid.models.some(m => m.profile.id === valid.defaultModel)) throw new PublicError('默认模型不在连接列表中。', 400);
      await encryptVault(valid);
    });
    serial = job; return job;
  }
  async function encryptVault(valid: Vault) {
    const key = await cipherKey(); const iv = randomBytes(12); const encrypt = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([encrypt.update(JSON.stringify(valid)), encrypt.final()]);
    const target = path.join(directory, 'connections.enc');
    await writeFile(target + '.tmp', Buffer.concat([iv, encrypt.getAuthTag(), encrypted]), { mode: 0o600 });
    await rename(target + '.tmp', target); cache = valid;
  }
  return { read, write, writePromptWriter: (data: unknown) => write(data, true) };
}
export function installConnections(app: express.Express, store = connectionStore()) {
  const publicState = async () => {
    const v = await store.read();
    return { models: v.models.map(m => publicProfile(m.profile)), director: v.director?.config || null, defaultModel: v.defaultModel, promptWriter: v.promptWriter?.config || null, adminMode: process.env.STUDIO_ADMIN_TOKEN ? 'token' : process.env.NODE_ENV !== 'production' ? 'local' : 'disabled' };
  };
  app.get('/api/connections', async (_req, res) => {
    try { res.json(await publicState()); } catch { res.status(503).json({ error: '服务端连接配置暂时无法读取。' }); }
  });
  app.post('/api/connections', rateLimit({ windowMs: 15 * 60_000, limit: 20, legacyHeaders: false, message: { error: '管理操作较多，请稍后重试。' } }), express.json({ limit: '128kb' }), requireConnectionAdmin, async (req, res) => {
    try { await store.write(req.body); res.json(await publicState()); }
    catch (e) { res.status(400).json({ error: e instanceof PublicError ? e.message : '连接未保存，请检查模型、密钥、默认项和服务端目录权限。' }); }
  });
  let day = '', spent = 0;
  const resolve = async (body: Record<string, unknown>, agent: boolean) => {
    if (!body.connectionId && !body.useSavedDirector) return body;
    const v = await store.read(); const result = { ...body };
    if (body.connectionId) {
      const connection = v.models.find(m => m.profile.id === body.connectionId);
      if (!connection) throw new PublicError('已保存的绘图连接不存在，请在设置中重新选择。', 400);
      if (agent) { result.renderer = connection.profile; result.rendererKey = connection.key; }
      else { result.profile = connection.profile; result.apiKey = connection.key; }
    }
    if (agent && body.useSavedDirector) {
      if (!v.director) throw new PublicError('尚未保存创作助手，请先在设置中配置。', 400);
      result.director = v.director.config; result.directorKey = v.director.key;
    }
    return result;
  };
  return Object.assign(resolve, { reserve(body: Record<string, unknown>, agent: boolean) {
    if (!body.connectionId && !body.useSavedDirector) return;
    const today = new Date().toISOString().slice(0, 10); if (today !== day) { day = today; spent = 0; }
    const cost = agent && body.maxRenders === 2 ? 2 : 1;
    const configured = Number(process.env.STUDIO_DAILY_RENDER_LIMIT || 100);
    const limit = Number.isFinite(configured) && configured >= 0 ? configured : 100;
    if (spent + cost > limit) throw new PublicError('站点今日绘图额度已用完，请明天再试或联系维护者。', 429);
    spent += cost; // Reserve maximum drawing calls; single-process budget resets on restart.
  } });
}

export const requireConnectionAdmin: express.RequestHandler = (req, res, next) => {
    const token = process.env.STUDIO_ADMIN_TOKEN;
    const supplied = req.get('x-studio-admin') || '';
    const equal = !!token && Buffer.byteLength(token) === Buffer.byteLength(supplied) && timingSafeEqual(Buffer.from(token), Buffer.from(supplied));
    const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '');
    let originAllowed = false;
    try { const origin = new URL(req.get('origin') || ''); originAllowed = ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname); } catch { /* origin required for local administration */ }
    const local = !token && process.env.NODE_ENV !== 'production' && loopback && originAllowed && ['localhost', '127.0.0.1', '[::1]'].includes(req.hostname);
    if (req.get('sec-fetch-site') === 'cross-site' || (!equal && !local)) { res.status(403).json({ error: '需要站点管理口令；本机管理仅允许本机页面访问。' }); return; }
  next();
};
