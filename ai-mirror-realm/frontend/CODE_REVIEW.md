# AI 镜界 - 前端代码评审报告

> 评审范围：Next.js 14 App Router 前端全部代码
> 评审日期：2026-08-30
> 优先级：Critical > High > Medium > Low

---

## 一、Bugs 汇总

### Critical（严重）

#### 1. RootLayout 标记为 'use client' 导致全应用 CSR
- **文件**：`src/app/layout.tsx` 第 1 行
- **问题**：Next.js App Router 的根 layout 默认是 Server Component，加上 `'use client'` 后整个应用所有页面都会变成 Client Component，完全失去 SSR/SSG 的性能优势和 SEO 能力。`usePathname()` 的使用进一步强制了客户端渲染。
- **修复**：将 Navbar 和页面动画部分抽离为独立的 Client Component（如 `Providers.tsx`），layout.tsx 保持为 Server Component。`usePathname()` 需要包裹在 Suspense 边界中。

```tsx
// src/app/layout.tsx - 应改为 Server Component
import './globals.css';
import { Providers } from './providers'; // Client Component

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

#### 2. 路由守卫在渲染阶段执行，会导致闪烁和 React 警告
- **文件**：`src/app/upload/page.tsx` 第 21-24 行
- **问题**：`if (!user) { router.push('/login'); return null; }` 在组件渲染阶段直接调用 `router.push()`，在 React 18 Strict Mode 下会执行两次，且页面会先渲染再跳转，产生闪烁。同样的问题存在于 `styles/page.tsx`、`result/page.tsx`、`profile/page.tsx`。
- **修复**：将登录检查移入 `useEffect`，或使用 Next.js Middleware 在服务端做路由守卫。

```tsx
useEffect(() => {
  if (!authLoading && !user) router.push('/login');
}, [authLoading, user, router]);

if (authLoading) return <LoadingSkeleton />;
if (!user) return null; // 由 useEffect 处理跳转
```

#### 3. 401 拦截器硬跳转与 Auth Context 状态不同步
- **文件**：`src/lib/api.ts` 第 19-24 行
- **问题**：401 拦截器使用 `window.location.href = '/login'` 硬跳转，直接清除 localStorage，但没有通知 AuthContext 更新 `user` 状态。如果页面在跳转前有其他 state 更新，可能导致不一致。另外 `window.location.href` 会触发整页刷新，丢失所有应用状态。
- **修复**：在拦截器中触发一个全局事件或使用 router，让 AuthProvider 统一处理登出逻辑。更好的方案是使用 axios 的 interceptor 结合 React context（需要通过事件总线或 ref 模式）。

#### 4. Result 页面轮询缺少清理函数，存在内存泄漏
- **文件**：`src/app/result/page.tsx` 第 28-40 行
- **问题**：`setTimeout(poll, 2000)` 递归调用但没有清理机制。当用户离开页面或组件卸载时，轮询仍在后台继续，导致内存泄漏和不必要的 API 请求。
- **修复**：使用 AbortController + 标记变量或 useRef 追踪卸载状态。

```tsx
useEffect(() => {
  let cancelled = false;
  const poll = async () => {
    if (cancelled) return;
    try {
      const res = await api.get(`/portraits/${portraitId}/status`);
      if (cancelled) return;
      setTask(res.data);
      if (res.data.status === 'pending' || res.data.status === 'processing') {
        setTimeout(poll, 2000);
      } else {
        setLoading(false);
      }
    } catch {
      if (!cancelled) setLoading(false);
    }
  };
  poll();
  return () => { cancelled = true; };
}, [portraitId, user]);
```

### High（高优先级）

#### 5. 首页风格加载失败静默吞错
- **文件**：`src/app/page.tsx` 第 31 行
- **问题**：`.catch(() => {})` 完全吞掉了错误，用户看不到任何提示。如果接口挂了，"风格画廊"区域就是空白，用户不知道发生了什么。
- **修复**：添加错误状态和用户可见的错误提示，或至少显示一个"加载失败，点击重试"的 UI。

#### 6. Styles 页面风格加载失败无错误处理
- **文件**：`src/app/styles/page.tsx` 第 43-47 行
- **问题**：只有 `.finally()` 没有 `.catch()`，请求失败时 loading 结束但 styles 为空数组，页面显示空白网格区域，用户无感知。
- **修复**：添加 error state 和重试按钮。

#### 7. 分享按钮 URL 拼接逻辑错误
- **文件**：`src/app/result/page.tsx` 第 147 行
- **问题**：`navigator.clipboard.writeText(window.location.origin + task.result_url)` - 如果 `task.result_url` 已经是完整 URL（含 https://），拼接结果会变成 `https://domain.comhttps://cdn.com/image.jpg`，完全错误。如果是相对路径 `/generated/xxx.jpg`，origin + 路径是对的，但两种情况都需要判断。
- **修复**：判断 URL 是否为绝对路径，或直接使用 `task.result_url`（通常后端返回完整 URL）。

