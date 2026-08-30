# AI 镜界后端代码审查报告

> 审查日期：2026-08-30
> 审查范围：backend/app/ 全部源码 + requirements.txt + .env
> 优先级：Critical > High > Medium > Low

---

## 一、Bug 汇总

### CRITICAL

#### 1. 路径遍历漏洞 — portraits.py 第36行
**文件**：`app/routers/portraits.py`
**位置**：第36行 `create_portrait` 函数
**问题**：
```python
selfie_fs_path = Path(settings.UPLOAD_DIR.parent / payload.selfie_url.lstrip("/"))
```
`selfie_url` 完全来自用户输入（`PortraitCreate` schema），仅做了 `lstrip("/")` 处理后直接拼接到文件系统路径。攻击者可传入 `../../etc/passwd` 或类似 payload 读取任意文件，甚至可能通过判断文件是否存在来探测服务器文件结构。
**修复建议**：
- 验证 `selfie_url` 必须以 `/uploads/` 开头，且路径规范化后仍在 `UPLOAD_DIR` 内
- 使用 `os.path.realpath` 或 `Path.resolve()` 后检查是否在允许的目录内
```python
selfie_path = (settings.UPLOAD_DIR.parent / payload.selfie_url.lstrip("/")).resolve()
if not str(selfie_path).startswith(str(settings.UPLOAD_DIR.resolve())):
    raise HTTPException(status_code=400, detail="无效的图片路径")
```

#### 2. 积分扣除存在竞态条件 — portraits.py 第48行
**文件**：`app/routers/portraits.py`
**位置**：第48行
**问题**：
```python
current_user.credits -= 1
```
在高并发下，同一用户同时发起多次生成请求时，多次读取 `credits` 后各自减1再写回，会导致实际扣除积分少于应扣数量，用户可能透支积分。
**修复建议**：
- 使用数据库乐观锁（version字段）或 `UPDATE ... WHERE credits >= 1` 的原子操作
```python
result = db.query(User).filter(
    User.id == current_user.id,
    User.credits >= 1
).update({User.credits: User.credits - 1})
if result == 0:
    db.rollback()
    raise HTTPException(status_code=402, detail="积分不足")
```

---

### HIGH

#### 3. 注册接口积分硬编码，与配置不一致 — auth.py 第29行
**文件**：`app/routers/auth.py`
**位置**：第29行
**问题**：
```python
credits=3,  # 硬编码
```
`config.py` 中已定义 `FREE_CREDITS = 3`，但注册时直接写死数字 3。同时 `models/user.py` 第23行也有 `default=3`。三处散落，修改配置时容易遗漏。
**修复建议**：统一使用 `settings.FREE_CREDITS`，model 默认值也应从配置读取或移除默认值由业务层赋值。

#### 4. Background Task 中使用 asyncio.run() — portraits.py 第68行
**文件**：`app/routers/portraits.py`
**位置**：第68-70行
**问题**：
```python
image_data = asyncio.run(
    ai_service.generate_portrait(Path(selfie_path), prompt)
)
```
FastAPI 的 `BackgroundTasks` 在同步线程中运行，这里用 `asyncio.run()` 每次创建新事件循环，效率低且可能导致资源泄漏。若未来已有运行中的事件循环会直接报错。
**修复建议**：将 `_run_generation` 改为异步函数，或使用 `asyncio.get_event_loop()` + `run_until_complete`，更推荐用 Celery/Redis Queue 等真正的任务队列。

#### 5. file_service 扩展名提取不可靠 — file_service.py 第10行
**文件**：`app/services/file_service.py`
**位置**：第10行
**问题**：
```python
ext = file.filename.split(".")[-1].lower() if file.filename else "jpg"
```
- 若文件名类似 `my.image.png`，取最后一段是正确的
- 但如果文件名为 `noextension`（无点号），`split(".")[-1]` 会返回整个文件名 `"noextension"`，被当作扩展名判断，会拒绝合法文件
- 同时默认回退为 `"jpg"` 不合理，应拒绝无扩展名的文件
**修复建议**：
```python
if not file.filename or "." not in file.filename:
    raise HTTPException(status_code=400, detail="无法识别文件格式")
ext = file.filename.rsplit(".", 1)[-1].lower()
```

