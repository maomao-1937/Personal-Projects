"""checklist 生成。features → 可执行的验收 checklist。"""
import json

from app.core.config import settings
from app.core.errors import AppError
from app.services import llm
from app.services.prompts_loader import load_prompt

# mock 模式下的样例 checklist
_MOCK_CHECKLIST = [
    {
        "description": "首页可访问",
        "expected": "页面正常加载,无 404,标题可见",
        "destructive": False,
    },
    {
        "description": "首页包含登录入口",
        "expected": "页面文本或按钮中包含'登录'",
        "destructive": False,
    },
    {
        "description": "首页有导航栏",
        "expected": "页面顶部有导航栏,包含主要功能链接",
        "destructive": False,
    },
]


def generate_checklist(features: list[dict]) -> list[dict]:
    """返回 checklist [{description, expected, destructive}]。"""
    if settings.mock_mode:
        return [dict(c) for c in _MOCK_CHECKLIST]
    system = load_prompt("gen_checklist")
    user = json.dumps(features, ensure_ascii=False)
    data = llm.complete_json(system, user)
    items = data.get("checklist")
    if not isinstance(items, list) or not items:
        raise AppError("parse_error", "checklist 生成返回非 list 或为空", 502)
    # 校验每条字段
    for it in items:
        if not it.get("description") or not it.get("expected"):
            raise AppError("parse_error", "checklist 项缺 description/expected", 502)
        it.setdefault("destructive", False)
    return items