#### 8. 注册页面缺少密码确认和邮箱格式校验
- **文件**：`src/app/register/page.tsx`
- **问题**：没有"确认密码"字段，用户输错密码无法察觉。邮箱只有 `type="email"` 的原生校验，没有自定义格式验证。
- **修复**：添加确认密码字段和匹配校验，使用 zod 或自定义函数校验邮箱格式。

### Medium（中优先级）

#### 9. Navbar 中直接 push 修改 navItems 数组
- **文件**：`src/components/Navbar.tsx` 第 17-19 行
- **问题**：`navItems.push(...)` 直接修改了组件函数内定义的数组。虽然每次渲染都会重新创建，但这是不好的实践，应该用条件渲染或展开运算符。
- **修复**：使用条件渲染或在定义时就包含所有项，通过 user 状态控制显示。

#### 10. 上传页面 sessionStorage 跨标签页不共享
- **文件**：`src/app/upload/page.tsx` 第 69 行
- **问题**：用 `sessionStorage` 存储 `selfieUrl`，如果用户在新标签页打开风格页或刷新后重新进入，数据丢失，用户需要重新上传。
- **修复**：考虑用 `localStorage` 或存在后端（与用户账户关联），设置合理的过期时间。

#### 11. Profile 页面删除使用原生 confirm
- **文件**：`src/app/profile/page.tsx` 第 34 行
- **问题**：`confirm()` 使用浏览器原生对话框，与整体设计风格脱节，且移动端体验差。
- **修复**：封装自定义 Modal 组件替代原生 confirm/alert。

#### 12. Upload 页面手动设置 Content-Type 可能导致 boundary 丢失
- **文件**：`src/app/upload/page.tsx` 第 57 行
- **问题**：手动设置 `'Content-Type': 'multipart/form-data'` 会覆盖浏览器自动设置的 boundary。浏览器在发送 FormData 时会自动设置带 boundary 的 Content-Type，手动设置会丢失 boundary 信息，导致后端解析失败。
- **修复**：移除手动设置的 Content-Type header，让浏览器自动处理。

### Low（低优先级）

#### 13. 登录/注册页面多余的 Ctrl+A 处理
- **文件**：`src/app/login/page.tsx` 第 64-68 行、`src/app/register/page.tsx` 第 76-78、94-96 行
- **问题**：input 元素默认就支持 Ctrl+A 全选，这段代码完全多余。
- **修复**：删除所有 `onKeyDown` 的 Ctrl+A 处理。

---

## 二、UX 问题

### Critical

#### 1. 缺少统一的 Toast / 通知系统
- **问题**：错误提示方式不统一——有的用 `alert()`（styles 页面生成失败），有的用行内文字，有的静默失败。alert 弹窗体验极差，阻塞用户操作。
- **建议**：引入 `react-hot-toast` 或 `sonner` 等轻量 toast 库，统一所有通知。

#### 2. 缺少服务端路由守卫，登录页闪烁
- **问题**：所有受保护页面（upload/styles/result/profile）都在客户端检查登录状态，页面加载时会先显示空白或内容再跳转，产生明显的闪烁。
- **建议**：使用 Next.js Middleware 在服务端判断 token 并重定向，完全避免客户端闪烁。

