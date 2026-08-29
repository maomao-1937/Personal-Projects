# AI 审讯室访问令牌与上线实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为 AI 审讯室增加单一访问令牌登录、Session 所有权隔离、生产文案清理、SQLite 云备份，并部署为可通过 HTTPS 访问的 veFaaS 前后端应用。

**架构：** 后端用访问令牌哈希换取 HMAC 签名的安全 Cookie，所有游戏接口从 Cookie 解析访问主体，并按主体校验 Session。前端提供独立访问页，Next.js Proxy 负责缺失 Cookie 的页面跳转，Next.js Rewrite 把浏览器的同源 `/api/v1` 请求转发到独立后端，后端继续作为唯一安全边界。生产环境使用 veFaaS 双应用、后端预留实例和 TOS 数据库快照。

**技术栈：** FastAPI、Pydantic、SQLAlchemy、Alembic、HMAC-SHA256、火山引擎 TOS Python SDK、pytest；Next.js 16、React 19、TypeScript、Vitest、Playwright；火山引擎 veFaaS、APIG、TOS。

---

## 文件结构

- 创建 `backend/app/services/auth.py`：令牌哈希校验、Cookie 签发/解析和登录限频。
- 创建 `backend/app/services/database_backup.py`：SQLite 一致性快照、TOS 上传和启动恢复。
- 创建 `backend/alembic/versions/20260825_0006_add_session_owner.py`：Session 所有者字段迁移。
- 修改 `backend/app/core/config.py`：鉴权、Cookie、TOS 和生产配置。
- 修改 `backend/app/main.py`：鉴权服务、备份服务、生产启动检查和生命周期。
- 修改 `backend/app/api/v1.py`、`schemas/api.py`：认证 API 和受保护业务 API。
- 修改 `backend/app/repositories/sessions.py`、`services/game.py`：Session 所有者持久化与授权。
- 创建 `backend/tests/test_auth.py`、`test_database_backup.py`：安全边界与备份测试。
- 修改 `backend/tests/test_api.py`、`test_session_service.py`：鉴权和数据隔离集成测试。
- 创建 `frontend/app/access/page.tsx`、`frontend/features/auth/access-form.tsx`：访问验证页。
- 创建 `frontend/proxy.ts`：缺少登录 Cookie 时跳转到验证页。
- 修改 `frontend/next.config.ts`：将同源 `/api/v1` 转发到后端应用。
- 修改 `frontend/features/game/api.ts`：认证请求、401 恢复和 Cookie 请求。
- 修改 `frontend/app/page.tsx`、`layout.tsx`、`globals.css`：退出入口与生产文案。
- 创建 `frontend/tests/access-form.test.tsx`，修改 `api-client.test.ts`：登录和过期恢复测试。
- 修改 `tests/web_smoke.py`：访问令牌、数据隔离和生产文案 E2E。
- 创建 `backend/.vefaasignore`、`frontend/.vefaasignore`：部署包排除规则。
- 修改 `.env.example`、`README.md`、阶段文档：生产配置和部署验收。

### 任务 1：后端令牌会话与限频

**文件：**
- 创建：`backend/app/services/auth.py`
- 修改：`backend/app/core/config.py`
- 创建：`backend/tests/test_auth.py`

- [ ] **步骤 1：编写失败测试**

```python
def test_correct_access_token_issues_verifiable_cookie():
    service = AccessAuthService.for_test("ONE-TOKEN", "signing-secret")
    cookie = service.login("ONE-TOKEN", "127.0.0.1")
    assert service.verify_cookie(cookie).subject == "pilot"

def test_tampered_and_expired_cookies_are_rejected():
    service = AccessAuthService.for_test("ONE-TOKEN", "signing-secret")
    cookie = service.login("ONE-TOKEN", "127.0.0.1")
    with pytest.raises(AuthRequiredError):
        service.verify_cookie(cookie + "x")

def test_repeated_bad_tokens_are_rate_limited():
    service = AccessAuthService.for_test("ONE-TOKEN", "signing-secret", max_failures=3)
    for _ in range(3):
        with pytest.raises(InvalidAccessTokenError):
            service.login("WRONG", "127.0.0.1")
    with pytest.raises(AuthRateLimitedError):
        service.login("WRONG", "127.0.0.1")
```

- [ ] **步骤 2：运行测试验证红灯**

运行：`cd backend && PYTHONPATH=. ../../../.venv/bin/python -m pytest tests/test_auth.py -q`  
预期：FAIL，`app.services.auth` 不存在。

