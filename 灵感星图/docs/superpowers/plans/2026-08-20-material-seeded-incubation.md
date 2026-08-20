# 核心素材驱动的方案生成实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 用素材星库单选器替代自由文本项目方向，并保证所选素材作为 AI 生成方案的核心起点。

**架构：** 前端维护一个 `selectedSeedMaterialId`，只允许选择一条已分析素材，并将该 ID 发送到 `/incubations`。后端验证素材所有权和状态，检索器将核心素材固定在候选集首位，再按内容相关度排列其余素材并用剩余可用素材补足，模型提示明确要求围绕核心素材生成。

**技术栈：** FastAPI、Pydantic、SQLAlchemy、原生 HTML/CSS/JavaScript、pytest、Playwright、veFaaS。

---

## 文件结构

- 修改 `app/domain.py`：为 `IncubationRequest` 增加必填核心素材 ID。
- 修改 `app/retrieval.py`：实现保证包含核心素材的候选排序。
- 修改 `app/workflow.py`：验证核心素材、构造内部查询并编排生成。
- 修改 `app/main.py`：把核心素材错误映射为明确 HTTP 状态。
- 修改 `app/model_gateway.py`：在 AI 提示中强调核心素材及引用要求。
- 修改 `app/static/index.html`：替换首页标题、说明和项目方向输入框。
- 修改 `app/static/app.js`：渲染下拉列表、维护选择状态并提交素材 ID。
- 修改 `app/static/styles.css`：实现原位下拉选择器和响应式样式。
- 修改 `tests/test_retrieval.py`、`tests/test_workflow.py`、`tests/test_api.py`、`tests/test_model_gateway.py`、`tests/ui_smoke.py`：覆盖后端、接口和浏览器交互。

### 任务 1：核心素材后端数据流

**文件：**
- 修改：`tests/test_retrieval.py`
- 修改：`tests/test_workflow.py`
- 修改：`app/domain.py`
- 修改：`app/retrieval.py`
- 修改：`app/workflow.py`
- 修改：`app/main.py`

- [ ] **步骤 1：编写失败测试**

```python
def test_search_from_seed_keeps_seed_first_and_fills_other_ready_materials(
    repository, material_factory
) -> None:
    seed = repository.add_material(material_factory(summary="家庭露营装备容易遗漏"))
    related = repository.add_material(material_factory(summary="家庭露营角色分工"))
    unrelated = repository.add_material(material_factory(summary="收藏文章不回看"))

    results = MaterialRetriever(repository).search_from_seed("user-a", seed, limit=3)

    assert [item.id for item in results] == [seed.id, related.id, unrelated.id]
```

工作流测试使用 `IncubationRequest(seed_material_id=seed.id)`，并断言传给模型的第一条素材就是核心素材；另写不存在素材与非 ready 素材的错误测试。

- [ ] **步骤 2：运行测试确认失败**

运行：`.venv/bin/pytest -q tests/test_retrieval.py tests/test_workflow.py`

预期：FAIL，`IncubationRequest` 尚无 `seed_material_id`，检索器尚无 `search_from_seed`。

- [ ] **步骤 3：实现最少后端逻辑**

```python
class IncubationRequest(DomainModel):
    seed_material_id: UUID
    query: str = Field(default="给我一个周末项目", min_length=1, max_length=500)
    constraints: IncubationConstraints = Field(default_factory=IncubationConstraints)
```

`search_from_seed()` 获取同用户全部 ready 素材，排除核心素材后按与核心素材文本的 token 交集降序排列，再返回 `[seed, *others[:limit - 1]]`。工作流通过 `repository.get_material()` 验证核心素材，并把请求的内部 query 更新为核心素材标题和摘要。

- [ ] **步骤 4：运行后端测试确认通过**

运行：`.venv/bin/pytest -q tests/test_retrieval.py tests/test_workflow.py`

预期：全部 PASS。

### 任务 2：模型约束和 API 行为

**文件：**
- 修改：`tests/test_model_gateway.py`
- 修改：`tests/test_api.py`
- 修改：`app/model_gateway.py`
- 修改：`app/main.py`

- [ ] **步骤 1：编写失败测试**

API 流程测试创建两条素材后提交：

