/**
 * CASE-001 的客户端索引。
 * 固定真相、谎言映射与评分只保存在 FastAPI 后端，避免把答案打进浏览器产物。
 * 页面通过这里统一引用路由和本地存储键，不复制服务端业务规则。
 */
export const CASE_001_CLIENT = {
  id: "001",
  code: "CASE-001",
  routes: {
    briefing: "/case/001/briefing",
    interrogate: "/case/001/interrogate",
    report: "/case/001/report",
    result: "/case/001/result",
  },
} as const;
