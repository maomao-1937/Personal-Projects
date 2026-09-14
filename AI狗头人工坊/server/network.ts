import dns from 'node:dns';
import ipaddr from 'ipaddr.js';
import { Agent, fetch as undiciFetch, type RequestInit as UndiciRequestInit } from 'undici';

export class PublicError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function isPublicAddress(address: string) {
  try { return ipaddr.process(address).range() === 'unicast'; } catch { return false; }
}
const dispatcher = new Agent({
  connect: {
    lookup(hostname, options, callback) {
      dns.lookup(hostname, { all: true, family: typeof options.family === 'number' ? options.family : 0 }, (err, addresses) => {
        if (err) return callback(err, '', 4);
        if (!addresses.length || addresses.some(a => !isPublicAddress(a.address))) return callback(new Error('Private network target rejected'), '', 4);
        if (options.all) callback(null, addresses);
        else callback(null, addresses[0].address, addresses[0].family);
      });
    },
  },
});
export function validateTarget(raw: string, isProvider = true) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new PublicError('接口地址格式不正确，请检查完整 HTTPS 地址。'); }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw new PublicError('仅支持标准 HTTPS 公网接口。');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (ipaddr.isValid(host) || !host.includes('.') || host.endsWith('.local') || host.endsWith('.localhost')) throw new PublicError('不支持本机、内网或 IP 地址，请使用供应商域名。');
  if (isProvider && (url.search || url.hash)) throw new PublicError('接口地址不能包含查询参数或密钥。');
  const official = ['api.openai.com', 'generativelanguage.googleapis.com', 'dashscope.aliyuncs.com', 'dashscope-intl.aliyuncs.com', 'dashscope-us.aliyuncs.com', 'ark.cn-beijing.volces.com', 'api.deepseek.com', 'open.bigmodel.cn', 'api.minimax.cn', 'api.minimaxi.com', 'api.minimax.io', 'api.moonshot.cn', 'api.moonshot.ai'];
  const workspace = /^[a-z0-9-]+\.(cn-beijing|ap-southeast-1|us-east-1)\.maas\.aliyuncs\.com$/.test(host);
  const custom = (process.env.ALLOWED_API_HOSTS || '').split(',').map(x => x.trim()).filter(Boolean);
  if (isProvider && !official.includes(host) && !workspace && !custom.includes(host)) throw new PublicError('此服务地址尚未开放。请让站点维护者将域名加入 ALLOWED_API_HOSTS 后重启。');
  return url;
}
export type Transport = (url: string, init: RequestInit, limit?: number, provider?: boolean) => Promise<{ status: number; body: Uint8Array; contentType: string }>;
export const transport: Transport = async (raw, init, limit = 32 * 1024 * 1024, provider = true) => {
  const url = validateTarget(raw, provider);
  // Pin public DNS validation to the actual connection and never forward credentials across redirects.
  const response = await undiciFetch(url, { method: init.method, headers: Object.fromEntries(new Headers(init.headers)), body: init.body as UndiciRequestInit['body'], signal: init.signal, redirect: 'error', dispatcher });
  if (Number(response.headers.get('content-length')) > limit) { await response.body?.cancel(); throw new PublicError('供应商返回内容过大，请降低输出尺寸。', 502); }
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    if (reader) while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); throw new PublicError('供应商返回内容过大，请降低输出尺寸。', 502); }
      chunks.push(value);
    }
  } finally { reader?.releaseLock(); }
  return { status: response.status, body: Buffer.concat(chunks), contentType: response.headers.get('content-type') || '' };
};
