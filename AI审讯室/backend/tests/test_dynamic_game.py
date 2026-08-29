from copy import deepcopy
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Event

import pytest

from app.core.database import Database
from app.domain.case_001 import CASE_001
from app.domain.case_models import snapshot_from_legacy
from app.llm.provider import LLMProviderError
from app.repositories.cases import CaseRepository
from app.repositories.sessions import SessionRepository, TurnRequestRecord
from app.services.case_catalog import CaseCatalog
from app.services.game import GameService, SessionConflictError
from app.services.responder import SuspectResponder


class FakeDialogueProvider:
    configured = True
    case_model = "fake-case-model"

    def __init__(self, *, fail: bool = False) -> None:
        self.fail = fail
        self.reply_calls = 0
        self.last_prompt = ""

    def generate_case_json(self, prompt: str) -> str:
        raise AssertionError("case generation is not expected")

    def review_case_json(self, prompt: str) -> str:
        raise AssertionError("case review is not expected")

    def generate_reply(self, prompt: str) -> str:
        self.reply_calls += 1
        self.last_prompt = prompt
        assert "不主动认罪" in prompt
        if self.fail:
            raise LLMProviderError("simulated reply failure")
        return "承认自己手动暂停了监控，但声称只是例行检修。我没有拿走任何东西。"


class BlockingDialogueProvider(FakeDialogueProvider):
    def __init__(self) -> None:
        super().__init__()
        self.started = Event()
        self.release = Event()

    def generate_reply(self, prompt: str) -> str:
        self.reply_calls += 1
        self.started.set()
        assert self.release.wait(timeout=5)
        return "我承认这条局部记录，但它不能证明整件事都是我做的。"


class UnsafeDialogueProvider(FakeDialogueProvider):
    def __init__(self, reply: str) -> None:
        super().__init__()
        self.unsafe_reply = reply

    def generate_reply(self, prompt: str) -> str:
        self.reply_calls += 1
        return self.unsafe_reply


def dynamic_case():
    payload = deepcopy(CASE_001)
    payload["lie_nodes"][0]["evidence_id"] = "E01"
    payload["lie_nodes"][0]["topics"] = ["监控"]
    payload["lie_nodes"][0]["acknowledgement"] = (
        "承认自己手动暂停了监控，但声称只是例行检修。"
    )
    return snapshot_from_legacy(
        payload,
        case_id="case_dynamic_service",
        case_code="CASE-DSVC",
        source="llm",
        model_name="fake-case-model",
    )


def build_service(tmp_path: Path, provider: FakeDialogueProvider) -> GameService:
    database = Database(f"sqlite:///{tmp_path / 'dynamic.db'}")
    database.create_schema()
    cases = CaseRepository(database)
    cases.create(dynamic_case())
    return GameService(
        SessionRepository(database),
        CaseCatalog(cases),
        SuspectResponder(provider),
    )


def test_reply_failure_uses_template_without_changing_rule_result(
    tmp_path: Path,
) -> None:
    provider = FakeDialogueProvider(fail=True)
    service = build_service(tmp_path, provider)
    session = service.create_session("case_dynamic_service")

    result = service.submit_turn(
        session.session_id,
        "监控为什么在案发时被暂停？",
        "calm",
        "E01",
        "req_dynamic_fail_1",
    )

    assert result.evidence_effect == "effective"
    assert result.reply == dynamic_case().reply_templates["effective_L01"]
    assert provider.reply_calls == 1


def test_same_request_id_does_not_call_reply_provider_twice(
    tmp_path: Path,
) -> None:
    provider = FakeDialogueProvider()
    service = build_service(tmp_path, provider)
    session = service.create_session("case_dynamic_service")
    arguments = (
        session.session_id,
        "监控为什么在案发时被暂停？",
        "calm",
        "E01",
        "req_dynamic_same_1",
    )

    first = service.submit_turn(*arguments)
    replay = service.submit_turn(*arguments)

    assert replay == first
    assert first.reply.startswith("承认自己手动暂停了监控")
    assert provider.reply_calls == 1
    assert dynamic_case().truth.summary not in provider.last_prompt
    assert dynamic_case().suspect.soft_spot not in provider.last_prompt
    assert dynamic_case().evidence[-1].description not in provider.last_prompt


def test_concurrent_same_request_id_reserves_before_model_call(
    tmp_path: Path,
) -> None:
    provider = BlockingDialogueProvider()
    service = build_service(tmp_path, provider)
    session = service.create_session("case_dynamic_service")
    arguments = (
        session.session_id,
        "监控为什么在案发时被暂停？",
        "calm",
        "E01",
        "req_dynamic_concurrent_1",
    )

    with ThreadPoolExecutor(max_workers=2) as executor:
        first_future = executor.submit(service.submit_turn, *arguments)
        assert provider.started.wait(timeout=5)
        with pytest.raises(SessionConflictError):
            service.submit_turn(*arguments)
        assert provider.reply_calls == 1
        provider.release.set()
        first = first_future.result(timeout=5)

    replay = service.submit_turn(*arguments)
    assert replay == first
    assert provider.reply_calls == 1


def test_stale_pending_request_can_be_reclaimed(tmp_path: Path) -> None:
    provider = FakeDialogueProvider()
    service = build_service(tmp_path, provider)
    session = service.create_session("case_dynamic_service")
    repository = service.repository
    request_id = "req_stale_pending_1"
    assert repository.claim_turn_request(session.session_id, request_id)

    with repository.database.session() as db_session:
        record = db_session.get(
            TurnRequestRecord,
            (session.session_id, request_id),
        )
        assert record is not None
        record.created_at = datetime.now(timezone.utc) - timedelta(minutes=5)

    result = service.submit_turn(
        session.session_id,
        "监控为什么在案发时被暂停？",
        "calm",
        "E01",
        request_id,
    )

    assert result.evidence_effect == "effective"
    assert provider.reply_calls == 1


@pytest.mark.parametrize(
    "unsafe_reply",
    [
        "是我干的，所有事情都是我安排的。",
        CASE_001["evidence"][4]["description"],
    ],
)
def test_unsafe_character_reply_falls_back_to_rule_template(
    tmp_path: Path,
    unsafe_reply: str,
) -> None:
    provider = UnsafeDialogueProvider(unsafe_reply)
    service = build_service(tmp_path, provider)
    session = service.create_session("case_dynamic_service")

    result = service.submit_turn(
        session.session_id,
        "请说明你的日常工作。",
        "calm",
        None,
        f"req_unsafe_{len(unsafe_reply)}",
    )

    assert result.reply == dynamic_case().reply_templates["background"]
    assert provider.reply_calls == 1