#### 6. AI 生成失败时积分不退还 — portraits.py 第81-87行
**文件**：`app/routers/portraits.py`
**位置**：第81-87行异常处理块
**问题**：生成失败时（网络错误、AI服务不可用等），用户积分已扣除但不退还。用户体验差且不公平。
**修复建议**：在异常处理中退还积分：
```python
except Exception as e:
    # ... existing code ...
    if task:
        task.status = "failed"
        task.error_message = str(e)[:500]
        # 退还积分
        user = db.query(User).filter(User.id == task.user_id).first()
        if user:
            user.credits += task.credits_used
        db.commit()
```

---

### MEDIUM

#### 7. seed_styles 非原子性检查 — seed.py 第66行
**文件**：`app/seed.py`
**位置**：第66-68行
**问题**：先 `count()` 再插入不是原子操作，多进程启动时可能重复插入。
**修复建议**：使用 `INSERT OR IGNORE` 或基于唯一名称的 upsert 逻辑。

#### 8. 生成任务中断后状态永久卡住 — portraits.py 后台任务
**文件**：`app/routers/portraits.py`
**位置**：`_run_generation` 函数
**问题**：如果服务器在生成过程中重启，处于 `processing` 状态的任务永远卡在 processing，用户看不到结果也拿不到退款。
**修复建议**：启动时扫描超时的 processing 任务，标记为 failed 并退还积分。

---

### LOW

#### 9. bcrypt 密码长度截断风险 — auth_service.py 第17行
**文件**：`app/services/auth_service.py`
**位置**：第17行
**问题**：bcrypt 最多处理 72 字节，超过部分会被静默截断。超长密码的实际有效长度缩短，降低安全性。
**修复建议**：密码最大长度限制在 72 字节以内，或先做 SHA-256 哈希再喂给 bcrypt。

#### 10. delete_portrait 不删除物理文件 — portraits.py 第149-166行
**文件**：`app/routers/portraits.py`
**位置**：`delete_portrait` 函数
**问题**：删除任务记录时，对应的生成图片文件和自拍原图文件仍残留在磁盘上，造成存储空间浪费。
**修复建议**：删除数据库记录前，同步删除 `selfie_url` 和 `result_url` 对应的物理文件。

---

## 二、安全问题

### CRITICAL

#### S1. 默认 SECRET_KEY 可预测 — config.py 第14行
**文件**：`app/config.py`
**位置**：第14行
**问题**：
```python
SECRET_KEY: str = "mirror-realm-secret-key-change-in-production"
```
默认密钥是硬编码的公开字符串。如果生产环境 `.env` 中忘记配置 `SECRET_KEY`，攻击者可轻易伪造任意用户的 JWT Token，实现完全账户接管。
**修复建议**：
- 生产环境启动时强制校验 `SECRET_KEY` 不为默认值
- 或使用 `os.urandom(32).hex()` 作为动态默认（但需注意多进程一致性）
- 在 `.env` 示例中标注为必填项

#### S2. 路径遍历漏洞（同 Bug #1）
已在 Bug 部分详述。

---

### HIGH

#### S3. 完全没有速率限制
**文件**：所有 router
**问题**：
- `/api/auth/login` 无登录失败次数限制 — 可被暴力破解密码
- `/api/auth/register` 无注册频率限制 — 可被批量注册刷号
- `/api/portraits` POST 无生成频率限制 — 可被刷爆积分/算力
- `/api/uploads/selfie` 无上传频率限制 — 可被打满磁盘
**修复建议**：引入 `slowapi` 或 `limits` 库，按 IP + 用户维度限流。