- [ ] **步骤 3：实现最小鉴权服务**

```python
class AccessAuthService:
    def login(self, raw_token: str, source: str) -> str:
        if self.rate_limiter.blocked(source):
            raise AuthRateLimitedError
        digest = sha256(raw_token.encode()).hexdigest()
        if not compare_digest(digest, self.access_token_hash):
            self.rate_limiter.record_failure(source)
            raise InvalidAccessTokenError
        return self.sign(AuthIdentity(subject="pilot"))

    def verify_cookie(self, value: str | None) -> AuthIdentity:
        payload_part, signature_part = self.split_cookie(value)
        expected = self.sign_payload(payload_part)
        if not compare_digest(signature_part, expected):
            raise AuthRequiredError
        payload = self.decode_payload(payload_part)
        if payload.expires_at <= self.clock():
            raise AuthRequiredError
        return AuthIdentity(subject=payload.subject)
```

实现中不得保存或记录明文令牌；`Settings` 增加 `ACCESS_TOKEN_HASH`、`AUTH_SIGNING_SECRET`、`AUTH_COOKIE_SECURE` 和 7 天 TTL。

- [ ] **步骤 4：运行测试验证绿灯**

运行同一步骤 2。  
预期：全部 PASS。

- [ ] **步骤 5：提交**

```bash
git add backend/app/services/auth.py backend/app/core/config.py backend/tests/test_auth.py
git commit -m "feat(鉴权): 添加单访问令牌登录会话"
```

### 任务 2：认证 API 与 Session 所有权隔离

**文件：**
- 创建：`backend/alembic/versions/20260825_0006_add_session_owner.py`
- 修改：`backend/app/api/v1.py`
- 修改：`backend/app/schemas/api.py`
- 修改：`backend/app/main.py`
- 修改：`backend/app/repositories/sessions.py`
- 修改：`backend/app/services/game.py`
- 修改：`backend/tests/test_api.py`
- 修改：`backend/tests/test_session_service.py`

- [ ] **步骤 1：编写失败测试**

```python
def test_business_api_requires_cookie(auth_client):
    assert auth_client.get("/api/v1/cases/001").status_code == 401

def test_login_sets_http_only_cookie(auth_client):
    response = auth_client.post("/api/v1/auth/login", json={"accessToken": "ONE-TOKEN"})
    assert response.status_code == 204
    assert "HttpOnly" in response.headers["set-cookie"]

def test_session_owner_cannot_be_cross_read(authenticated_clients):
    owner_a, owner_b = authenticated_clients
    session_id = owner_a.post("/api/v1/sessions", json={"caseId": "001"}).json()["sessionId"]
    assert owner_b.get(f"/api/v1/sessions/{session_id}").status_code == 403
```

- [ ] **步骤 2：运行目标测试验证红灯**

运行：`cd backend && PYTHONPATH=. ../../../.venv/bin/python -m pytest tests/test_api.py tests/test_session_service.py -q`  
预期：FAIL，业务接口未鉴权且 Session 无所有者。

- [ ] **步骤 3：实现认证路由、依赖和所有者迁移**

```python
@router.post("/auth/login", status_code=204)
def login(request: LoginRequest, response: Response, client: Request):
    cookie = auth_service.login(request.access_token, client.client.host)
    response.set_cookie(AUTH_COOKIE_NAME, cookie, httponly=True, secure=settings.auth_cookie_secure, samesite="lax")

@router.post("/sessions", status_code=201)
def create_session(request: CreateSessionRequest, identity: AuthIdentity = Depends(require_identity)):
    state = service.create_session(request.case_id, owner_id=identity.subject)
    return _session_payload(state, service)
```

`sessions.owner_id` 使用 `String(64)`、非空、索引；Repository 的 `get_versioned`、`save`、`get_report` 和回合请求操作都接受并校验 `owner_id`。跨主体访问映射为 `403 SESSION_FORBIDDEN`。

- [ ] **步骤 4：运行后端全量测试和迁移测试**

运行：`cd backend && PYTHONPATH=. ../../../.venv/bin/python -m pytest -q`  
运行：对空 SQLite 执行 `alembic upgrade head`。  
预期：全部 PASS，迁移 head 为 `20260825_0006`。

- [ ] **步骤 5：提交**

```bash
git add backend/alembic backend/app backend/tests
git commit -m "feat(会话): 按访问主体隔离审讯数据"
```

### 任务 3：前端访问页和过期恢复