#### 3. 无障碍（a11y）严重缺失
- **表单 label 未关联**：所有 input 的 label 没有 `htmlFor` 和对应 `id`，屏幕阅读器无法识别。
- **无 focus-visible 样式**：键盘导航用户看不到当前焦点位置。
- **图片 alt 文本无意义**：如 `alt="preview"`、`alt={p.id}` 对屏幕阅读器用户没有帮助。
- **按钮缺少 aria-label**：图标按钮（如删除按钮、关闭按钮）没有文字说明。
- **颜色对比度不足**：`text-dim #8888a0` 在 `#0a0a0f` 背景上对比度约 4.5:1，刚好达标但在小字体上可能有问题。

### High

#### 4. 上传无进度指示
- **文件**：`src/app/upload/page.tsx`
- **问题**：只有"上传中..."文字，没有进度条。对于 10MB 的图片，用户不知道上传了多少、还需要多久。
- **建议**：使用 axios 的 `onUploadProgress` 实现进度条。

#### 5. 生成任务无超时处理
- **文件**：`src/app/result/page.tsx`
- **问题**：轮询无限进行，如果任务一直卡在 processing 状态，用户会永远看到加载动画。
- **建议**：设置最大轮询次数或超时时间（如 5 分钟），超时后显示失败提示和重试按钮。

#### 6. 移动端 Navbar 溢出
- **文件**：`src/components/Navbar.tsx`
- **问题**：小屏幕上导航项 + 登录/注册按钮 + Logo 可能溢出，没有汉堡菜单或响应式折叠。
- **建议**：移动端使用汉堡菜单折叠导航项。

#### 7. 图片无懒加载
- **文件**：`src/app/profile/page.tsx` 等
- **问题**：所有图片都用原生 `<img>`，没有懒加载，profile 页面写真多时首屏加载慢。
- **建议**：使用 `next/image` 或至少加 `loading="lazy"`。

### Medium

#### 8. 首页风格画廊加载失败时空白
- **文件**：`src/app/page.tsx`
- **问题**：接口失败时"风格画廊"区域就是空白，没有任何错误提示或重试按钮。

#### 9. 分享功能体验差
- **文件**：`src/app/result/page.tsx`
- **问题**：`navigator.share` 在桌面浏览器兼容性差，回退用 `alert('链接已复制')` 体验粗糙。应显示一个自定义的复制成功提示。

#### 10. 图片下载无进度和状态反馈
- **问题**：点击下载后浏览器原生处理，用户可能以为没反应（特别是大图片）。
- **建议**：添加下载中状态，完成后给个提示。

---

## 三、缺失功能 / Missing Pieces

### Critical

#### 1. 缺少 middleware.ts 路由守卫
- **问题**：每个页面重复实现登录检查，代码冗余，且有闪烁问题。
- **建议**：创建 `middleware.ts` 在服务端校验 token，保护 `/upload`、`/styles`、`/result`、`/profile` 等路由。

#### 2. 缺少全局 Error Boundary
- **问题**：任何组件的运行时错误都会导致整个应用白屏。
- **建议**：实现全局 Error Boundary，并为关键路由添加 `error.tsx`。

#### 3. 缺少 not-found.tsx 404 页面
- **问题**：访问不存在的路由显示 Next.js 默认 404 页面，与应用风格脱节。

#### 4. next.config.js 缺少 images 配置
- **问题**：无法使用 `next/image` 组件（远程图片需要配置 remotePatterns）。
- **建议**：添加 images.remotePatterns 配置 CDN 域名。

### High

#### 5. 缺少 loading.tsx 页面级加载状态
- **问题**：页面切换时只有 framer-motion 的淡入淡出，没有内容级别的骨架屏。
- **建议**：为每个路由添加 `loading.tsx`，或使用 Suspense 边界。

#### 6. 缺少环境变量管理
- **问题**：API base URL 硬编码为 `/api`，通过 rewrites 代理到 `localhost:8000`，生产环境无法直接使用。
- **建议**：使用 `.env.local` 和 `NEXT_PUBLIC_API_BASE_URL` 环境变量。