```python
response = await client.post(
    "/incubations",
    headers=headers,
    json={"seed_material_id": first_material_id},
)
assert response.status_code == 201
assert first_material_id in {
    item["material_id"] for item in response.json()["source_contributions"]
}
```

模型网关测试断言提示包含 `seed_material_id` 和“primary anchor”约束；接口错误测试断言未知核心素材返回 404，未完成素材返回 400。

- [ ] **步骤 2：运行测试确认失败**

运行：`.venv/bin/pytest -q tests/test_api.py tests/test_model_gateway.py`

预期：FAIL，接口尚未接收核心素材 ID，模型提示尚未强调核心素材。

- [ ] **步骤 3：实现 API 与提示约束**

在两个真实模型网关的生成提示中加入：

```text
Treat seed_material_id as the primary anchor. A ready result must cite the seed and at least one other supplied material.
```

在 `app/main.py` 中将核心素材不存在映射为 404，将状态不可用映射为 400。

- [ ] **步骤 4：运行接口与模型测试确认通过**

运行：`.venv/bin/pytest -q tests/test_api.py tests/test_model_gateway.py`

预期：全部 PASS。

### 任务 3：首页文案和原位素材选择器

**文件：**
- 修改：`tests/test_api.py`
- 修改：`app/static/index.html`
- 修改：`app/static/app.js`
- 修改：`app/static/styles.css`

- [ ] **步骤 1：编写失败的静态页面测试**

测试首页只出现一次“散落的念头、网页和问题存进来。”，不存在 `projectQuery`，并存在 `projectSeedButton`、`projectSeedList`、`projectSeedHint`。

- [ ] **步骤 2：运行静态页面测试确认失败**

运行：`.venv/bin/pytest -q tests/test_api.py::test_homepage_uses_material_seed_picker`

预期：FAIL，页面仍包含自由文本输入框。

- [ ] **步骤 3：实现 HTML 与状态渲染**

选择器使用按钮和 listbox：

```html
<button id="projectSeedButton" type="button" aria-expanded="false" aria-controls="projectSeedList">
  <span id="projectSeedLabel">从素材星库选择</span>
</button>
<div id="projectSeedList" role="listbox" hidden></div>
<p id="projectSeedHint">先选择一条核心素材</p>
```

`renderSeedPicker()` 只渲染 ready 素材并控制生成按钮状态；选择选项后更新 `selectedSeedMaterialId`。表单提交体改为 `seed_material_id`、`available_days` 和 `budget`。

- [ ] **步骤 4：实现 CSS 与键盘关闭逻辑**

下拉层与选择框同宽、最大高度 320px、内部滚动；点击外部或 Escape 关闭。手机媒体查询保持单列且不产生横向溢出。

- [ ] **步骤 5：运行静态测试确认通过**

运行：`.venv/bin/pytest -q tests/test_api.py::test_homepage_uses_material_seed_picker`

预期：PASS。

### 任务 4：浏览器验收、完整验证与部署

**文件：**
- 修改：`tests/ui_smoke.py`
- 发布：当前项目运行文件

- [ ] **步骤 1：更新浏览器冒烟测试**

登录后断言生成按钮初始禁用；加载三条示例素材，打开选择器，选择第一条，断言按钮启用并生成方案；桌面和手机均断言无横向溢出。

- [ ] **步骤 2：运行完整验证**

运行：`.venv/bin/pytest -q && uvx ruff check app tests && uvx ruff format --check app tests && node --check app/static/app.js && docker build -t inspiration-constellation:material-seed .`

预期：全部退出码为 0；Playwright 冒烟测试无断言或控制台错误。

- [ ] **步骤 3：备份 4 条线上素材并发布现有 veFaaS 应用**

先从 `/materials` 下载备份并验证数量，再运行：

`vefaas deploy --command "python -m uvicorn app.main:app --host 0.0.0.0 --port 8000" --port 8000 --yes`

- [ ] **步骤 4：恢复素材并在线复核**

仅当部署后素材为空时逐条恢复，POST 不使用自动重试。在线浏览器选择一条素材生成方案，确认返回结果引用核心素材，首页文案只出现一次，页面无自由文本项目方向输入框。
