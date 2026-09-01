/* ============================================================
   幻我 · AI 造像馆 — 通用工具
   localStorage / 提示 / 下载 / 示例图生成
   ============================================================ */

const Store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) {
      return fallback;
    }
  },
  set(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      console.warn('localStorage 写入失败', e);
    }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  },
};

let _toastTimer = null;
function toast(msg, ms = 2200) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('is-show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('is-show'), ms);
}

function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/* 示例图生成：预览模式下在 Canvas 上绘制一张风格化占位图 */
function makeDemoImage(style, seed = 0) {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');

  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, style.c1);
  g.addColorStop(1, style.c2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const rg = ctx.createRadialGradient(size / 2, size / 2, 40, size / 2, size / 2, size * 0.55);
  rg.addColorStop(0, 'rgba(255,255,255,0.35)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, size, size);

  ctx.font = '190px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(style.emoji, size / 2, size * 0.44);

  ctx.font = '600 40px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillText(style.name, size / 2, size * 0.76);

  ctx.font = '26px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(`AI 示例 · 接入后真实生成 ${seed + 1}`, size / 2, size * 0.9);

  return c.toDataURL('image/png');
}
