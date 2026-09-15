export interface StyleConfig {
  id: string;
  name: string;
  category: string;
  previewImage: string;
  description: string;
}

/**
 * 本地图片只用于公开浏览在服务暂不可用时的降级展示。
 * 这些 slug 不能作为创建任务的 style_id 提交。
 */
export const styleConfigs: StyleConfig[] = [
  { id: 'guofeng', name: '国风雅韵', category: '国风', previewImage: '/style-previews/guofeng.jpg', description: '古典中式美学，襦裙金饰，工笔意境' },
  { id: 'zhichang', name: '职场精英', category: '职场', previewImage: '/style-previews/zhichang.jpg', description: '干练职业装，都市写字楼，杂志封面质感' },
  { id: 'hunsha', name: '婚纱梦境', category: '婚纱', previewImage: '/style-previews/hunsha.jpg', description: '白色婚纱，浪漫花海，黄金时刻' },
  { id: 'rixi', name: '日系清新', category: '日系', previewImage: '/style-previews/rixi.jpg', description: '樱花和服，清新文艺，胶片质感' },
  { id: 'chaoku', name: '赛博朋克', category: '潮酷', previewImage: '/style-previews/chaoku.jpg', description: '霓虹未来感，机能风潮服，科幻都市' },
  { id: 'fugu', name: '复古港风', category: '复古', previewImage: '/style-previews/fugu.jpg', description: '90 年代港风，胶片质感，电影色调' },
  { id: 'yishu', name: '油画质感', category: '艺术', previewImage: '/style-previews/yishu.jpg', description: '古典油画风格，明暗光影，画布质感' },
  { id: 'xianxia', name: '仙侠幻境', category: '仙侠', previewImage: '/style-previews/xianxia.jpg', description: '飘逸仙气，云雾山境，东方幻想' },
];

export const styleById = Object.fromEntries(styleConfigs.map((style) => [style.id, style]));
export const styleByCategory = Object.fromEntries(styleConfigs.map((style) => [style.category, style]));
export const styleCategories = styleConfigs.map((style) => style.category);

export function resolvePreviewUrl(previewUrl?: string | null, category?: string) {
  return previewUrl || (category ? styleByCategory[category]?.previewImage : undefined) || '';
}

export default styleConfigs;
