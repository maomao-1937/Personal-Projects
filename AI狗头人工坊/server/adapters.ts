import sharp from 'sharp';
import { z } from 'zod';
import type { ModelProfile } from '../shared/models';
import { PublicError, transport, type Transport } from './network';

export const generationSchema = z.object({
  profile: z.object({ provider: z.enum(['openai', 'gemini', 'dashscope', 'seedream']), model: z.string().min(1).max(160).regex(/^[a-zA-Z0-9_.:/-]+$/), endpoint: z.string().url().max(600) }),
  apiKey: z.string().trim().min(8).max(2048).regex(/^[^\r\n]+$/),
  image: z.string().max(14_000_000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/),
  prompt: z.string().trim().min(1).max(2400),
});
export type GenerationInput = z.infer<typeof generationSchema>;
export type GenerationResult = { image: string; mimeType: string; width: number; height: number; durationMs: number; inputHash: string; requestId?: string; parameters: Record<string, unknown> };

export async function normalizeImage(data: string) {
  const raw = Buffer.from(data.slice(data.indexOf(',') + 1), 'base64');
  if (raw.length > 10 * 1024 * 1024) throw new PublicError('图片超过 10 MB，请选择较小的文件。');
  try {
    const input = sharp(raw, { limitInputPixels: 40_000_000 });
    const meta = await input.metadata();
    if (!['jpeg', 'png', 'webp'].includes(meta.format || '') || (meta.pages ?? 1) > 1) throw new Error('Invalid image');
    // Decode fully and strip metadata; consistent input preprocessing across adapters.
    const buffer = await input.rotate().resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
    return { buffer, dataUrl: `data:image/png;base64,${buffer.toString('base64')}` };
  } catch { throw new PublicError('图片无法读取。请使用有效的静态 JPG、PNG 或 WebP 图片（最多 4000 万像素）。'); }
}

export function createProviderRequest(profile: Pick<ModelProfile, 'provider' | 'model' | 'endpoint'>, apiKey: string, prompt: string, image: { buffer: Buffer; dataUrl: string }, signal: AbortSignal) {
  const url = profile.endpoint.replace(/\{model\}|%7Bmodel%7D/gi, encodeURIComponent(profile.model));
  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
  let body: FormData | string;
  if (profile.provider === 'openai') {
    body = new FormData(); body.set('model', profile.model); body.set('prompt', prompt); body.set('n', '1');
    body.set('image', new Blob([new Uint8Array(image.buffer)], { type: 'image/png' }), 'portrait.png');
  } else {
    headers['Content-Type'] = 'application/json';
    if (profile.provider === 'gemini') {
      delete headers.Authorization; headers['x-goog-api-key'] = apiKey;
      body = JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: 'image/png', data: image.buffer.toString('base64') } }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } });
    } else if (profile.provider === 'dashscope') {
      body = JSON.stringify({ model: profile.model, input: { messages: [{ role: 'user', content: [{ image: image.dataUrl }, { text: prompt }] }] }, parameters: { n: 1, ...(profile.model === 'qwen-image-edit' ? {} : { prompt_extend: false }) } });
    } else {
      body = JSON.stringify({ model: profile.model, prompt, image: image.dataUrl, response_format: 'b64_json', size: '2K', stream: false, sequential_image_generation: 'disabled' });
    }
  }
  return { url, init: { method: 'POST', headers, body, signal } satisfies RequestInit };
}

