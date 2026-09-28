import { createApp } from './app.mjs';
import { normalizeAppOrigin } from './config.mjs';

const production = process.argv.includes('--production') || process.env.NODE_ENV === 'production';
const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 8787);
const origin = normalizeAppOrigin(process.env.APP_ORIGIN ?? (production ? '' : 'http://127.0.0.1:5173'), { production });
const dbPath = process.env.DB_PATH ?? (production ? '' : './data/life.sqlite');
const authSecret = process.env.AUTH_SECRET;

if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT 无效');
if (!authSecret || authSecret.length < 32) throw new Error('请配置至少 32 字符的 AUTH_SECRET');
if (production && (!dbPath || dbPath === ':memory:')) {
  throw new Error('生产环境需要持久化 DB_PATH');
}

const { server } = createApp({
  dbPath, production, authSecret,
  allowedOrigins: production ? [origin] : [origin, 'http://localhost:5173'],
  staticDir: production ? './dist' : undefined,
});

server.listen(port, host, () => {
  console.log(`一生一格服务已启动：http://${host}:${port}`);
});
