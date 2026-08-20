from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.domain import MaterialCreate, ProjectHypothesis, SourceContribution


def test_text_material_requires_non_empty_content() -> None:
    with pytest.raises(ValidationError, match="content"):
        MaterialCreate(source_type="text", title="empty")


def test_url_material_requires_http_url() -> None:
    with pytest.raises(ValidationError, match="source_url"):
        MaterialCreate(source_type="url", source_url="file:///etc/passwd")


def test_ready_hypothesis_requires_at_least_two_source_contributions() -> None:
    contribution = SourceContribution(
        material_id=uuid4(),
        role="problem",
        contribution="A real user problem.",
    )

    with pytest.raises(ValidationError, match="at least 2"):
        ProjectHypothesis(
            status="ready",
            title="One-source idea",
            one_liner="Not sufficiently grounded.",
            target_user="Independent developers",
            problem="Too little evidence",
            source_contributions=[contribution],
            relationship_explanation="Only one source exists.",
            mvp_scope=["Prototype"],
            non_goals=[],
            first_validation_action="Interview one user",
            time_estimate="2 days",
            risks=["Weak evidence"],
        )


def test_no_viable_direction_requires_a_reason() -> None:
    with pytest.raises(ValidationError, match="reason"):
        ProjectHypothesis(status="no_viable_direction")


def test_no_viable_direction_cannot_carry_source_contributions() -> None:
    contribution = SourceContribution(
        material_id=uuid4(), role="problem", contribution="A source"
    )

    with pytest.raises(ValidationError, match="must not include"):
        ProjectHypothesis(
            status="no_viable_direction",
            reason="The relation is weak.",
            source_contributions=[contribution],
        )


def test_ready_hypothesis_rejects_blank_semantic_fields() -> None:
    contributions = [
        SourceContribution(material_id=uuid4(), role="problem", contribution="Problem"),
        SourceContribution(
            material_id=uuid4(), role="mechanism", contribution="Mechanism"
        ),
    ]

    with pytest.raises(ValidationError, match="blank"):
        ProjectHypothesis(
            status="ready",
            title="   ",
            one_liner="   ",
            target_user="   ",
            problem="   ",
            source_contributions=contributions,
            relationship_explanation="   ",
            mvp_scope=["   "],
            first_validation_action="   ",
            time_estimate="   ",
        )


def test_domain_models_reject_unknown_fields() -> None:
    with pytest.raises(ValidationError, match="extra"):
        MaterialCreate(
            source_type="text",
            content="real content",
            unexpected="not allowed",
        )
