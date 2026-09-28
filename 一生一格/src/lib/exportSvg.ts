import type { LifeCalendar } from './lifeCalendar';

const COLORS = {
  background: '#F5F7F6',
  ink: '#14232B',
  muted: '#71818A',
  panel: '#12222A',
  panelText: '#F2F8F6',
  panelMuted: '#AFC4C2',
  past: '#67BEAA',
  current: '#FFB66E',
  future: '#344A51',
};

function xml(value: string): string {
  return value.replace(/[<>&"']/g, (character) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
  })[character] ?? character);
}

export function downloadCalendarSvg(calendar: LifeCalendar, birthDate: string, endDate: string) {
  const width = 1400;
  const splitAt = Math.ceil(calendar.rows.length / 2);
  const maxRows = splitAt;
  const rowHeight = 18;
  const gridY = 336;
  const panelY = 255;
  const panelHeight = 142 + maxRows * rowHeight;
  const height = panelY + panelHeight + 89;
  const columnX = [87, 738];
  const gridOffset = 51;
  const cellPitch = 9.65;
  const cellSize = 7.1;
  const font = 'font-family="Noto Sans SC, Microsoft YaHei, sans-serif"';
  const n = (value: number) => value.toLocaleString('zh-CN');

  const columns = [calendar.rows.slice(0, splitAt), calendar.rows.slice(splitAt)].map((rows, columnIndex) => {
    if (rows.length === 0) return '';
    const x = columnX[columnIndex];
    const startAge = columnIndex === 0 ? 0 : splitAt;
    const heading = `<text x="${x}" y="${gridY - 29}" ${font} font-size="18" font-weight="700" fill="${COLORS.panelText}">${startAge}—${startAge + rows.length - 1} 岁</text>`;
    const cells = rows.map((weeks, rowIndex) => {
      const age = startAge + rowIndex;
      const y = gridY + rowIndex * rowHeight;
      const ageLabel = age % 5 === 0 || age === rows.length + startAge - 1
        ? `<text x="${x + 28}" y="${y + 7}" ${font} font-size="10" text-anchor="end" fill="${COLORS.panelMuted}">${age}</text>`
        : '';
      const squares = weeks.map((week, cellIndex) => {
        const fill = COLORS[week.status];
        const selectedStroke = week.status === 'current' ? ` stroke="#FFF1DC" stroke-width="1.5"` : '';
        return `<rect x="${(x + gridOffset + cellIndex * cellPitch).toFixed(2)}" y="${y}" width="${cellSize}" height="${cellSize}" rx="1" fill="${fill}"${selectedStroke}/>`;
      }).join('');
      return `${ageLabel}${squares}`;
    }).join('');
    return heading + cells;
  }).join('');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="一生一格人生周历">
  <rect width="100%" height="100%" fill="${COLORS.background}"/>
  <rect x="68" y="53" width="16" height="16" rx="2" fill="${COLORS.ink}"/>
  <rect x="88" y="53" width="16" height="16" rx="2" fill="${COLORS.past}"/>
  <rect x="68" y="73" width="16" height="16" rx="2" fill="#9BD8C9"/>
  <rect x="88" y="73" width="16" height="16" rx="2" fill="${COLORS.current}"/>
  <text x="120" y="79" ${font} font-size="31" font-weight="800" fill="${COLORS.ink}">一生一格</text>
  <text x="68" y="151" ${font} font-size="42" font-weight="800" fill="${COLORS.ink}">把一生，看成一周一周。</text>
  <text x="68" y="189" ${font} font-size="16" fill="${COLORS.muted}">每一格，都是实实在在的七天。</text>
  <text x="1330" y="79" ${font} font-size="15" text-anchor="end" fill="${COLORS.muted}">出生 ${xml(birthDate.replaceAll('-', '.'))}　·　终点 ${xml(endDate.replaceAll('-', '.'))}</text>
  <text x="1330" y="147" ${font} font-size="32" font-weight="800" text-anchor="end" fill="${COLORS.ink}">${n(calendar.totalCount)} 周</text>
  <text x="1330" y="183" ${font} font-size="15" text-anchor="end" fill="${COLORS.muted}">已走过 ${n(calendar.pastCount)}　·　尚未到来 ${n(calendar.futureCount)}</text>
  <rect x="68" y="${panelY}" width="1264" height="${panelHeight}" rx="20" fill="${COLORS.panel}"/>
  <text x="87" y="${panelY + 41}" ${font} font-size="14" font-weight="700" letter-spacing="2" fill="${COLORS.panelMuted}">LIFE ATLAS / 人生周历</text>
  ${columns}
  <rect x="89" y="${panelY + panelHeight - 42}" width="11" height="11" rx="2" fill="${COLORS.past}"/>
  <text x="108" y="${panelY + panelHeight - 32}" ${font} font-size="13" fill="${COLORS.panelMuted}">已走过</text>
  <rect x="201" y="${panelY + panelHeight - 42}" width="11" height="11" rx="2" fill="${COLORS.current}"/>
  <text x="220" y="${panelY + panelHeight - 32}" ${font} font-size="13" fill="${COLORS.panelMuted}">这一周</text>
  <rect x="313" y="${panelY + panelHeight - 42}" width="11" height="11" rx="2" fill="${COLORS.future}"/>
  <text x="332" y="${panelY + panelHeight - 32}" ${font} font-size="13" fill="${COLORS.panelMuted}">还未到来</text>
  <text x="68" y="${height - 35}" ${font} font-size="13" fill="${COLORS.muted}">一生一格 · 认真过好每一周</text>
</svg>`;

  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `一生一格-${birthDate}-${endDate}.svg`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
