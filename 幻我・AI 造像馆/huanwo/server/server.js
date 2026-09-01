/* ============================================================
   幻我 · AI 造像馆 — 后端服务（零依赖）
   - 静态文件服务（前端）
   - POST /api/generate  生图代理（OpenAI 兼容格式）
   - GET  /api/status    服务状态（是否已配置 API Key）
   ============================================================ */

const http = require('http');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const ROOT = path.join(__dirname, '..');
const PORT = config.port;

/* ---------- MIME 类型 ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/* ---------- 工具 ---------- */
function sendJSON(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 25 * 1024 * 1024) { reject(new Error('请求体过大')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

/* 安全拼接静态文件路径，防止目录穿越 */
function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const target = path.normalize(path.join(root, decoded));
  if (!target.startsWith(root)) return null;
  return target;
}

/* ---------- 静态文件服务 ---------- */
function serveStatic(req, res) {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = safeJoin(ROOT, urlPath);
  if (!filePath) { sendJSON(res, 403, { error: '禁止访问' }); return; }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      /* SPA 回退到 index.html */
      const indexPath = path.join(ROOT, 'index.html');
      fs.readFile(indexPath, (e2, data) => {
        if (e2) { sendJSON(res, 404, { error: '未找到' }); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

/* ---------- 生图 API 代理 ---------- */

/* 根据风格和用户输入构建 prompt
   策略：用户自定义描述权重最高，放最前面；
   有自定义描述时不强制保留面部特征（用户可能想要创意变形）；
   无自定义描述时才默认保留参考图面部特征。 */
function buildPrompt(styleName, userPrompt, photoCount) {
  const styleHints = {
    '二次元动漫': 'Japanese anime style, cel shading, clean line art, vibrant colors, expressive eyes',
    '国风古风': 'Chinese traditional style, hanfu, ink wash painting aesthetic, elegant, classical',
    '3D 卡通 Q 版': '3D cartoon chibi style, Pixar-like rendering, soft lighting, cute proportions, kawaii',
    '赛博朋克': 'cyberpunk style, neon lights, futuristic city, holographic, high contrast, sci-fi',
    '手绘插画': 'hand-drawn illustration, watercolor texture, soft pastel colors, whimsical, artistic',
    '真人写实': 'photorealistic portrait, cinematic lighting, high detail, professional photography, 8k',
    '情侣合照': 'romantic couple portrait, warm atmosphere, soft focus, intimate, love theme',
    '宠物拟人': 'anthropomorphic pet character, cute animal personification, furry style, adorable',
  };
  const hint = styleHints[styleName] || 'portrait photography, high quality';
  const quality = 'masterpiece, best quality, highly detailed';

  if (userPrompt && userPrompt.trim()) {
    /* 用户有自定义描述：用户创意优先，参考图仅作姿态/构图参考 */
    const refNote = photoCount > 0 ? 'inspired by the reference photo composition, ' : '';
    return `${userPrompt.trim()}, ${hint}, ${refNote}${quality}`;
  }

  /* 无自定义描述：默认保留参考图面部特征，做风格化头像 */
  const photoNote = photoCount > 0 ? 'based on the person in the reference photo, preserve facial features and likeness, ' : '';
  return `${photoNote}${hint}, ${quality}`;
}

/* 比例 → API 尺寸映射 */
function ratioToSize(ratio, separator = 'x') {
  const map = {
    '1:1': ['1024', '1024'],
    '3:4': ['1024', '1792'],
    '4:3': ['1792', '1024'],
    '9:16': ['1024', '1792'],
    '16:9': ['1792', '1024'],
  };
  const dims = map[ratio] || ['1024', '1024'];
  return dims.join(separator);
}

/* 我们的 8 种风格 → wanx-v1 风格枚举 */
function styleToWanx(styleName) {
  const map = {
    '二次元动漫': '<anime>',
    '国风古风': '<chinese painting>',
    '3D 卡通 Q 版': '<3d cartoon>',
    '赛博朋克': '<auto>',
    '手绘插画': '<watercolor>',
    '真人写实': '<portrait>',
    '情侣合照': '<portrait>',
    '宠物拟人': '<auto>',
  };
  return map[styleName] || '<auto>';
}

/* ---------- OpenAI 兼容格式（保留作备选） ---------- */
async function callOpenAICompatible(prompt, count, size) {
  const { key, baseUrl, model, batchSize } = config.api;
  const n = Math.min(count, batchSize);

  const body = JSON.stringify({
    model, prompt, n, size, response_format: 'b64_json',
  });

  const url = new URL(`${baseUrl.replace(/\/$/, '')}/images/generations`);
  const options = {
    method: 'POST',
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + url.search,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'Content-Length': Buffer.byteLength(body),
    },
  };

  return new Promise((resolve, reject) => {
    const mod = url.protocol === 'https:' ? require('https') : require('http');
    const req = mod.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8');
        if (res.statusCode >= 400) { reject(new Error(`API 返回 ${res.statusCode}: ${raw.slice(0, 500)}`)); return; }
        try {
          const data = JSON.parse(raw);
          const images = (data.data || []).map((item) => {
            if (item.b64_json) return `data:image/png;base64,${item.b64_json}`;
            if (item.url) return item.url;
            return null;
          }).filter(Boolean);
          resolve(images);
        } catch (e) { reject(new Error(`解析 API 响应失败: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(120000, () => { req.destroy(new Error('生图请求超时（120秒）')); });
    req.write(body);
    req.end();
  });
}

/* 远程图片 URL → base64 data URL（解决前端跨域下载问题） */
async function urlToDataUrl(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      method: 'GET',
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      headers: { 'User-Agent': 'huanwo-server/1.0' },
    };
    const req = require('https').request(opts, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        /* 跟随重定向 */
        urlToDataUrl(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode >= 400) { reject(new Error(`下载图片失败 ${res.statusCode}`)); return; }
      const contentType = res.headers['content-type'] || 'image/png';
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const b64 = Buffer.concat(chunks).toString('base64');
        resolve(`data:${contentType};base64,${b64}`);
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(new Error('下载图片超时')); });
    req.end();
  });
}

/* ---------- 万相原生异步 API（dashscope） ---------- */
async function callWanxNative(prompt, count, size, refImage, styleName, hasUserPrompt) {
  const { key, baseUrl, model, batchSize } = config.api;
  const n = Math.min(count, batchSize || 4);
  const base = baseUrl.replace(/\/$/, '');
  /* 有用户自定义描述时用 <auto>，让用户创意主导；无描述时用风格预设保证一致性 */
  const wanxStyle = hasUserPrompt ? '<auto>' : styleToWanx(styleName);

  /* 步骤 1：创建任务 */
  const input = { prompt };
  if (refImage) input.image = refImage; // data:image/...;base64,...

  const createBody = JSON.stringify({
    model,
    input,
    parameters: { size, n, style: wanxStyle },
  });

  const createOpts = {
    method: 'POST',
    hostname: new URL(base).hostname,
    port: 443,
    path: '/api/v1/services/aigc/text2image/image-synthesis',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'X-DashScope-Async': 'enable',
      'Content-Length': Buffer.byteLength(createBody),
    },
  };

  const taskId = await new Promise((resolve, reject) => {
    const req = require('https').request(createOpts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8');
        if (res.statusCode >= 400) { reject(new Error(`创建任务失败 ${res.statusCode}: ${raw.slice(0, 500)}`)); return; }
        try {
          const data = JSON.parse(raw);
          const tid = data.output?.task_id;
          if (!tid) { reject(new Error('响应中无 task_id: ' + raw.slice(0, 300))); return; }
          resolve(tid);
        } catch (e) { reject(new Error(`解析创建任务响应失败: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(new Error('创建任务超时')); });
    req.write(createBody);
    req.end();
  });

  console.log(`[万相] 任务已创建 task_id=${taskId} style=${wanxStyle} n=${n} size=${size}`);

  /* 步骤 2：轮询任务结果（最多 120 秒，每 3 秒一次） */
  const pollOpts = {
    method: 'GET',
    hostname: new URL(base).hostname,
    port: 443,
    path: `/api/v1/tasks/${taskId}`,
    headers: { 'Authorization': `Bearer ${key}` },
  };

  const maxPolls = 40; // 40 * 3s = 120s
  for (let i = 0; i < maxPolls; i++) {
    await new Promise((r) => setTimeout(r, 3000));

    const result = await new Promise((resolve, reject) => {
      const req = require('https').request(pollOpts, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8'))); }
          catch (e) { reject(new Error('解析轮询响应失败')); }
        });
      });
      req.on('error', reject);
      req.setTimeout(15000, () => { req.destroy(new Error('轮询超时')); });
      req.end();
    });

    const status = result.output?.task_status;
    console.log(`[万相] 轮询 ${i + 1}/${maxPolls} status=${status}`);

    if (status === 'SUCCEEDED') {
      const images = (result.output?.results || []).map((r) => r.url).filter(Boolean);
      if (images.length === 0) throw new Error('任务成功但未返回图片');
      return images;
    }
    if (status === 'FAILED') {
      const code = result.output?.code || result.code || 'unknown';
      const msg = result.output?.message || result.message || '任务失败';
      throw new Error(`生图任务失败 [${code}]: ${msg}`);
    }
    /* PENDING / RUNNING → 继续轮询 */
  }

  throw new Error('生图任务超时（120秒未完成）');
}

async function handleVerifyInvite(req, res) {
  try {
    const raw = await readBody(req);
    const body = JSON.parse(raw);
    const code = (body.code || '').trim().toUpperCase();

    if (!code) { sendJSON(res, 400, { error: '请输入邀请码' }); return; }

    const valid = config.inviteCodes.includes(code);
    if (valid) {
      console.log(`[邀请码] 验证通过: ${code}`);
      sendJSON(res, 200, { success: true, code });
    } else {
      console.log(`[邀请码] 验证失败: ${code}`);
      sendJSON(res, 403, { success: false, error: '邀请码无效' });
    }
  } catch (e) {
    sendJSON(res, 500, { error: '验证失败' });
  }
}

async function handleGenerate(req, res) {
  if (!config.hasApiKey) {
    sendJSON(res, 503, { error: '未配置 API Key，请在 .env 中设置 AI_API_KEY', preview: true });
    return;
  }

  try {
    const raw = await readBody(req);
    const body = JSON.parse(raw);
    const { style = '', prompt = '', images = [], count = 4, ratio = '1:1' } = body;

    if (!style) { sendJSON(res, 400, { error: '请选择风格' }); return; }

    const provider = config.api.provider;
    const refImage = images.length > 0 ? images[0] : null; // 取第一张作参考图

    let results;
    if (provider === 'dashscope') {
      const imgSize = ratioToSize(ratio, '*'); // 万相用 * 分隔
      const fullPrompt = buildPrompt(style, prompt, images.length);
      console.log(`[生图] provider=dashscope style=${style} count=${count} ratio=${ratio} size=${imgSize} refImage=${refImage ? '有' : '无'}`);
      const hasUserPrompt = !!(prompt && prompt.trim().length > 0);
      const urls = await callWanxNative(fullPrompt, count, imgSize, refImage, style, hasUserPrompt);
      /* 远程 URL → data URL（前端下载需要） */
      console.log(`[生图] 正在下载 ${urls.length} 张图片并转换...`);
      results = await Promise.all(urls.map((u) => urlToDataUrl(u)));
      console.log(`[生图] 转换完成，总大小约 ${Math.round(results.reduce((s, d) => s + d.length, 0) / 1024)} KB`);
    } else {
      const imgSize = ratioToSize(ratio, 'x');
      const fullPrompt = buildPrompt(style, prompt, images.length);
      console.log(`[生图] provider=openai style=${style} count=${count} ratio=${ratio}`);
      results = await callOpenAICompatible(fullPrompt, count, imgSize);
    }

    sendJSON(res, 200, {
      success: true,
      images: results,
      style,
      provider,
    });
  } catch (e) {
    console.error('[生图错误]', e.message);
    sendJSON(res, 500, { error: e.message || '生图失败' });
  }
}

/* ---------- 路由 ---------- */
const server = http.createServer((req, res) => {
  /* CORS 预检 */
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const urlPath = req.url.split('?')[0];

  if (req.method === 'GET' && urlPath === '/api/status') {
    sendJSON(res, 200, {
      ok: true,
      hasApiKey: config.hasApiKey,
      provider: config.api.provider,
      model: config.api.model,
      time: new Date().toISOString(),
    });
    return;
  }

  if (req.method === 'POST' && urlPath === '/api/generate') {
    handleGenerate(req, res);
    return;
  }

  if (req.method === 'POST' && urlPath === '/api/verify-invite') {
    handleVerifyInvite(req, res);
    return;
  }

  if (req.method === 'GET') {
    serveStatic(req, res);
    return;
  }

  sendJSON(res, 405, { error: '方法不允许' });
});

server.listen(PORT, () => {
  console.log('========================================');
  console.log('  幻我 · AI 造像馆 后端服务已启动');
  console.log(`  本地地址: http://localhost:${PORT}`);
  console.log(`  API 状态: ${config.hasApiKey ? '已配置 (' + config.api.provider + ' / ' + config.api.model + ')' : '未配置 Key（预览模式）'}`);
  console.log('========================================');
});