#### S4. 邮箱/手机号无格式校验 — schemas/user.py
**文件**：`app/schemas/user.py`
**位置**：第8-9行
**问题**：`UserRegister` 中 phone 和 email 只有 `Optional[str]`，没有任何格式校验。攻击者可以注入异常字符串，或用假数据注册。
**修复建议**：
- email 使用 Pydantic 的 `EmailStr` 类型（需安装 `email-validator`）
- phone 添加正则校验，如 `^1[3-9]\d{9}$`（中国大陆手机号）

#### S5. 密码强度要求过低 — schemas/user.py 第10行
**文件**：`app/schemas/user.py`
**位置**：第10行
**问题**：密码仅要求 `min_length=6`，无任何复杂度要求。`123456` 即可通过。
**修复建议**：提升最小长度至 8 位，建议包含大小写字母+数字的组合要求。

#### S6. 登录接口用户枚举风险 — auth.py 第46-47行
**文件**：`app/routers/auth.py`
**位置**：第46-47行
**问题**：虽然返回统一的"账号或密码错误"信息（这点是对的），但注册接口（第19-22行）会分别告诉用户"该手机号已注册"和"该邮箱已注册"，攻击者可通过注册接口枚举系统中已存在的手机号/邮箱。
**修复建议**：降低注册接口的信息粒度，或对注册接口加强限速。

---

### MEDIUM

#### S7. DEBUG 模式默认开启 — config.py 第10行
**文件**：`app/config.py`
**位置**：第10行
**问题**：`DEBUG: bool = True`。生产环境若未关闭，错误堆栈信息可能泄露敏感的内部路径、数据库结构等。同时 SQLAlchemy `echo=True` 会打印所有 SQL 语句到日志。
**修复建议**：默认值设为 `False`，通过 `.env` 显式开启。

#### S8. 上传文件仅校验扩展名，未校验实际内容 — file_service.py
**文件**：`app/services/file_service.py`
**位置**：第10-15行
**问题**：只检查文件扩展名，不检查实际文件内容。攻击者可将恶意脚本（如 PHP webshell）改名为 `.jpg` 上传。虽然当前仅静态文件服务（不执行），但若未来引入图片处理库，可能触发图像解析漏洞。
**修复建议**：使用 `python-magic` 或 PIL 打开验证确实为图片。

#### S9. CORS allow_credentials 与通配风险 — main.py 第21-27行
**文件**：`app/main.py`
**位置**：第21-27行
**问题**：当前写死了两个 localhost 源，问题不大。但 `allow_methods=["*"]` 和 `allow_headers=["*"]` 配合 `allow_credentials=True`，未来如果扩大 `allow_origins` 范围，容易引入安全风险。
**修复建议**：生产环境严格限定 origins，从配置读取。

---

## 三、缺失功能 / 架构缺口

### CRITICAL

#### M1. 订单/支付模块完全缺失
**现状**：`models/order.py` 和 `schemas/order.py` 已定义，但没有 `routers/orders.py`，没有支付回调接口，没有积分充值逻辑。用户无法充值，只能靠注册送的 3 个积分。
**影响**：核心商业链路断裂，无法变现。
**建议**：尽快实现订单创建、支付回调（微信/支付宝）、积分到账逻辑。

#### M2. 没有管理员后台接口
**现状**：`User` 模型有 `is_admin` 字段，但没有任何管理员专属接口。风格模板只能通过 `seed.py` 初始化，无法在后台增删改。用户管理、数据统计、订单审核均缺失。
**建议**：实现 `/api/admin/*` 系列接口，包含风格 CRUD、用户列表、订单管理、数据看板等。

---

### HIGH

#### M3. 后台任务不可靠
**现状**：AI 生成依赖 FastAPI `BackgroundTasks`，进程重启即丢失，无法重试，无任务队列管理。
**建议**：引入 Celery + Redis/RabbitMQ 或 RQ，支持任务持久化、重试、并发控制。

