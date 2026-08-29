from __future__ import annotations

import json
import re
from uuid import uuid4

from pydantic import ValidationError

from app.domain.case_models import CaseSnapshot
from app.llm.prompts import build_case_prompt
from app.llm.provider import LLMProvider, LLMProviderError
from app.repositories.cases import CaseAlreadyExistsError, CaseRepository


class CaseGenerationError(RuntimeError):
    code = "CASE_GENERATION_FAILED"
    status_code = 502
    user_message = "案件生成没有通过证据链校验，请重新生成。"


class LLMNotConfiguredError(CaseGenerationError):
    code = "LLM_NOT_CONFIGURED"
    status_code = 503
    user_message = "新案件暂时无法生成，可使用精修案件继续。"


class CaseGenerationFailedError(CaseGenerationError):
    pass


UNSAFE_CONTENT_TERMS = (
    "血腥",
    "尸体",
    "肢解",
    "性侵",
    "强奸",
    "自杀",
    "制毒",
    "炸弹",
    "枪械制作",
    "杀人",
    "毒品",
    "枪支",
    "爆炸物",
    "身份证",
    "真实人物",
    "真实公司",
    "勒死",
    "砍伤",
    "有毒气体",
    "毒气",
    "下毒",
    "投毒",
    "杀害",
    "致死",
    "马云",
    "马化腾",
    "张一鸣",
    "任正非",
    "雷军",
    "刘强东",
    "阿里巴巴",
    "腾讯",
    "字节跳动",
    "华为",
    "小米集团",
    "京东集团",
    "忽略以上",
    "系统提示词",
)

DANGEROUS_CONTENT_PATTERNS = (
    r"(?:配制|制作|制造).{0,8}(?:有毒|毒气|爆炸|枪支|武器)",
    r"(?:勒|掐|砍|刺).{0,3}(?:死|伤)",
)

FORMAL_ENTITY_PATTERN = re.compile(
    r"[\u4e00-\u9fffA-Za-z0-9]{2,24}"
    r"(?:股份有限公司|有限责任公司|有限公司|集团公司|公安局|检察院|人民法院)"
)


def case_content_is_safe(snapshot: CaseSnapshot) -> bool:
    content = snapshot.model_dump_json(by_alias=True)
    if any(term in content for term in UNSAFE_CONTENT_TERMS):
        return False
    if any(re.search(pattern, content) for pattern in DANGEROUS_CONTENT_PATTERNS):
        return False
    if FORMAL_ENTITY_PATTERN.search(content):
        return False
    if re.search(r"https?://|\b1[3-9]\d{9}\b", content, flags=re.IGNORECASE):
        return False
    return True


def normalize_case_graph(payload: object) -> dict:
    """Normalize only graph metadata; never rewrite evidence facts or truth."""
    if not isinstance(payload, dict):
        raise ValueError("case payload must be a JSON object")
    evidence = payload.get("evidence")
    lie_nodes = payload.get("lieNodes") or payload.get("lie_nodes")
    if not isinstance(evidence, list) or not isinstance(lie_nodes, list):
        return payload
    if len(evidence) != 5 or len(lie_nodes) != 3:
        return payload
    if any(not isinstance(item, dict) for item in [*evidence, *lie_nodes]):
        return payload

    def value(item: dict, camel: str, snake: str):
        return item.get(camel, item.get(snake))

    evidence_ids = [item.get("id") for item in evidence]
    lie_evidence_ids = [
        value(node, "evidenceId", "evidence_id") for node in lie_nodes
    ]
    if (
        any(not isinstance(item, str) for item in evidence_ids)
        or any(not isinstance(item, str) for item in lie_evidence_ids)
        or len(set(evidence_ids)) != 5
        or len(set(lie_evidence_ids)) != 3
        or not set(lie_evidence_ids).issubset(evidence_ids)
    ):
        return payload

    contextual_id = next(
        item for item in evidence_ids if item not in set(lie_evidence_ids)
    )
    public_ids = {lie_evidence_ids[0], contextual_id}
    for item in evidence:
        item["public"] = item["id"] in public_ids

    remaining_hidden = [
        item
        for item in evidence_ids
        if item not in public_ids and item not in set(lie_evidence_ids[1:])
    ]
    unlocks = [
        [lie_evidence_ids[1], *remaining_hidden],
        [lie_evidence_ids[2]],
        [],
    ]
    for node, node_unlocks in zip(lie_nodes, unlocks, strict=True):
        key = "unlockEvidenceIds" if "unlockEvidenceIds" in node else "unlock_evidence_ids"
        node[key] = node_unlocks

    controlled_replies = {
        "repeated": "这个问题你已经问过了。我的回答没有改变。",
        "irrelevant": "这份材料和当前问题没有直接关系，请先把证据与具体事实对上。",
        "pressure": "提高声音不能改变现有记录。拿出具体事实再问。",
        "empathy": "我理解你在试着缓和气氛，但我只回答眼前这些事实。",
        "probing": "你问到了一个具体环节，但现在的材料还不足以支持你的推断。",
        "background": "先把问题说具体。我只会回答已经摆到桌面上的事实。",
        "confession": "关键记录已经连起来了。我承认自己隐瞒了事实，完整结论由你提交。",
    }
    for node in lie_nodes:
        acknowledgement = value(node, "acknowledgement", "acknowledgement")
        node_id = node.get("id")
        if isinstance(node_id, str) and isinstance(acknowledgement, str):
            controlled_replies[f"effective_{node_id}"] = (
                f"{acknowledgement} 但这不等于你对整件事的推断都成立。"
            )
    template_key = (
        "replyTemplates" if "replyTemplates" in payload else "reply_templates"
    )
    payload[template_key] = controlled_replies
    return payload


class CaseGenerationService:
    def __init__(
        self,
        repository: CaseRepository,
        provider: LLMProvider,
        *,
        max_attempts: int = 3,
    ) -> None:
        self.repository = repository
        self.provider = provider
        self.max_attempts = max_attempts

    def generate(
        self,
        *,
        theme: str | None = None,
        difficulty: str = "standard",
    ) -> CaseSnapshot:
        if not self.provider.configured:
            raise LLMNotConfiguredError

        for _ in range(self.max_attempts):
            try:
                raw_case = self.provider.generate_case_json(
                    build_case_prompt(theme, difficulty)
                )
                payload = normalize_case_graph(json.loads(raw_case))
                for _ in range(3):
                    suffix = uuid4().hex
                    snapshot = CaseSnapshot.model_validate(
                        {
                            **payload,
                            "schemaVersion": 1,
                            "caseId": f"case_{suffix}",
                            "caseCode": f"CASE-{suffix[:16].upper()}",
                            "source": "llm",
                            "modelName": self.provider.case_model,
                        }
                    )
                    if not case_content_is_safe(snapshot):
                        break
                    try:
                        return self.repository.create(snapshot)
                    except CaseAlreadyExistsError:
                        continue
            except (ValueError, TypeError, ValidationError, LLMProviderError):
                continue
        raise CaseGenerationFailedError
