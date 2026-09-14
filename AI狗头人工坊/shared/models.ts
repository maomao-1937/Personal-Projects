import { z } from 'zod';

export const providerTypes = ['openai', 'gemini', 'dashscope', 'seedream'] as const;
export type ProviderType = typeof providerTypes[number];
export const profileSchema = z.object({
  id: z.string().min(1).max(80), name: z.string().trim().min(1).max(48),
  provider: z.enum(providerTypes), model: z.string().trim().min(1).max(160).regex(/^[a-zA-Z0-9_.:/-]+$/),
  endpoint: z.string().trim().url().max(600).refine(v => {
    const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash;
  }, '请填写不带密钥或查询参数的 HTTPS 接口地址'),
});
export type ModelProfile = z.infer<typeof profileSchema>;
export const configSchema = z.object({ version: z.literal(1), models: z.array(profileSchema).max(30) });
export const providerInfo: Record<ProviderType, { label: string; short: string; endpoint: string; model: string; hint: string; docs: string }> = {
  openai: { label: 'OpenAI / Images Edits 兼容', short: 'OpenAI', endpoint: 'https://api.openai.com/v1/images/edits', model: 'gpt-image-2', hint: '填写完整图片编辑端点。兼容服务需支持 multipart image 文件及同步图像返回。', docs: 'https://developers.openai.com/api/reference/resources/images/methods/edit' },
  gemini: { label: 'Google Gemini', short: 'Gemini', endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent', model: 'gemini-3.1-flash-image', hint: '保留地址里的 {model}，调用时会替换为模型 ID。请使用支持图像输出的模型。', docs: 'https://ai.google.dev/gemini-api/docs/generate-content/image-generation' },
  dashscope: { label: '阿里云百炼 · 千问', short: '千问', endpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', model: 'qwen-image-edit-plus', hint: '按百炼控制台填写所在地域/业务空间的完整端点。使用原生图像编辑协议。', docs: 'https://help.aliyun.com/zh/model-studio/qwen-image-edit-api' },
  seedream: { label: '火山方舟 · Seedream', short: 'Seedream', endpoint: 'https://ark.cn-beijing.volces.com/api/v3/images/generations', model: 'doubao-seedream-4-5-251128', hint: '使用支持图生图的 Seedream 模型 ID 或推理接入点 ID，单张 2K 输出。', docs: 'https://www.volcengine.com/docs/82379/1541523' },
};
export { breeds, type Breed, compilePrompt as buildPrompt } from './breeds';
export function publicProfile(profile: ModelProfile): ModelProfile {
  // Explicit whitelist: never spread a credential-bearing object into persistence/export.
  return { id: profile.id, name: profile.name, provider: profile.provider, model: profile.model, endpoint: profile.endpoint };
}
