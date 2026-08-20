"""PRD 审查模式。PRD → findings(逻辑漏洞/缺失/矛盾/模糊 + 修改建议)。"""
from app.core.config import settings
from app.core.errors import AppError
from app.services import llm
from app.services.prompts_loader import load_prompt

# mock 模式下的样例 findings
_MOCK_FINDINGS = [
    {
        "severity": "high",
        "category": "missing",
        "message": "PRD 未定义验收成功指标",
        "suggestion": "补充可度量指标,如完成率≥90%、首字时延<2s",
    },
    {
        "severity": "medium",
        "category": "logic_gap",
        "message": "登录失败的降级路径未说明",
        "suggestion": "补充:密码错误 3 次后锁定 15 分钟,并提示重置",
    },
    {
        "severity": "low",
        "category": "ambiguous",
        "message": "'响应要快'表述模糊",
        "suggestion": "改为 P95 响应时延 < 500ms",
    },
]


def review_prd(prd_text: str) -> list[dict]:
    """返回 findings [{severity, category, message, suggestion}]。"""
    if settings.mock_mode:
        return [dict(f) for f in _MOCK_FINDINGS]
    system = load_prompt("prd_review")
    data = llm.complete_json(system, prd_text)
    findings = data.get("findings")
    if not isinstance(findings, list):
        raise AppError("parse_error", "PRD 审查返回 findings 非 list", 502)
    # 校验字段
    for f in findings:
        if not f.get("message") or not f.get("suggestion"):
            raise AppError("parse_error", "finding 缺 message/suggestion", 502)
        f.setdefault("severity", "medium")
        f.setdefault("category", "logic_gap")
    return findings
