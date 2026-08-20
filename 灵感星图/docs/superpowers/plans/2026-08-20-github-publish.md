# “灵感星图”改名与 GitHub 发布实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将当前应用统一命名为“灵感星图”，安全上传到 `Personal-Projects/灵感星图`，并通过 PR 合并到 `main`。

**架构：** 先在源项目完成纯命名变更和上传排除规则，再在目标仓库的短期功能分支中复制经过过滤的项目文件。验证文件范围、测试和敏感信息后，只提交新项目目录，推送并通过非草稿 PR 合并。

**技术栈：** FastAPI、Python、原生 HTML/CSS/JavaScript、pytest、Git、GitHub CLI。

---

## 文件结构

- 修改 `README.md`：产品标题和本地目录说明。
- 修改 `pyproject.toml`：Python 项目名与说明。
- 修改 `app/config.py`、`app/__init__.py`：应用元数据名称。
- 修改 `app/static/index.html`：浏览器标题、页脚和英文眉题。
- 修改 `tests/test_api.py`：锁定统一品牌文案并拒绝旧名称回归。
- 修改 `.gitignore`：排除本地临时目录和缓存。
- 创建目标仓库 `灵感星图/`：过滤后复制整个可运行项目。

### 任务 1：统一产品名称

**文件：**
- 修改：`tests/test_api.py`
- 修改：`README.md`
- 修改：`pyproject.toml`
- 修改：`app/config.py`
- 修改：`app/__init__.py`
- 修改：`app/static/index.html`

- [ ] **步骤 1：增加品牌回归断言**

在 `test_web_app_shell_and_styles_are_served` 中断言页面标题为“灵感星图”，且页面不包含“私人项目孵化箱”；另断言 `app.title == "灵感星图"`。

- [ ] **步骤 2：运行测试确认旧名称导致失败**

运行：`uv run pytest tests/test_api.py::test_web_app_shell_and_styles_are_served -q`

预期：FAIL，页面或 FastAPI 元数据仍包含旧名称。

- [ ] **步骤 3：替换产品元数据**

将 README 标题、FastAPI `app_name`、Python 包说明、HTML `<title>`、页脚和英文眉题统一到“灵感星图”品牌；将 Python 分发名改为 `inspiration-constellation`，README 启动目录改为 `灵感星图`。

- [ ] **步骤 4：运行品牌测试确认通过**

运行：`uv run pytest tests/test_api.py::test_web_app_shell_and_styles_are_served -q`

预期：PASS。

### 任务 2：准备安全上传副本

**文件：**
- 修改：`.gitignore`
- 创建：目标仓库 `灵感星图/`

- [ ] **步骤 1：补全排除规则**

在 `.gitignore` 加入 `.ruff_cache/`、`.superpowers/`、`*.pyc` 和系统临时文件，保留 `.env`、`.venv/`、`*.db`、`.vefaas/` 排除规则。

- [ ] **步骤 2：克隆并创建功能分支**

从 `maomao-1937/Personal-Projects` 最新 `main` 创建 `feat/inspiration-constellation`。

- [ ] **步骤 3：过滤复制项目**

将源项目复制到 `灵感星图/`，排除 `.env`、`.venv`、数据库、缓存、`.vefaas` 和 `.superpowers`。

- [ ] **步骤 4：扫描上传范围**

运行 `git status --short`、文件名扫描和 `rg` 密钥模式扫描；预期只有 `灵感星图/` 为新增，且不包含真实凭据和本地数据库。

### 任务 3：验证、提交、推送并合并

**文件：**
- 提交：目标仓库 `灵感星图/`

- [ ] **步骤 1：运行完整验证**

在 `灵感星图/` 运行：

```bash
uv run pytest -q
uvx ruff check app tests
uvx ruff format --check app tests
node --check app/static/app.js
uv run python -m compileall -q app
```

预期：全部退出码为 0。

- [ ] **步骤 2：只暂存新项目目录并提交**

运行：

```bash
git add -- 灵感星图
git commit -m "feat(灵感星图): 添加私人项目孵化应用"
```

- [ ] **步骤 3：推送并创建非草稿 PR**

推送 `feat/inspiration-constellation`，创建 base 为 `main` 的非草稿 PR；验证 PR 文件均位于 `灵感星图/`。

- [ ] **步骤 4：合并并核验默认分支**

使用 squash merge 合并 PR 并删除功能分支；通过 GitHub API 确认 PR 状态为 merged，且 `main` 顶层存在 `灵感星图/`。