#### M4. 列表接口无分页
**文件**：`portraits.py` list_portraits, `styles.py` list_styles
**问题**：数据量增大后（用户生成成百上千张），接口返回全部数据，响应慢且浪费带宽。
**建议**：实现分页（page + page_size 或 cursor 分页）。

#### M5. 无全局异常处理
**现状**：异常直接抛出，部分返回格式不一致。Debug 模式下会暴露堆栈。
**建议**：使用 `@app.exception_handler` 统一处理异常，返回标准化错误响应结构。

#### M6. 无操作审计日志
**现状**：关键操作（登录、生成、充值）没有审计日志，出问题无法溯源。
**建议**：记录登录 IP、时间、生成记录详情等。

#### M7. 无密码重置功能
**现状**：用户忘记密码后无法自助找回。
**建议**：实现邮箱/短信验证码重置密码流程。

---

### MEDIUM

#### M8. 无数据库迁移管理
**现状**：`requirements.txt` 有 alembic，但项目中没有 `alembic.ini` 和 `migrations/` 目录，完全靠 `Base.metadata.create_all()` 自动建表。生产环境表结构变更无法管理。
**建议**：初始化 alembic，为后续模型变更创建迁移脚本。

#### M9. 健康检查不完整 — main.py 第48-53行
**文件**：`app/main.py`
**位置**：第48-53行
**问题**：`/api/health` 只检查 AI API key 是否配置，不检查数据库连接、磁盘空间、队列状态。
**建议**：增加数据库连通性检查、关键目录可写性检查。

#### M10. 上传/生成文件无清理机制
**现状**：文件只会越来越多，没有定期清理策略。
**建议**：设置过期清理任务（如 30 天前的文件自动删除），或提供用户删除时同步清理物理文件。

#### M11. 用户头像上传接口缺失
**现状**：`User` 模型有 `avatar_url` 字段，但没有上传头像的接口。
**建议**：在 uploads 路由中增加头像上传端点。

---

### LOW

#### M12. 无 API 版本管理
**建议**：URL 中加入版本号如 `/api/v1/...`，方便未来演进。

#### M13. 缺少单元测试和集成测试
**现状**：`requirements.txt` 有 pytest 和 pytest-asyncio，但项目中没有 `tests/` 目录。
**建议**：为核心逻辑（认证、积分扣减、AI生成流程）编写测试。

---

## 四、代码质量问题

### HIGH

#### Q1. 底部导入（隐藏的循环依赖信号）
**文件**：
- `app/main.py` 第56行：`from app.services.ai_service import ai_service` 放在文件末尾
- `app/routers/portraits.py` 第169行：`from app.database import SessionLocal` 放在文件末尾

底部导入通常意味着存在循环依赖问题，是代码坏味道。`portraits.py` 中 `_run_generation` 使用 `SessionLocal`，但导入放在最后，说明曾经出现过循环导入。
**建议**：梳理模块依赖，消除循环引用。所有 import 语句放在文件顶部。

#### Q2. 魔法字符串泛滥
状态值 `"pending"`、`"processing"`、`"completed"`、`"failed"` 在多个文件中硬编码。
**建议**：定义枚举类或常量：
```python
from enum import Enum
class TaskStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
```

#### Q3. 重复的用户权限校验代码
**文件**：`app/routers/portraits.py`
**问题**：第106-122行 `get_portrait`、第125-146行 `get_portrait_status`、第149-166行 `delete_portrait` 三处都有几乎相同的查询逻辑：
```python
task = db.query(PortraitTask).filter(
    PortraitTask.id == portrait_id,
    PortraitTask.user_id == current_user.id,
).first()
if not task:
    raise HTTPException(status_code=404, detail="写真不存在")
```
**建议**：抽成一个公共函数 `get_portrait_or_404(db, portrait_id, user_id)`。

---

### MEDIUM