#### 7. 缺少表单验证
- **问题**：登录/注册表单只有最基本的 required 校验，没有邮箱格式、密码强度、手机号格式等验证。
- **建议**：引入 `zod` + `react-hook-form` 做表单验证。

#### 8. 缺少统一的 Skeleton 骨架屏组件
- **问题**：各页面自己写 shimmer 骨架，样式不统一，代码重复。

### Medium

#### 9. Profile 页面无分页 / 无限滚动
- **问题**：一次性加载所有写真，数据多时性能差。

#### 10. 缺少图片大图预览
- **问题**：点击 profile 中的写真缩略图不能放大查看详情。

#### 11. 缺少积分不足提示和充值入口
- **问题**：用户积分用完后点击生成只会报错，没有提前提示积分不足，也没有充值入口。

#### 12. 缺少生成历史状态实时更新
- **问题**：profile 页面的"生成中"写真不会自动刷新状态，用户需要手动刷新页面。

---

## 四、设计系统缺口

### High

#### 1. styleColors 映射重复定义
- **文件**：`src/app/page.tsx` 第 17-25 行 和 `src/app/styles/page.tsx` 第 10-18 行
- **问题**：两个页面定义了完全相同的 `styleColors` 对象，违反 DRY 原则。新增风格类别时需要改两处。
- **建议**：抽离到 `src/constants/styles.ts` 统一管理。

#### 2. 缺少基础组件库
- **Button**：各处按钮样式手写，大小、圆角、间距不统一
- **Input**：登录/注册/上传页面的 input 样式重复
- **Card**：glass 卡片样式分散
- **Modal**：没有统一的模态框组件
- **建议**：建立 `src/components/ui/` 目录，封装 Button、Input、Card、Modal 等基础组件。

#### 3. CSS 变量与 Tailwind 配置重复
- **问题**：`globals.css` 中定义了 `--bg-primary` 等 CSS 变量，`tailwind.config.ts` 中又定义了 `bg.primary` 等。两套系统并存，有的地方用 `bg-bg-secondary`（Tailwind），有的地方用 `border-[var(--border)]`（CSS 变量），不一致。
- **建议**：统一使用 Tailwind 的 theme 配置，CSS 变量仅用于需要运行时动态修改的值。

#### 4. 间距和排版不统一
- 页面顶部 padding：有的 `pt-16`，有的 `pt-24`
- section padding：有的 `py-24`，有的 `py-20`
- 图标大小：14/16/18/20/24/28 各种尺寸，没有统一规范
- 圆角：有的 `rounded-xl`，有的 `rounded-2xl`，有的 `rounded-3xl`

### Medium

#### 5. 缺少 Design Token 文档
- **问题**：颜色、间距、字体、圆角等设计值没有文档化，新人上手困难。

#### 6. 动画规范不统一
- framer-motion 的 transition 时长和缓动函数各处不统一（0.4s / 0.6s / 2s 等）。
- 建议定义统一的 motion preset。

---

## 五、性能问题

### High

#### 1. 全部使用原生 img，无图片优化
- **问题**：所有图片都用 `<img>` 标签，没有：
  - 自动格式转换（WebP/AVIF）
  - 响应式尺寸（srcset/sizes）
  - 懒加载
  - 优先级提示
- **建议**：全面迁移到 `next/image`，配置好 remotePatterns。

#### 2. RootLayout 为 Client Component 失去 SSR
- **问题**：如 Bug #1 所述，整个应用都是 CSR，首屏性能差，SEO 差。
- **建议**：重构为 Server Component + Client Component 混合模式。

#### 3. 首页数据无缓存
- **文件**：`src/app/page.tsx`
- **问题**：风格列表数据每次进入首页都重新请求，这些数据变化频率低，可以缓存。
- **建议**：使用 SWR 或 React Query 做数据缓存和重验证。

### Medium

#### 4. 缺少字体优化
- **问题**：没有使用 `next/font` 优化字体加载，可能导致 FOIT/FOUT。
- **建议**：使用 `next/font/google` 或 `next/font/local` 加载字体。