const imagePart = z.object({ image: z.string().optional(), text: z.string().optional() });
const responseSchema = z.object({
  data: z.array(z.object({ b64_json: z.string().optional(), url: z.string().optional() })).optional(),
  output: z.object({ choices: z.array(z.object({ message: z.object({ content: z.array(imagePart) }) })).optional() }).optional(),
  candidates: z.array(z.object({ content: z.object({ parts: z.array(z.object({ thought: z.boolean().optional(), inlineData: z.object({ data: z.string(), mimeType: z.string().optional() }).optional(), inline_data: z.object({ data: z.string(), mime_type: z.string().optional() }).optional() })) }).optional() })).optional(),
  error: z.unknown().optional(), code: z.string().optional(), request_id: z.string().optional(),
});
export function extractImage(payload: unknown) {
  const result = responseSchema.safeParse(payload);
  if (!result.success || result.data.error || result.data.code) throw new PublicError('供应商未返回可用图像。请检查接口类型、模型权限和输入要求。', 502);
  const r = result.data;
  if (r.data?.[0]?.b64_json) return { base64: r.data[0].b64_json, requestId: r.request_id };
  if (r.data?.[0]?.url) return { url: r.data[0].url, requestId: r.request_id };
  const qwen = r.output?.choices?.flatMap(c => c.message.content).find(c => c.image)?.image;
  if (qwen) return { url: qwen, requestId: r.request_id };
  const gemini = r.candidates?.flatMap(c => c.content?.parts || []).filter(p => !p.thought).find(p => p.inlineData || p.inline_data);
  if (gemini) return { base64: gemini.inlineData?.data || gemini.inline_data!.data, requestId: r.request_id };
  throw new PublicError('模型没有返回图片。它可能只回复了文字，或该模型不支持图像编辑。请更换模型或调整提示词。', 502);
}
export async function generate(input: GenerationInput, signal: AbortSignal, send: Transport = transport): Promise<GenerationResult> {
  const started = Date.now();
  const normalized = await normalizeImage(input.image);
  const { createHash } = await import('node:crypto');
  const inputHash = createHash('sha256').update(normalized.buffer).digest('hex');
  const { url, init } = createProviderRequest(input.profile, input.apiKey, input.prompt, normalized, signal);
  const response = await send(url, init);
  if (response.status < 200 || response.status >= 300) {
    const message = response.status === 401 || response.status === 403 ? '密钥无效或没有模型权限，请到「模型接入」检查密钥和账号权限。' : response.status === 429 ? '供应商额度不足或请求过于频繁，请检查余额或稍后重试。' : response.status === 404 ? '未找到接口或模型，请检查完整地址与模型 ID。' : `供应商拒绝了请求（HTTP ${response.status}），请检查模型、接口类型与输入要求。`;
    throw new PublicError(message, 502);
  }
  let json: unknown;
  try { json = JSON.parse(Buffer.from(response.body).toString()); } catch { throw new PublicError('接口返回了非 JSON 内容，请确认填写的是 API 地址。', 502); }
  const output = extractImage(json);
  let bytes: Buffer;
  if (output.base64) {
    const b64 = output.base64.replace(/^data:image\/[a-z]+;base64,/, '');
    if (!/^[A-Za-z0-9+/]+=*$/.test(b64) || b64.length > 44_000_000) throw new PublicError('供应商返回的图片编码不正确或文件过大。', 502);
    bytes = Buffer.from(b64, 'base64');
  } else {
    // Result downloads get no API key, enforce public DNS and a hard response-size limit.
    const media = await send(output.url!, { signal }, 24 * 1024 * 1024, false);
    if (media.status !== 200) throw new PublicError('图片已生成，但下载失败。请检查供应商结果链接是否有效。', 502);
    bytes = Buffer.from(media.body);
  }
  try {
    const outputImage = sharp(bytes, { limitInputPixels: 40_000_000 });
    const metadata = await outputImage.metadata();
    if (!['png', 'jpeg', 'webp'].includes(metadata.format || '')) throw new Error('not image');
    const { data, info } = await outputImage.png().toBuffer({ resolveWithObject: true });
    if (data.length > 24 * 1024 * 1024) throw new Error('too large');
    return { image: `data:image/png;base64,${data.toString('base64')}`, mimeType: 'image/png', width: info.width, height: info.height, durationMs: Date.now() - started, inputHash, requestId: output.requestId?.slice(0, 100), parameters: { inputMaxEdge: 2048, inputFormat: 'png', ...(input.profile.provider === 'seedream' ? { size: '2K', response_format: 'b64_json', stream: false, sequential_image_generation: 'disabled' } : input.profile.provider === 'gemini' ? { responseModalities: ['TEXT', 'IMAGE'] } : input.profile.provider === 'dashscope' ? { n: 1, ...(input.profile.model === 'qwen-image-edit' ? {} : { prompt_extend: false }) } : { n: 1 }) } };
  } catch { throw new PublicError('返回内容不是可用图片，请检查模型的图像输出能力。', 502); }
}