**文件：**
- 创建：`frontend/app/access/page.tsx`
- 创建：`frontend/features/auth/access-form.tsx`
- 创建：`frontend/proxy.ts`
- 修改：`frontend/next.config.ts`
- 修改：`frontend/features/game/api.ts`
- 修改：`frontend/app/page.tsx`
- 修改：`frontend/app/globals.css`
- 创建：`frontend/tests/access-form.test.tsx`
- 修改：`frontend/tests/api-client.test.ts`

- [ ] **步骤 1：阅读当前 Next.js 16 文档并编写失败测试**

阅读：

- `frontend/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`
- `frontend/node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md`

测试：

```tsx
it("submits the access token and enters the requested page", async () => {
  vi.mocked(gameApi.login).mockResolvedValue(undefined);
  render(<AccessForm nextPath="/" />);
  await user.type(screen.getByLabelText("访问令牌"), "ONE-TOKEN");
  await user.click(screen.getByRole("button", { name: "进入审讯室" }));
  expect(gameApi.login).toHaveBeenCalledWith("ONE-TOKEN");
  expect(router.replace).toHaveBeenCalledWith("/");
});
```

- [ ] **步骤 2：运行前端目标测试验证红灯**

运行：`cd frontend && npm test -- access-form.test.tsx api-client.test.ts`  
预期：FAIL，访问页、登录 API 和 Proxy 不存在。

- [ ] **步骤 3：实现访问验证和恢复行为**

```ts
export const authApi = {
  login: (accessToken: string) => apiRequest<void>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ accessToken }),
    credentials: "include",
  }),
  logout: () => apiRequest<void>("/auth/logout", { method: "POST", credentials: "include" }),
};
```

`proxy.ts` 只检查 Cookie 是否存在，跳过 `/access`、`/api` 和静态资源；后端负责签名真伪。`next.config.ts` 将 `/api/v1/:path*` 重写到只在服务端配置的 `BACKEND_URL`，浏览器不接触后端域名。业务 API 收到 `AUTH_REQUIRED` 后进入带有当前路径 `next` 查询参数的 `/access`。

- [ ] **步骤 4：运行前端单测、lint 和 typecheck**

运行：`cd frontend && npm test && npm run lint && npm run typecheck`  
预期：全部 PASS。

- [ ] **步骤 5：提交**

```bash
git add frontend/app frontend/features frontend/next.config.ts frontend/proxy.ts frontend/tests
git commit -m "feat(前端): 添加访问令牌验证入口"
```

### 任务 4：生产文案与线上 E2E

**文件：**
- 修改：`frontend/app/layout.tsx`
- 修改：`frontend/app/page.tsx`
- 修改：`frontend/features/game/components/start-case-button.tsx`
- 修改：`tests/web_smoke.py`

- [ ] **步骤 1：新增失败断言**

```python
def assert_production_copy(page):
    html = page.locator("body").inner_text()
    for forbidden in ("Demo", "MVP", "测试版", "内测版", "v0", "v1"):
        assert forbidden not in html
```

E2E 先访问 `/`，断言跳转 `/access`；错误令牌被拒；正确令牌进入落地页；随后完成生成、审讯、结案和下一案。

- [ ] **步骤 2：运行 E2E 验证红灯**

运行：`cd frontend && PYTHON_BIN=../../../.venv/bin/python npm run test:e2e`  
预期：FAIL，当前没有访问验证页。

- [ ] **步骤 3：清理线上文案并补齐 E2E**

仅移除用户可见的开发态表达；案件编号、回合编号和证据 ID 属于游戏语义，必须保留。

- [ ] **步骤 4：运行完整前端验证**

运行：`cd frontend && npm run lint && npm run typecheck && npm test && npm run build`  
运行：`PYTHON_BIN=../../../.venv/bin/python npm run test:e2e`  
预期：全部 PASS，4 个目标视口无横向滚动。

- [ ] **步骤 5：提交**

```bash
git add frontend tests
git commit -m "fix(上线): 清理开发态文案并完善访问验收"
```

### 任务 5：SQLite TOS 备份与生产打包

**文件：**
- 创建：`backend/app/services/database_backup.py`
- 创建：`backend/tests/test_database_backup.py`
- 修改：`backend/app/main.py`
- 修改：`backend/app/core/config.py`
- 修改：`backend/requirements.txt`
- 创建：`backend/.vefaasignore`
- 创建：`frontend/.vefaasignore`
- 修改：`.env.example`
- 修改：`README.md`

- [ ] **步骤 1：编写失败测试**

