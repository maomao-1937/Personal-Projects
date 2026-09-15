# Aragon 单图工具式重构实施计划

1. 更新产品与设计规范，移除旧漏斗定义。
2. 新建 `/access`，将旧登录/注册页面改为兼容跳转。
3. 重做首页与导航，移除公共模板目录入口。
4. 新建 `/studio` 上传优先工作台；旧 styles/create/upload 页面跳转至此。
5. 新建 `/studio/tasks/[id]` 和 `/works`；旧 result/profile/recharge 页面跳转。
6. 补 HTTPX SOCKS 运行时依赖并清理用户可见的内部生成异常。
7. 运行前后端测试和构建，真实验证桌面/移动端与完整邀请生成路径。
8. Agency UI Finish Gate 审查；集中修复一次并复查。
