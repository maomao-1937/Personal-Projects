import json
from copy import deepcopy
from pathlib import Path

import pytest

from app.core.database import Database
from app.domain.case_001 import CASE_001
from app.repositories.cases import CaseRepository
from app.services.case_generation import (
    CaseGenerationFailedError,
    CaseGenerationService,
)


def generated_case_json(title: str = "消失的校准记录") -> str:
    payload = deepcopy(CASE_001)
    payload["title"] = title
    payload["subtitle"] = "南区检测中心记录异常事件"
    payload["caseId"] = "MODEL_CONTROLLED_ID"
    payload["caseCode"] = "MODEL-CONTROLLED-CODE"
    return json.dumps(payload, ensure_ascii=False)


def unreachable_case_json() -> str:
    payload = json.loads(generated_case_json("待服务端整理的证据图"))
    payload["evidence"][0]["public"] = True
    payload["evidence"][1]["public"] = True
    for index, node in enumerate(payload["lie_nodes"]):
        node["evidence_id"] = f"E{index + 3:02d}"
        node["unlock_evidence_ids"] = []
    return json.dumps(payload, ensure_ascii=False)


class FakeProvider:
    configured = True
    case_model = "fake-case-model"

    def __init__(self, case_outputs: list[str], review_outputs: list[str]) -> None:
        self.case_outputs = iter(case_outputs)
        self.review_outputs = iter(review_outputs)
        self.case_calls = 0
        self.review_calls = 0

    def generate_case_json(self, prompt: str) -> str:
        assert "5 条证据" in prompt
        self.case_calls += 1
        return next(self.case_outputs)

    def review_case_json(self, prompt: str) -> str:
        assert "自洽" in prompt
        self.review_calls += 1
        return next(self.review_outputs)

    def generate_reply(self, prompt: str) -> str:
        return "测试回答。"


@pytest.fixture()
def repository(tmp_path: Path) -> CaseRepository:
    database = Database(f"sqlite:///{tmp_path / 'generation.db'}")
    database.create_schema()
    return CaseRepository(database)


def test_generation_retries_invalid_json_then_persists(
    repository: CaseRepository,
) -> None:
    provider = FakeProvider(
        ["not-json", generated_case_json()],
        [],
    )
    service = CaseGenerationService(repository, provider, max_attempts=3)

    generated = service.generate()

    assert generated.source == "llm"
    assert generated.title == "消失的校准记录"
    assert generated.case_id.startswith("case_")
    assert generated.case_id != "MODEL_CONTROLLED_ID"
    assert generated.case_code.startswith("CASE-")
    assert generated.case_code != "MODEL-CONTROLLED-CODE"
    assert provider.case_calls == 2
    assert provider.review_calls == 0
    assert repository.get(generated.case_id) == generated


def test_valid_runtime_case_does_not_wait_for_advisory_model_review(
    repository: CaseRepository,
) -> None:
    provider = FakeProvider(
        [generated_case_json("程序校验通过的新案")],
        ['{"passed": false, "issues": ["离线复核意见不阻塞实时开局"]}'],
    )
    service = CaseGenerationService(repository, provider, max_attempts=1)

    generated = service.generate()

    assert generated.title == "程序校验通过的新案"
    assert provider.case_calls == 1
    assert provider.review_calls == 0


def test_generation_normalizes_graph_metadata_without_another_model_call(
    repository: CaseRepository,
) -> None:
    provider = FakeProvider([unreachable_case_json()], [])
    service = CaseGenerationService(repository, provider, max_attempts=1)

    generated = service.generate()

    public_ids = {item.id for item in generated.evidence if item.public}
    assert generated.lie_nodes[0].evidence_id in public_ids
    assert generated.lie_nodes[1].evidence_id in generated.lie_nodes[0].unlock_evidence_ids
    assert generated.lie_nodes[2].evidence_id in generated.lie_nodes[1].unlock_evidence_ids
    assert provider.case_calls == 1


def test_generation_replaces_model_fallback_replies_with_controlled_templates(
    repository: CaseRepository,
) -> None:
    raw = json.loads(generated_case_json())
    raw["reply_templates"]["background"] = raw["truth"]["summary"]
    provider = FakeProvider([json.dumps(raw, ensure_ascii=False)], [])

    generated = CaseGenerationService(
        repository,
        provider,
        max_attempts=1,
    ).generate()

    assert generated.reply_templates["background"] == (
        "先把问题说具体。我只会回答已经摆到桌面上的事实。"
    )
    assert generated.truth.summary not in generated.reply_templates["background"]


def test_all_invalid_outputs_fail_without_persisting(
    repository: CaseRepository,
) -> None:
    provider = FakeProvider(["bad", "still bad"], [])
    service = CaseGenerationService(repository, provider, max_attempts=2)

    with pytest.raises(CaseGenerationFailedError):
        service.generate()

    assert provider.case_calls == 2


def test_programmatic_safety_gate_rejects_unsafe_model_content(
    repository: CaseRepository,
) -> None:
    provider = FakeProvider([generated_case_json("血腥现场")], [])
    service = CaseGenerationService(repository, provider, max_attempts=1)

    with pytest.raises(CaseGenerationFailedError):
        service.generate()

    assert provider.case_calls == 1


@pytest.mark.parametrize(
    "raw_output",
    [
        "[]",
        '{"evidence": [1, 2, 3, 4, 5], "lieNodes": [{}, {}, {}]}',
    ],
)
def test_malformed_json_shapes_fail_as_generation_error(
    repository: CaseRepository,
    raw_output: str,
) -> None:
    provider = FakeProvider([raw_output], [])
    service = CaseGenerationService(repository, provider, max_attempts=1)

    with pytest.raises(CaseGenerationFailedError):
        service.generate()

    assert provider.case_calls == 1


@pytest.mark.parametrize(
    "unsafe_title",
    [
        "杀人记录",
        "毒品交接",
        "爆炸物清单",
        "勒死计划",
        "砍伤记录",
        "配制有毒气体",
        "马云的档案",
        "阿里巴巴交接单",
    ],
)
def test_programmatic_safety_gate_rejects_additional_unsafe_terms(
    repository: CaseRepository,
    unsafe_title: str,
) -> None:
    provider = FakeProvider([generated_case_json(unsafe_title)], [])

    with pytest.raises(CaseGenerationFailedError):
        CaseGenerationService(repository, provider, max_attempts=1).generate()
