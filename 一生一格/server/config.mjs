export function normalizeAppOrigin(value, { production = false } = {}) {
  if (typeof value !== 'string') throw new Error('APP_ORIGIN 必须是完整的网址');
  const raw = value.trim();
  // An origin has no path, query, fragment or userinfo. One final slash is harmless.
  if (raw.includes('\\') || !/^https?:\/\/[^/?#]+\/?$/i.test(raw)) throw new Error('APP_ORIGIN 只能填写站点来源，不能包含路径、参数或片段');
  const authority = raw.match(/^https?:\/\/([^/?#]+)/i)?.[1] ?? '';
  if (authority.includes('@')) throw new Error('APP_ORIGIN 不能包含用户名或密码');
  let parsed;
  try { parsed = new URL(raw); }
  catch { throw new Error('APP_ORIGIN 不是有效网址'); }
  if (!parsed.host || !['http:', 'https:'].includes(parsed.protocol) || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('APP_ORIGIN 不是有效站点来源');
  }
  if (production && parsed.protocol !== 'https:') throw new Error('生产环境 APP_ORIGIN 必须使用 HTTPS');
  return parsed.origin;
}
