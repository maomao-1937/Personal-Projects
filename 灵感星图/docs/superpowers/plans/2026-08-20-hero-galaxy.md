# 首页银核银河实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [x]`）语法来跟踪进度。

**目标：** 将首页右侧黑洞替换为 B 方案「银核星盘」，并让双翼光弧以 48 秒周期独立旋转。

**架构：** 保留现有首页装饰容器的定位和响应式边界，仅替换内部语义化装饰层与对应 CSS。银河核心、星尘盘和双翼光弧分别使用独立元素及伪元素，以 CSS 渐变和 transform 动画完成，不增加运行时 JavaScript 或外部资源。

**技术栈：** HTML5、CSS3 渐变与动画、FastAPI 静态资源测试、Playwright UI 冒烟测试、veFaaS。

---

## 文件结构

- 修改 `app/static/index.html`：将旧黑洞装饰层替换为银核银河的结构。
- 修改 `app/static/styles.css`：实现银河核心、星盘、双翼光弧、48 秒半速动画和响应式降级。
- 修改 `tests/test_api.py`：添加静态结构与动画参数的回归测试。
- 使用 `tests/ui_smoke.py`：验证页面主要交互未受装饰改动影响。

### 任务 1：锁定银河结构和动效约束

**文件：**
- 修改：`tests/test_api.py`
- 测试：`tests/test_api.py`

- [x] **步骤 1：编写失败的静态资源测试**

```python
def test_homepage_uses_silver_core_galaxy_with_half_speed_wings() -> None:
    app = create_app(
        database_url="sqlite+pysqlite:///:memory:",
        model_gateway=HeuristicModelGateway(),
        api_token="test-secret",
    )

    async def scenario() -> None:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            page = await client.get("/")
            styles = await client.get("/assets/styles.css")
            assert 'class="hero-galaxy"' in page.text
            assert 'class="galaxy-core"' in page.text
            assert 'class="galaxy-wing galaxy-wing-a"' in page.text
            assert 'class="galaxy-wing galaxy-wing-b"' in page.text
            assert 'class="black-hole"' not in page.text
            assert "animation: galaxy-wing-spin 48s linear infinite" in styles.text
            assert "@media (prefers-reduced-motion: reduce)" in styles.text

    asyncio.run(scenario())
```

- [x] **步骤 2：运行测试并确认因新结构不存在而失败**

运行：`.venv/bin/pytest -q tests/test_api.py::test_homepage_uses_silver_core_galaxy_with_half_speed_wings`

预期：FAIL，首页仍包含 `black-hole`，尚未包含 `hero-galaxy`。

### 任务 2：实现银核银河与双翼光弧

**文件：**
- 修改：`app/static/index.html`
- 修改：`app/static/styles.css`
- 测试：`tests/test_api.py`

- [x] **步骤 1：替换首页装饰结构**

```html
<div class="hero-galaxy" aria-hidden="true">
  <div class="galaxy-ambient"></div>
  <div class="galaxy-stars"></div>
  <div class="galaxy-disc"></div>
  <div class="galaxy-core"></div>
  <div class="galaxy-wing galaxy-wing-a"></div>
  <div class="galaxy-wing galaxy-wing-b"></div>
</div>
```

- [x] **步骤 2：实现独立银河层和动画**

在 `app/static/styles.css` 中用银白、淡紫、蓝紫的 radial/conic gradients 绘制星核与扁平星盘；银河核心使用 `galaxy-core-spin`，两片光弧使用 `galaxy-wing-spin 48s linear infinite`，第二片通过负延迟与角度差形成错相。

```css
.galaxy-wing {
  animation: galaxy-wing-spin 48s linear infinite;
}

.galaxy-wing-b {
  animation-delay: -24s;
}

@keyframes galaxy-wing-spin {
  to { transform: rotate(360deg) scaleY(0.24); }
}
```

- [x] **步骤 3：添加响应式与减少动态效果规则**

平板和手机继续沿用当前右侧溢出位置，并逐级降低透明度；在 reduced-motion 媒体查询中取消 `galaxy-disc`、`galaxy-stars` 与两片 `galaxy-wing` 的动画。

- [x] **步骤 4：运行回归测试并确认通过**

运行：`.venv/bin/pytest -q tests/test_api.py::test_homepage_uses_silver_core_galaxy_with_half_speed_wings`

预期：PASS。

- [x] **步骤 5：检查差异范围**

运行：`git diff -- app/static/index.html app/static/styles.css tests/test_api.py`；若目录不是 Git 仓库，则改用 `rg -n "hero-galaxy|galaxy-wing-spin|black-hole" app/static tests/test_api.py` 确认只修改计划内结构。

### 任务 3：视觉与功能验收

**文件：**
- 验证：`app/static/index.html`
- 验证：`app/static/styles.css`
- 验证：`tests/ui_smoke.py`

- [x] **步骤 1：运行完整自动化检查**

运行：`.venv/bin/pytest -q && uvx ruff check app tests && uvx ruff format --check app tests && node --check app/static/app.js`

预期：全部退出码为 0。

- [x] **步骤 2：运行本地应用和浏览器冒烟测试**

运行：`.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 9877`，随后运行 `.venv/bin/python tests/ui_smoke.py`。

预期：登录、素材弹窗与生成区域等现有交互通过。

- [x] **步骤 3：截取桌面与手机页面截图进行视觉检查**

桌面使用 1440×1000 视口，手机使用 390×844 视口。确认银河不遮挡标题和按钮、银核可辨识、双翼属于同一视觉体系，且移动端亮度降低。

### 任务 4：部署与线上复核

**文件：**
- 发布：当前项目全部运行文件

- [x] **步骤 1：备份线上素材**

从现有 `/materials` 接口下载 JSON 备份并验证数量，避免 veFaaS 发布重置临时 SQLite 数据。

- [x] **步骤 2：发布现有 veFaaS 应用**

运行：`vefaas deploy --command "python -m uvicorn app.main:app --host 0.0.0.0 --port 8000" --port 8000 --yes`

预期：输出 `Deploy succeeded.` 并保持现有访问 URL。

- [x] **步骤 3：仅在素材为空时恢复备份**

逐条 POST 原始备份，不对 POST 使用自动重试；恢复后确认素材数量与发布前一致。

- [x] **步骤 4：在线检查视觉资源和业务接口**

确认首页返回 200、CSS 包含 `galaxy-wing-spin 48s`、页面不包含旧 `black-hole` 结构、健康检查正常、素材数量不变。