```python
def test_backup_uploads_consistent_sqlite_snapshot(tmp_path, fake_s3):
    service = DatabaseBackupService(database_path=tmp_path / "app.db", s3=fake_s3)
    service.backup_now()
    assert fake_s3.uploaded_key == "db-backup/ai-interrogation.db"

def test_restore_downloads_when_local_database_is_missing(tmp_path, fake_s3):
    service = DatabaseBackupService(database_path=tmp_path / "app.db", s3=fake_s3)
    assert service.restore_if_missing() is True
    assert (tmp_path / "app.db").exists()
```

- [ ] **步骤 2：运行测试验证红灯**

运行：`cd backend && PYTHONPATH=. ../../../.venv/bin/python -m pytest tests/test_database_backup.py -q`  
预期：FAIL，备份服务不存在。

- [ ] **步骤 3：实现一致性快照与生命周期**

使用 SQLite 原生 `Connection.backup()` 生成临时一致性副本，再通过火山引擎官方 TOS Python SDK 上传；恢复时先下载到临时文件，再原子替换目标数据库。TOS 未配置时本地开发禁用；生产启动时必须配置完整。

生命周期顺序：恢复数据库 → Alembic 迁移 → 启动周期备份任务 → 服务请求 → 停机前最终备份。

- [ ] **步骤 4：验证依赖、测试和部署排除**

运行：`cd backend && PYTHONPATH=. ../../../.venv/bin/python -m pytest -q && ../../../.venv/bin/python -m compileall -q app`。  
检查 `.vefaasignore` 必须排除 `.env`、`.venv`、`data`、缓存和测试产物。

- [ ] **步骤 5：提交**

```bash
git add backend frontend/.vefaasignore .env.example README.md
git commit -m "feat(部署): 添加数据库云备份与生产打包配置"
```

### 任务 6：部署、线上验证与交付

**文件：**
- 修改：`README.md`
- 修改：`docs/阶段1技术开发文档.md`
- 修改：`docs/阶段2前端开发文档.md`

- [ ] **步骤 1：完成本地最终验证**

```bash
cd backend
PYTHONPATH=. ../../../.venv/bin/python -m pytest -q
../../../.venv/bin/python -m compileall -q app
cd ../frontend
npm run lint
npm run typecheck
npm test
npm run build
PYTHON_BIN=../../../.venv/bin/python npm run test:e2e
```

预期：所有命令退出码为 0。

- [ ] **步骤 2：准备云端凭据与资源**

运行：

```bash
vefaas login --sso
vefaas login --check
vefaas doctor
vefaas gateway list --first -o json
```

确认 CLI 版本不低于 0.2.7、当前身份和现有 Serverless 网关。创建 TOS 桶前再次确认目标地域和桶名；不得打印云端密钥。

- [ ] **步骤 3：生成秘密并配置后端环境变量**

使用 `secrets` 生成 1 个访问令牌和 1 个 HMAC 签名密钥；访问令牌只把 SHA-256 哈希写入 veFaaS 环境变量。配置模型 Key、数据库、鉴权和 TOS 变量后，用 `vefaas env list` 只确认键名。

- [ ] **步骤 4：部署后端与前端**

后端首次部署：

```bash
vefaas deploy --newApp ai-interrogation-api --gatewayName "$VEFAAS_GATEWAY_NAME" --command "python -m uvicorn app.production:app --host 0.0.0.0 --port 8000" --port 8000 --yes
```

前端首次部署：

```bash
BACKEND_URL="$BACKEND_PUBLIC_URL" vefaas deploy --newApp ai-interrogation-web --gatewayName "$VEFAAS_GATEWAY_NAME" --buildCommand "npm run build" --outputPath ".next/standalone" --command "node server.js" --port 3000 --yes
```

部署后为后端底层 Function 设置最小实例数 1，并通过 `vefaas domains` 获取正式前端地址。

- [ ] **步骤 5：线上黑盒验收**

验证：无 Cookie 跳验证页、错误令牌拒绝、正确令牌进入、动态案生成、有效证据命中、结案、下一案、刷新恢复、移动端布局、日志无秘密、TOS 备份和恢复。

- [ ] **步骤 6：更新交付文档并本地提交**

README 写入正式前端地址、登录方式和验证步骤，不写明文访问令牌。提交后不推送远端 Git。

- [ ] **步骤 7：按指定格式交付**

```text
产品名：AI 审讯室
邀请码：交付时填入本次安全生成且仅展示一次的访问令牌
网页链接：交付时填入已通过线上黑盒验收的前端 HTTPS 地址
```
