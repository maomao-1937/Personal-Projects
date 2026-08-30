/**
 * 风格配置 - 统一管理 8 种风格的颜色和元数据
 *
 * 风格列表：国风、职场、婚纱、日系、潮酷、复古、艺术、仙侠
 */

export interface StyleConfig {
  /** 风格唯一标识 */
  id: string;
  /** 风格名称 */
  name: string;
  /** 所属分类 */
  category: string;
  /** 主色调（十六进制） */
  primaryColor: string;
  /** 次要色调（十六进制） */
  secondaryColor: string;
  /** 背景色（十六进制） */
  bgColor: string;
  /** 文字颜色（十六进制） */
  textColor: string;
  /** 渐变背景（Tailwind gradient 类名，用于卡片背景） */
  gradient: string;
  /** 预览图占位（颜色值或 URL） */
  previewImage: string;
  /** 风格描述（可选，用于前端展示） */
  description?: string;
  /** 提示词模板（可选，用于前端展示风格描述） */
  prompt_template?: string;
}

/**
 * 8 种风格的完整配置
 */
export const styleConfigs: StyleConfig[] = [
  {
    id: 'guofeng',
    name: '国风',
    category: '国风',
    primaryColor: '#b45309',
    secondaryColor: '#7f1d1d',
    bgColor: '#451a03',
    textColor: '#fef3c7',
    gradient: 'from-amber-600/30 to-red-900/30',
    previewImage: '/style-previews/guofeng.jpg',
    description: '古典东方韵味，水墨丹青之美',
    prompt_template: '中国风，古典服饰，水墨画风格，东方美学',
  },
  {
    id: 'zhichang',
    name: '职场',
    category: '职场',
    primaryColor: '#2563eb',
    secondaryColor: '#1e293b',
    bgColor: '#0f172a',
    textColor: '#e2e8f0',
    gradient: 'from-blue-600/30 to-slate-800/30',
    previewImage: '/style-previews/zhichang.jpg',
    description: '干练专业，都市精英风范',
    prompt_template: '职业装，商务风格，都市白领，专业形象',
  },
  {
    id: 'hunsha',
    name: '婚纱',
    category: '婚纱',
    primaryColor: '#f472b6',
    secondaryColor: '#7c3aed',
    bgColor: '#fdf2f8',
    textColor: '#ffffff',
    gradient: 'from-pink-400/30 to-purple-700/30',
    previewImage: '/style-previews/hunsha.jpg',
    description: '浪漫唯美，永恒的幸福瞬间',
    prompt_template: '婚纱礼服，浪漫氛围，梦幻光影，唯美风格',
  },
  {
    id: 'rixi',
    name: '日系',
    category: '日系',
    primaryColor: '#fda4af',
    secondaryColor: '#0ea5e9',
    bgColor: '#fff1f2',
    textColor: '#4a044e',
    gradient: 'from-rose-300/30 to-sky-500/30',
    previewImage: '/style-previews/rixi.jpg',
    description: '清新自然，日系胶片质感',
    prompt_template: '日系风格，清新自然，胶片质感，柔和光影',
  },
  {
    id: 'chaoku',
    name: '潮酷',
    category: '潮酷',
    primaryColor: '#06b6d4',
    secondaryColor: '#d946ef',
    bgColor: '#083344',
    textColor: '#ecfeff',
    gradient: 'from-cyan-500/30 to-fuchsia-700/30',
    previewImage: '/style-previews/chaoku.jpg',
    description: '赛博朋克，未来科技感',
    prompt_template: '赛博朋克，霓虹灯光，未来科技，街头潮流',
  },
  {
    id: 'fugu',
    name: '复古',
    category: '复古',
    primaryColor: '#f97316',
    secondaryColor: '#92400e',
    bgColor: '#431407',
    textColor: '#ffedd5',
    gradient: 'from-orange-500/30 to-amber-800/30',
    previewImage: '/style-previews/fugu.jpg',
    description: '怀旧时光，港风黄金年代',
    prompt_template: '复古风格，80年代港风，怀旧色调，胶片颗粒',
  },
  {
    id: 'yishu',
    name: '艺术',
    category: '艺术',
    primaryColor: '#ca8a04',
    secondaryColor: '#44403c',
    bgColor: '#1c1917',
    textColor: '#fefce8',
    gradient: 'from-yellow-600/30 to-stone-700/30',
    previewImage: '/style-previews/yishu.jpg',
    description: '油画质感，艺术大师手笔',
    prompt_template: '油画风格，艺术质感，大师笔触，色彩浓郁',
  },
  {
    id: 'xianxia',
    name: '仙侠',
    category: '仙侠',
    primaryColor: '#22d3ee',
    secondaryColor: '#14b8a6',
    bgColor: '#042f2e',
    textColor: '#cffafe',
    gradient: 'from-cyan-400/30 to-teal-700/30',
    previewImage: '/style-previews/xianxia.jpg',
    description: '飘逸出尘，仙侠世界的梦幻',
    prompt_template: '仙侠风格，飘逸出尘，古风玄幻，仙气飘飘',
  },
];

/**
 * 按分类名称映射的风格配置
 */
export const styleByCategory: Record<string, StyleConfig> = styleConfigs.reduce(
  (acc, style) => {
    acc[style.category] = style;
    return acc;
  },
  {} as Record<string, StyleConfig>
);

/**
 * 按风格 ID 映射的风格配置
 */
export const styleById: Record<string, StyleConfig> = styleConfigs.reduce(
  (acc, style) => {
    acc[style.id] = style;
    return acc;
  },
  {} as Record<string, StyleConfig>
);

/**
 * 所有分类列表
 */
export const styleCategories = styleConfigs.map((s) => s.category);

/**
 * 风格渐变色（用于 Tailwind 动态类名的兼容性）
 * 保留旧的 styleColors 格式，便于迁移
 */
export const styleColors: Record<string, string> = styleConfigs.reduce(
  (acc, style) => {
    acc[style.category] = style.gradient;
    return acc;
  },
  {} as Record<string, string>
);

export default styleConfigs;
