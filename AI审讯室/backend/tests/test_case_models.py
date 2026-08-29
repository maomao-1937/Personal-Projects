from copy import deepcopy
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.core.database import Database
from app.domain.case_001 import CASE_001
from app.domain.case_models import CaseSnapshot
from app.repositories.cases import CaseAlreadyExistsError, CaseRepository


def valid_case_payload() -> dict:
    payload = deepcopy(CASE_001)
    payload.update(
        {
            "schema_version": 1,
            "case_id": "case_test_001",
            "case_code": "CASE-T001",
            "source": "llm",
            "model_name": "fake-case-model",
        }
    )
    return payload


def test_case_snapshot_rejects_duplicate_evidence_ids() -> None:
    payload = valid_case_payload()
    payload["evidence"][1]["id"] = "E01"

    with pytest.raises(ValidationError, match="evidence ids must be unique"):
        CaseSnapshot.model_validate(payload)


def test_case_snapshot_rejects_dangling_lie_evidence_reference() -> None:
    payload = valid_case_payload()
    payload["lie_nodes"][0]["evidence_id"] = "E99"

    with pytest.raises(ValidationError, match="unknown evidence"):
        CaseSnapshot.model_validate(payload)


def test_case_snapshot_requires_exactly_two_public_evidence_items() -> None:
    payload = valid_case_payload()
    payload["evidence"][2]["public"] = True

    with pytest.raises(ValidationError, match="exactly 2 public evidence"):
        CaseSnapshot.model_validate(payload)


def test_case_snapshot_rejects_an_unreachable_evidence_chain() -> None:
    payload = valid_case_payload()
    payload["lie_nodes"][0].update(
        {"evidence_id": "E03", "unlock_evidence_ids": ["E04"]}
    )
    payload["lie_nodes"][1].update(
        {"evidence_id": "E04", "unlock_evidence_ids": ["E05"]}
    )
    payload["lie_nodes"][2].update(
        {"evidence_id": "E05", "unlock_evidence_ids": ["E03"]}
    )

    with pytest.raises(ValidationError, match="evidence chain is unreachable"):
        CaseSnapshot.model_validate(payload)


def test_case_snapshot_rejects_shared_lie_evidence_and_unknown_topics() -> None:
    shared = valid_case_payload()
    shared["lie_nodes"][1]["evidence_id"] = shared["lie_nodes"][0]["evidence_id"]
    with pytest.raises(ValidationError, match="distinct evidence"):
        CaseSnapshot.model_validate(shared)

    unknown_topic = valid_case_payload()
    unknown_topic["lie_nodes"][0]["topics"] = ["随机概念"]
    with pytest.raises(ValidationError, match="controlled Chinese concepts"):
        CaseSnapshot.model_validate(unknown_topic)


@pytest.mark.parametrize("keyword", ["", " ", "一"])
def test_case_snapshot_rejects_unsafe_soft_spot_keywords(keyword: str) -> None:
    payload = valid_case_payload()
    payload["suspect"]["soft_spot_keywords"] = [keyword]

    with pytest.raises(ValidationError, match="soft spot keywords"):
        CaseSnapshot.model_validate(payload)


def test_case_snapshot_keeps_soft_spot_acknowledgement_generalized() -> None:
    payload = valid_case_payload()
    payload["suspect"]["soft_spot_acknowledgement"] = payload["suspect"]["soft_spot"]

    with pytest.raises(ValidationError, match="must not reveal private soft spot"):
        CaseSnapshot.model_validate(payload)

    punctuation_variant = valid_case_payload()
    punctuation_variant["suspect"]["soft_spot_acknowledgement"] = (
        punctuation_variant["suspect"]["soft_spot"].rstrip("。")
    )
    with pytest.raises(ValidationError, match="must not reveal private soft spot"):
        CaseSnapshot.model_validate(punctuation_variant)


def test_case_snapshot_rejects_non_12_plus_rating_and_empty_template() -> None:
    invalid_rating = valid_case_payload()
    invalid_rating["content_rating"] = "18+"
    with pytest.raises(ValidationError):
        CaseSnapshot.model_validate(invalid_rating)

    empty_template = valid_case_payload()
    empty_template["reply_templates"]["background"] = ""
    with pytest.raises(ValidationError, match="reply template length"):
        CaseSnapshot.model_validate(empty_template)


def test_public_projection_excludes_private_truth_and_soft_spot() -> None:
    snapshot = CaseSnapshot.model_validate(valid_case_payload())

    public = snapshot.public_payload()

    assert len(public["evidence"]) == 2
    assert "truth" not in public
    assert "lieNodes" not in public
    assert "replyTemplates" not in public
    assert "softSpot" not in public["suspect"]
    assert "softSpotKeywords" not in public["suspect"]
    assert "softSpotAcknowledgement" not in public["suspect"]
    assert public["caseId"] == "case_test_001"
    assert public["generationSource"] == "llm"


def test_repository_round_trips_private_case_and_is_immutable(tmp_path: Path) -> None:
    database = Database(f"sqlite:///{tmp_path / 'cases.db'}")
    database.create_schema()
    repository = CaseRepository(database)
    snapshot = CaseSnapshot.model_validate(valid_case_payload())

    repository.create(snapshot)

    assert repository.get(snapshot.case_id) == snapshot
    with pytest.raises(CaseAlreadyExistsError):
        repository.create(snapshot)
