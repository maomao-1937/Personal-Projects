export function readImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return Promise.reject(new Error('请选择 JPG、PNG 或 WebP 图片。'));
  if (file.size > 10 * 1024 * 1024) return Promise.reject(new Error('图片超过 10 MB，请换一张较小的照片。'));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('无法读取文件，请重新选择。'));
    reader.onload = () => {
      const data = String(reader.result); const img = new Image();
      img.onerror = () => reject(new Error('文件无法作为图片打开，请重新导出后上传。'));
      img.onload = () => img.naturalWidth * img.naturalHeight > 40_000_000 ? reject(new Error('图片超过 4000 万像素，请缩小后上传。')) : resolve(data);
      img.src = data;
    };
    reader.readAsDataURL(file);
  });
}
export function downloadData(data: string, filename: string) {
  // Blob URLs also work for large model outputs, without a multi-megabyte link URL.
  let href = data;
  if (data.startsWith('data:')) {
    const comma = data.indexOf(','); const header = data.slice(5, comma);
    const bytes = Uint8Array.from(atob(data.slice(comma + 1)), c => c.charCodeAt(0));
    href = URL.createObjectURL(new Blob([bytes], { type: header.split(';')[0] }));
  }
  const a = document.createElement('a'); a.href = href; a.download = filename;
  document.body.append(a); a.click(); a.remove();
  if (href !== data) setTimeout(() => URL.revokeObjectURL(href), 1000);
}
export function downloadJSON(value: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  downloadData(url, filename); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
