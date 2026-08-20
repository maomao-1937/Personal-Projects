"""基于原 PRD + suggestions(findings 或 fix_tasks 序列化后的文本),生成修改后的完整 PRD。"""
from app.core.config import settings
from app.services import llm
from app.services.prompts_loader import load_prompt

_MOCK_REWRITE_TEMPLATE = """# {title}

> 以下内容由 ShipCheck 根据审查/验收结果生成(Mock 模式,占位文本,请接混元 API Key 后重新生成)。

## 1. 产品目标
已根据建议补充可度量成功指标(如 P95 时延 < 500ms、完成率 ≥ 90%)。

## 2. 用户与主链路
已根据建议补全 输入 → 行为 → 交付物 的闭环。

## 3. 功能
### F1 登录页
- 邮箱输入框、密码输入框、登录按钮
- 登录成功跳转 /dashboard,展示用户名

### F2 登录校验
- 正确凭证跳转 dashboard
- 错误凭证提示"邮箱或密码错误"

## 4. 边界与约束
- 不做注册、找回密码、第三方登录
- 不做记住我

## 5. 失败路径
- 邮箱为空时登录按钮禁用
- 密码错误 3 次锁定 15 分钟,展示重置入口
- 网络超时 > 5s 提示"网络异常,请重试"
"""


def rewrite_prd(original_prd: str, suggestions_text: str) -> str:
    """返回修改后的 PRD 全文。suggestions_text 是 findings 或 fix_tasks 的可阅读文本。"""
    if settings.mock_mode:
        title = (
            original_prd.splitlines()[0].replace("#", "").strip()
            or "改写后的 PRD"
        )
        return _MOCK_REWRITE_TEMPLATE.format(title=title or "改写后的 PRD")
    system = load_prompt("prd_rewrite")
    user = (
        "【原 PRD】\n"
        + original_prd
        + "\n\n【需要落实的建议】\n"
        + suggestions_text
        + "\n\n请输出改写后的完整 PRD 正文。"
    )
    return llm.complete_text(system, user)
