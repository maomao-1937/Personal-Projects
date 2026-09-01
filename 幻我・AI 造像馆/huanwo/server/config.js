/* ============================================================
   幻我 · AI 造像馆 — 服务端配置
   API Key 从环境变量或项目根目录 .env 文件读取
   支持 OpenAI 兼容格式的生图 API（DALL-E / 通义万相 / 智谱 等）
   ============================================================ */

const fs = require('fs');
const path = require('path');

/* 读取 .env 文件（如果存在），写入 process.env */
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnv();

const config = {
  /* 服务端口 */
  port: parseInt(process.env.PORT || '8099', 10),

  /* 生图 API 配置 */
  api: {
    /* API 供应商：openai (默认，兼容 OpenAI 格式) */
    provider: process.env.AI_PROVIDER || 'openai',

    /* API Key —— 必须设置，否则服务以预览模式运行 */
    key: process.env.AI_API_KEY || '',

    /* API 基础地址（OpenAI 兼容格式） */
    baseUrl: process.env.AI_BASE_URL || 'https://api.openai.com/v1',

    /* 生图模型名 */
    model: process.env.AI_IMAGE_MODEL || 'dall-e-3',

    /* 生成图片尺寸 */
    size: process.env.AI_IMAGE_SIZE || '1024x1024',

    /* 每次生成张数（DALL-E 3 只支持 1，部分模型支持多张） */
    batchSize: parseInt(process.env.AI_BATCH_SIZE || '1', 10),
  },

  /* 是否有可用的 API Key */
  get hasApiKey() {
    return !!this.api.key;
  },

  /* 邀请码列表（从 .env 的 INVITE_CODES 读取，逗号分隔） */
  inviteCodes: (process.env.INVITE_CODES || 'HUANWO2024,VIP888,TEST123')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean),
};

module.exports = config;
