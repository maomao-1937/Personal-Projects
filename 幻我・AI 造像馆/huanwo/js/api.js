/* ============================================================
   幻我 · AI 造像馆 — 大模型接入层
   ------------------------------------------------------------
   启动时自动调用 GET /api/status 检测后端是否已配置 API Key：
     - 已配置 → 真实模式：POST /api/generate 调用生图 API
     - 未配置 → 预览模式：返回本地示例图（便于前端开发核验）
   API Key 仅存在服务端 .env，前端不接触密钥。
   ============================================================ */

const API = {
  /* 运行时状态，由 checkStatus() 填充 */
  ready: false,
  realMode: false,
  provider: '',
  model: '',

  /* 服务端代理地址（同源） */
  endpoint: '/api/generate',
  statusEndpoint: '/api/status',

  /**
   * 检测后端 API 状态，决定运行模式
   * @returns {Promise<boolean>} 是否为真实模式
   */
  async checkStatus() {
    try {
      const res = await fetch(this.statusEndpoint, { cache: 'no-store' });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      this.realMode = !!data.hasApiKey;
      this.provider = data.provider || '';
      this.model = data.model || '';
      this.ready = true;
      console.log(`[API] 模式: ${this.realMode ? '真实生成' : '预览示例'}${this.realMode ? ` (${this.provider}/${this.model})` : ''}`);
      return this.realMode;
    } catch (e) {
      /* 后端不可用时回退预览模式 */
      this.realMode = false;
      this.ready = true;
      console.log('[API] 后端不可达，使用预览模式:', e.message);
      return false;
    }
  },

  /**
   * 生成一组图片
   * @param {object} 入参
   * @param {string[]} photos  - 用户上传照片的 dataURL 列表（1-3 张）
   * @param {object}   style   - 所选风格对象（含 id / name）
   * @param {number}   count   - 生成张数（默认 4）
   * @param {string}   prompt  - 用户附加描述（可选）
   * @param {string}   ratio   - 图片比例（1:1 / 3:4 / 9:16，可选）
   * @returns {Promise<string[]>} 图片 dataURL 或 URL 列表
   */
  async generate({ photos = [], style, count = 4, prompt = '', ratio = '1:1' }) {
    if (!style) throw new Error('请选择风格');

    /* 预览模式 */
    if (!this.realMode) {
      await sleep(1600 + Math.random() * 1200);
      return Array.from({ length: count }, (_, i) => makeDemoImage(style, i));
    }

    /* 真实模式：调用服务端代理 */
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        style: style.name,
        styleId: style.id,
        prompt,
        images: photos,
        count,
        ratio,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `生图服务异常 (${res.status})`);
    }
    if (!data || !Array.isArray(data.images) || data.images.length === 0) {
      throw new Error('生图服务未返回图片');
    }
    return data.images;
  },
};

/* ============================================================
   预览模式：本地生成示例占位图（不依赖网络）
   ============================================================ */
function makeDemoImage(style, index) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  /* 渐变背景 */
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, style.c1 || '#FF5A79');
  grad.addColorStop(1, style.c2 || '#FFC15E');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  /* 装饰圆 */
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 6; i++) {
    const r = 40 + Math.random() * 80;
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  /* 风格名 */
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = 'bold 36px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(style.name, size / 2, size / 2 - 20);

  /* 示例标记 */
  ctx.font = '20px -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(`示例图 ${index + 1}`, size / 2, size / 2 + 30);

  return canvas.toDataURL('image/png');
}
