# Agent Blueprint —— Agent 产品需求引擎

> 给它一个 PRD、一个需求点子、或一个可落地的 Agent 方向，它推导出架构方案、组件选型与代码骨架，直到一个能在真实环境运行的产品。
>
> 推导入口：**[BLUEPRINT.md](./BLUEPRINT.md)** —— 从 PRD 到产品的五步 SOP、架构决策映射表、生产级组件库、"可落地"验收标准。
>
> 本仓库同时保留一套**组件参考实现**（`s01`~`s17`），每个组件一个可运行的 `code.py`，供落地时对照与复用。

---

## 核心模型

```
Agent = 模型（智能，已训练好） + Harness（载具，你构建的代码）
```

```
Harness = 工具 + 知识 + 观察 + 行动接口 + 权限
```

模型做决策，Harness 执行。你构建的是 Harness，不是智能。

---

## 从 PRD 到产品：五步推导

这是本引擎的核心工作流。完整方法见 **[BLUEPRINT.md](./BLUEPRINT.md)**。

```
PRD / 点子 / 方向
      │
      ▼
① 需求拆解   从 PRD 提取硬事实（目标/用户/闭环/边界/约束），缺失标注"待确认"
      │
      ▼
② 领域建模   把事实映射到 Harness 五要素（工具/知识/观察/行动/权限）
      │
      ▼
③ 组件选型   查「架构决策映射表」，只选需要的组件
      │
      ▼
④ 架构设计   产出方案：分层架构图（7层）/工具清单/系统提示词/安全边界/部署形态
      │
      ▼  （确认后再生成代码）
⑤ 代码生成   骨架 → 硬化 → 产品化
```

**原则：先方案，确认后再生成代码。**

---

## 架构决策映射表

| PRD 特征 | 选用组件 | 参考实现 |
|---|---|---|
| 需要调用外部系统/API/数据源 | 工具系统 | s02 |
| 涉及破坏性/敏感操作 | 权限系统 | s03 |
| 需要审计、拦截、埋点 | 钩子系统 | s04 |
| 多步骤、需跟踪进度 | 任务规划 | s05 |
| 上下文会爆、任务可并行 | 子 Agent | s06 |
| 领域知识库庞大 | 技能加载 | s07 |
| 长会话、日志量大 | 上下文压缩 | s08 |
| 需跨会话记住偏好/决策 | 记忆系统 | s09 |
| 目标需持久化、断点续跑 | 任务系统 | s10 |
| 有慢操作需不阻塞 | 后台任务 | s11 |
| 需定时自治触发 | 定时调度 | s12 |
| 多任务并行、需隔离工作区 | Agent 团队 | s13 |
| 需接入外部工具生态 | MCP 插件 | s14 |
| 上述机制需协同 | 集成 Harness | s15 |
| 编排形态固定 | 工作流运行时 | s16 |
| 需自动判断"何时算完成" | 目标闭环 | s17 |

---

## 生产级组件库（17 个）

每个组件一个可运行的 `code.py`，供落地时对照与复用。按功能域分组：

| 域 | 组件 | 一句话 | 参考 |
|---|---|---|---|
| 行动 | Agent Loop | 一切的基础：循环 + 工具 | s01 |
| 行动 | 工具系统 | 循环不变，工具可增 | s02 |
| 行动 | MCP 插件 | 外部工具接入同一工具池 | s14 |
| 约束 | 权限系统 | 先划边界，再给自由 | s03 |
| 约束 | 钩子系统 | 挂循环上，不写循环里 | s04 |
| 认知 | 任务规划 | 先计划后执行 | s05 |
| 认知 | 技能加载 | 用到时再加载 | s07 |
| 认知 | 记忆系统 | 记住该记的，忘掉该忘的 | s09 |
| 认知 | 目标闭环 | 目标决定循环何时停止 | s17 |
| 上下文 | 子 Agent | 全新消息列表，隔离噪声 | s06 |
| 上下文 | 上下文压缩 | 长上下文腾空间 | s08 |
| 协作 | 任务系统 | 大目标拆小任务，持久化 | s10 |
| 协作 | 后台任务 | 慢操作丢后台 | s11 |
| 协作 | 定时调度 | 到点自动触发 | s12 |
| 协作 | Agent 团队 | 队友分工协作 | s13 |
| 编排 | 集成 Harness | 多机制归一循环 | s15 |
| 编排 | 工作流运行时 | 编排形状固定就写进代码 | s16 |

完整说明（含生产级要点）见 **[BLUEPRINT.md](./BLUEPRINT.md) 第五节**。

---

## 核心模式

```python
def agent_loop(messages):
    while True:
        response = client.messages.create(
            model=MODEL, system=SYSTEM,
            messages=messages, tools=TOOLS,
        )
        messages.append({"role": "assistant",
                         "content": response.content})

        tool_calls = [
            block for block in response.content if block.type == "tool_use"
        ]
        if not tool_calls:
            return

        results = []
        for block in tool_calls:
            output = TOOL_HANDLERS[block.name](**block.input)
            results.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": output,
            })
        messages.append({"role": "user", "content": results})
```

循环属于 Agent，机制属于 Harness。这个循环是常量；工具、知识、权限随领域而变。

---

## 快速开始

> 要求 Python 3.10+，仅支持 macOS / Linux（部分组件依赖 `fcntl` 等 Unix 特性）。

```sh
cd agent-blueprint
pip install -r requirements.txt
cp .env.example .env   # 配置 ANTHROPIC_API_KEY 与 MODEL_ID

python s01_agent_loop/code.py        # 最小 agent loop
python s15_integrated_harness/code.py  # 集成 harness 参考
python s17_goal_loop/code.py         # 目标闭环
```

**从 PRD 推导产品**：把 [BLUEPRINT.md](./BLUEPRINT.md)（或相关章节）连同你的 PRD 一起交给 AI，要求按五步 SOP 推导，并遵守"先方案后代码"。

---

## 项目结构

```
agent-blueprint/
  BLUEPRINT.md                     # 核心蓝图 + PRD 推导 SOP
  s01_agent_loop/                  # 组件参考实现，每个文件夹：
    README.md                      #   组件说明
    code.py                        #   独立可运行代码
    images/                        #   架构图
  s02_tool_use/
  ...
  s17_goal_loop/
  scaffold/                        # 生产级项目模板（见 scaffold/）
  skills/                          # 领域技能（agent-builder 等）
  tests/                           # 测试
```

---

## 许可证

MIT