#### Q4. 模块 `__init__.py` 全部为空
`app/models/__init__.py`、`app/schemas/__init__.py`、`app/services/__init__.py`、`app/routers/__init__.py` 都是空文件。
**建议**：在 `__init__.py` 中导出主要类，简化外部 import：
```python
# app/models/__init__.py
from app.models.user import User
from app.models.style import Style
from app.models.portrait import PortraitTask
from app.models.order import Order
```

#### Q5. 配置项散落在多处
FREE_CREDITS 同时出现在 config.py（定义）、models/user.py（default=3）、routers/auth.py（credits=3）。
**建议**：单一数据源原则，统一从 `settings.FREE_CREDITS` 读取。

#### Q6. 缺少类型注解和文档字符串
大部分函数没有 docstring，部分函数缺少返回类型注解。
**建议**：为公共函数和复杂逻辑补充 docstring。

#### Q7. user.py 中 gen_uuid 函数被其他模型跨文件引用
**文件**：`app/models/user.py` 第10-11行
**问题**：`gen_uuid()` 定义在 user.py 中，style.py、portrait.py、order.py 都从 user 模块 import 这个工具函数。职责归属不对。
**建议**：移到 `app/models/base.py` 或 `app/utils.py` 中。

#### Q8. SQLite 不适合生产
**文件**：`app/config.py` 第12行
**问题**：默认使用 SQLite，并发写入性能差，不适合生产环境。
**建议**：生产环境使用 PostgreSQL/MySQL，并在文档中说明。

---

### LOW

#### Q9. StyleDetail schema 继承 StyleOut 但暴露了 prompt_template
**文件**：`app/schemas/style.py`
**位置**：第19-22行
**问题**：`StyleDetail` 包含 `prompt_template`，如果该接口被前端调用，会泄露 AI 提示词模板（商业秘密）。虽然目前 `get_style` 接口对所有人开放且返回 StyleDetail，但建议将 prompt_template 仅用于后端内部。
**建议**：创建独立的管理端 schema，普通用户接口不返回 prompt_template。

#### Q10. 日志配置过于简单
**文件**：`app/main.py` 第12行
**问题**：只有 `logging.basicConfig(level=logging.INFO)`，没有结构化日志，没有日志文件轮转。
**建议**：使用 `loguru` 或配置文件管理器，输出 JSON 格式日志便于采集。

---

## 五、问题优先级总览

| 优先级 | 数量 | 条目 |
|--------|------|------|
| **Critical** | 4 | 路径遍历漏洞、积分竞态、默认密钥可预测、订单支付缺失 |
| **High** | 12 | 积分硬编码、asyncio.run 滥用、扩展名提取 bug、失败不退积分、无速率限制、无格式校验、密码弱、用户枚举、后台任务不可靠、无分页、无全局异常、无审计日志 |
| **Medium** | 9 | seed 非原子、任务卡住、DEBUG 默认开、内容校验缺失、CORS 风险、无密码重置、无数据库迁移、健康检查不全、文件无清理 |
| **Low** | 8 | bcrypt 截断、不删物理文件、无头像上传、无 API 版本、无测试、底部导入、魔法字符串、重复代码 |

---

## 六、建议修复顺序

**第一阶段（安全紧急修复）**
1. 修复路径遍历漏洞（S2 / Bug #1）
2. 强制生产环境 SECRET_KEY 不为默认值（S1）
3. 增加登录/注册/生成接口限流（S3）
4. 修复积分扣除竞态条件（Bug #2）

**第二阶段（核心功能补全）**
5. 实现订单与支付模块（M1）
6. 实现管理员后台接口（M2）
7. AI 生成失败时退还积分（Bug #6）

**第三阶段（稳定性与质量）**
8. 引入任务队列替代 BackgroundTasks（M3）
9. 实现列表分页（M4）
10. 增加全局异常处理（M5）
11. 初始化 Alembic 迁移（M8）
12. 消除底部导入和魔法字符串（Q1, Q2）
