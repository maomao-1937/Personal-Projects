/* ============================================================
   幻我 · AI 造像馆 — 静态数据
   风格目录 & 套餐方案
   ============================================================ */

/* 风格目录：c1/c2 渐变，pattern 为缩略图装饰 SVG（填充式，64x64） */
const STYLES = [
  {
    id: 'anime', name: '二次元动漫', c1: '#7C5CFF', c2: '#B388FF', desc: '日系动画风 · 清透大眼',
    pattern: '<svg viewBox="0 0 64 64" fill="none"><path d="M32 8l6.5 17 17 6.5-17 6.5L32 55l-6.5-17-17-6.5 17-6.5L32 8Z" fill="currentColor"/><circle cx="50" cy="16" r="3.5" fill="currentColor"/><circle cx="13" cy="48" r="2.5" fill="currentColor"/></svg>',
  },
  {
    id: 'guofeng', name: '国风古风', c1: '#C0392B', c2: '#E67E22', desc: '汉服古韵 · 水墨质感',
    pattern: '<svg viewBox="0 0 64 64" fill="none"><path d="M20 48c-6.5 0-11-4.5-11-10s4.5-10 11-10c1 0 2 .1 3 .5C24 19 31 13 39 16.5c7.5 3 10.5 11 7 18.5 1 .5 1.8 1.2 2.5 2 4.5 3.8 2 11.5-3.5 12.5H20Z" fill="currentColor"/><circle cx="48" cy="20" r="3.5" fill="currentColor"/></svg>',
  },
  {
    id: 'q3d', name: '3D 卡通 Q 版', c1: '#29B6F6', c2: '#81D4FA', desc: 'Q 萌立体 · 软糯可爱',
    pattern: '<svg viewBox="0 0 64 64" fill="none"><path d="M32 54S9 39 9 23a11 11 0 0 1 18.5-7.5L32 18l4.5-2.5A11 11 0 0 1 55 23c0 16-23 31-23 31Z" fill="currentColor"/></svg>',
  },
  {
    id: 'cyber', name: '赛博朋克', c1: '#00E5FF', c2: '#7C4DFF', desc: '霓虹街头 · 未来感',
    pattern: '<svg viewBox="0 0 64 64" fill="none"><path d="M32 5 56 19v18L32 51 8 37V19L32 5Z" fill="currentColor" opacity=".3"/><path d="M32 13 48 22v14l-16 9-16-9V22l16-9Z" fill="currentColor"/><circle cx="32" cy="29" r="5" fill="white" opacity=".45"/></svg>',
  },
  {
    id: 'illust', name: '手绘插画', c1: '#66BB6A', c2: '#FFD54F', desc: '手绘水彩 · 温柔治愈',
    pattern: '<svg viewBox="0 0 64 64" fill="none"><path d="M44 7 57 20 27 50H11V34L44 7Z" fill="currentColor"/><circle cx="17" cy="45" r="3.5" fill="white" opacity=".5"/><path d="m38 13 9 9" stroke="white" stroke-width="3.5" stroke-linecap="round" opacity=".5"/></svg>',
  },
  {
    id: 'real', name: '真人写实', c1: '#8D6E63', c2: '#D7CCC8', desc: '电影感写真 · 精致自然',
    pattern: '<svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="23" fill="none" stroke="currentColor" stroke-width="7"/><path d="m32 11 11.5 21L32 53 20.5 32 32 11Z" fill="currentColor"/></svg>',
  },
  {
    id: 'couple', name: '情侣合照', c1: '#FF5A79', c2: '#F48FB1', desc: '双人同框 · 甜蜜氛围',
    pattern: '<svg viewBox="0 0 64 64" fill="none"><path d="M22 48s-13-8.5-13-19a7 7 0 0 1 12.5-4.5l.5.5.5-.5A7 7 0 0 1 35 29c0 10.5-13 19-13 19Z" fill="currentColor"/><path d="M47 56s-9-6-9-13a5 5 0 0 1 9-3l.5.5.5-.5a5 5 0 0 1 9 3c0 7-9 13-9 13Z" fill="currentColor"/></svg>',
  },
  {
    id: 'pet', name: '宠物拟人', c1: '#FFB74D', c2: '#FF8A65', desc: '宠物变人 · 可爱满分',
    pattern: '<svg viewBox="0 0 64 64" fill="none"><ellipse cx="32" cy="41" rx="13" ry="10" fill="currentColor"/><circle cx="16" cy="26" r="5.5" fill="currentColor"/><circle cx="26" cy="16" r="5.5" fill="currentColor"/><circle cx="38" cy="16" r="5.5" fill="currentColor"/><circle cx="48" cy="26" r="5.5" fill="currentColor"/></svg>',
  },
];

/* 套餐方案（演示数据，定价可后续调整） */
const PLANS = [
  {
    name: '免费体验', price: '¥0', tag: '限时新客', hot: false,
    items: ['3 张 · 带水印', '全部风格可选', '每日 1 次生成'],
  },
  {
    name: '畅玩包', price: '¥19.9', tag: '最受欢迎', hot: true,
    items: ['50 张 · 标清', '无水印下载', '高清导出 ¥3.9/张'],
  },
  {
    name: '专业包', price: '¥69/月', tag: '创作者首选', hot: false,
    items: ['300 张 · 高清', '无限高清导出', '优先生成队列', '支持批量生成'],
  },
];

/* 风格在 CSS 缩略图中的渐变 */
function styleGradient(s) {
  return `linear-gradient(135deg, ${s.c1}, ${s.c2})`;
}