#### 5. framer-motion 包体积较大
- **问题**：framer-motion 是一个较大的库（~40KB gzipped），如果动画使用不多可以考虑更轻量的方案。
- **建议**：评估动画必要性，或使用 `motion` 的懒加载。

#### 6. 图片上传前未压缩
- **问题**：用户上传 10MB 的原图直接传到服务器，浪费带宽和存储。
- **建议**：前端先做图片压缩（如 canvas 压缩或使用 `browser-image-compression`），再上传。

### Low

#### 7. 首页动画过多可能影响低端设备
- **问题**：首页有大量 whileInView 动画 + glow 模糊效果，低端移动设备可能卡顿。
- **建议**：使用 `prefers-reduced-motion` 媒体查询尊重用户系统设置。

---

## 六、代码质量问题

### High

#### 1. 类型安全不足
- 大量使用 `any` 类型（`styles: any[]`、`task: any`、`portraits: any[]`）
- API 响应没有 TypeScript 接口定义
- **建议**：定义完整的 TypeScript 类型，启用 `strict: true`

#### 2. 错误处理不统一
- 有的用 try/catch，有的用 .catch()
- 有的设置 error state，有的 alert，有的静默
- **建议**：封装 useApi hook，统一处理 loading、error、success 状态

#### 3. 组件职责过重
- 每个页面组件都包含了数据获取、状态管理、UI 渲染，耦合度高
- **建议**：抽离自定义 hooks（如 `useStyles`、`usePortrait`、`useUpload`）

### Medium

#### 4. 缺少 ESLint 配置检查
- package.json 中有 lint script 但没有看到 ESLint 配置文件
- **建议**：配置 ESLint + Prettier，启用 Next.js 推荐规则

#### 5. 缺少测试
- 没有任何测试文件
- **建议**：至少为关键流程（登录、上传、生成）添加单元测试和 E2E 测试

---

## 七、优先级修复建议路线图

### 第一阶段（Critical - 立即修复）
1. 修复 RootLayout SSR 问题，拆分 Providers
2. 修复路由守卫闪烁，添加 middleware.ts
3. 修复 result 页面轮询内存泄漏
4. 修复 401 拦截器与 Auth 状态同步问题
5. 修复 upload 页面 Content-Type 手动设置问题

### 第二阶段（High - 本周内）
6. 添加全局 Toast 通知系统
7. 统一错误处理，替换所有 alert
8. 添加 next/image 配置并迁移图片组件
9. 修复分享 URL 拼接 bug
10. 添加 Error Boundary 和 not-found 页面
11. 修复首页和 styles 页加载失败无提示的问题
12. 添加注册页面密码确认和表单验证

### 第三阶段（Medium - 本月内）
13. 抽离 styleColors 等共享常量
14. 封装基础 UI 组件（Button, Input, Card, Modal）
15. 添加环境变量管理
16. 实现上传进度条
17. 添加生成超时处理
18. 移动端响应式优化（汉堡菜单）
19. Profile 页面分页/无限滚动

### 第四阶段（Low - 持续优化）
20. 字体优化（next/font）
21. 图片上传前压缩
22. 减少动画 prefers-reduced-motion
23. 完善 TypeScript 类型
24. 添加测试
25. 设计系统文档化

---

## 八、总体评价

**整体评分：6.5 / 10**

**优点：**
- 视觉设计统一，暗色主题 + 玻璃态风格符合 AI 产品调性
- 交互动画细腻，framer-motion 使用得当
- 页面流程清晰，用户路径明确
- 代码结构基本合理，App Router 使用正确

**主要短板：**
- 架构层面：RootLayout 全 CSR 是最大硬伤，严重影响性能和 SEO
- 工程化：缺少基础组件库、类型定义、测试、lint 规范
- UX：无障碍缺失严重，错误处理粗糙，缺少 toast/modal 等基础反馈
- 安全性：token 存在 localStorage 易受 XSS 攻击（建议 httpOnly cookie）

建议优先修复 Critical 级别的架构和 Bug 问题，再逐步补齐 UX 和工程化短板。
