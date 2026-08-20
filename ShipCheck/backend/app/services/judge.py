"""判定。给 checklist item + 证据 → pass/fail + reason。"""
from app.core.config import settings
from app.core.errors import AppError
from app.core.logger import logger
from app.services import llm
from app.services.prompts_loader import load_prompt


def _ev_to_dict(e) -> dict:
    if hasattr(e, "kind"):  # ORM
        return {"kind": e.kind, "path": e.path, "content": e.content}
    return e


def judge_item(
    item_description: str, expected: str, evidence: list
) -> tuple[str, str]:
    """返回 (result, reason)。result ∈ {pass, fail}。"""
    ev_dicts = [_ev_to_dict(e) for e in evidence]

    if settings.mock_mode:
        has_text = any(
            e["kind"] in ("text", "dom") and e.get("content") for e in ev_dicts
        )
        if has_text:
            return "pass", "[mock] 证据含页面内容,判定通过"
        return "fail", "[mock] 无页面证据"

    system = load_prompt("judge")
    user_lines = [
        f"待验证项: {item_description}",
        f"期望: {expected}",
        "证据:",
    ]
    shot_path = None
    for e in ev_dicts:
        if e["kind"] == "screenshot" and e.get("path"):
            shot_path = e["path"]
        elif e["kind"] != "screenshot":
            content = (e.get("content") or "")[:800]
            user_lines.append(f"- [{e['kind']}] {content}")
    user = "\n".join(user_lines)

    try:
        if shot_path:
            data = llm.vision_complete_json(system, user, shot_path)
        else:
            data = llm.complete_json(system, user)
    except AppError as e:
        logger.warning("judge LLM failed: %s", e.message)
        return "fail", f"判定调用失败: {e.message}"

    result = data.get("result", "fail")
    reason = data.get("reason", "")
    if result not in ("pass", "fail"):
        result = "fail"
    if not reason:
        reason = "模型未给出理由"
    return result, reason
