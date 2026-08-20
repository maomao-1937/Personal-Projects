"""PRD 解析。PRD → 结构化 features 列表。"""
from app.core.config import settings
from app.core.errors import AppError
from app.services import llm
from app.services.prompts_loader import load_prompt

# mock 模式下的样例 features
_MOCK_FEATURES = [
    {"id": "F1", "name": "用户登录", "description": "用户可通过邮箱密码登录"},
    {"id": "F2", "name": "首页导航", "description": "首页包含主导航,链接到主要功能区"},
    {"id": "F3", "name": "表单提交", "description": "用户可填写并提交表单,看到提交成功提示"},
]


def parse_prd(prd_text: str) -> list[dict]:
    """返回 features 列表 [{id, name, description}]。"""
    if settings.mock_mode:
        return [dict(f) for f in _MOCK_FEATURES]
    system = load_prompt("prd_parse")
    data = llm.complete_json(system, prd_text)
    features = data.get("features")
    if not isinstance(features, list) or not features:
        raise AppError("parse_error", "PRD 解析返回 features 非 list 或为空", 502)
    return features
