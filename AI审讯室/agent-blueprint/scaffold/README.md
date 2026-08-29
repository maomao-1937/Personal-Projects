# Scaffold — 生产级 Agent 项目模板

从本模板开始构建你的 Agent 产品。这是**生产级骨架**（第五步的第一层"骨架"），比组件参考实现多出了：配置外置、结构化日志、重试与超时、工具注册表与 schema 校验、权限检查点、安全路径、轨迹数据采集。

## 文件说明

```
scaffold/
  agent.py            # 生产级骨架：loop + 工具注册表 + 权限 + 日志 + 轨迹采集
  config.example.yaml # 声明式配置示例（模型、超时、权限规则）
  .env.example        # 密钥与连接配置
  requirements.txt    # 依赖
```

## 使用方法

```sh
cd scaffold
pip install -r requirements.txt
cp .env.example .env            # 填入 ANTHROPIC_API_KEY
cp config.example.yaml config.yaml  # 按需调整

python agent.py
```

## 如何从本模板构建你的产品

1. **改工具**：在 `TOOL_SPECS` 里注册你的领域工具（名称 / 描述 / schema / 处理器）。
2. **改系统提示词**：在 `SYSTEM_PROMPT` 里写入身份、规则、知识目录。
3. **改权限**：在 `permission_check()` 里定义审批/拒绝规则。
4. **硬化**：按需加入重试、超时、上下文压缩、记忆、任务系统（参考 `s01`–`s17` 与 `BLUEPRINT.md`）。

## 从 PRD 推导时

把 `BLUEPRINT.md`（或相关章节）连同 PRD 交给 AI，要求按五步 SOP 推导，产出架构方案后再基于本模板生成代码。
