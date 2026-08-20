import pytest

from app.domain import FeedbackCreate, ProjectHypothesis, SourceContribution


def test_material_queries_are_scoped_to_user(repository, material_factory) -> None:
    material = repository.add_material(material_factory(user_id="user-a"))

    assert repository.get_material("user-a", material.id) == material
    assert repository.get_material("user-b", material.id) is None
    assert repository.list_materials("user-b") == []


def test_hypotheses_and_feedback_are_scoped_to_owner(
    repository, material_factory
) -> None:
    first = repository.add_material(material_factory(user_id="user-a"))
    second = repository.add_material(material_factory(user_id="user-a"))
    hypothesis = ProjectHypothesis(
        user_id="user-a",
        status="ready",
        title="A small project",
        one_liner="Combine two saved materials.",
        target_user="Independent developers",
        problem="Ideas are not advanced",
        source_contributions=[
            SourceContribution(
                material_id=first.id, role="problem", contribution="The problem"
            ),
            SourceContribution(
                material_id=second.id, role="mechanism", contribution="The mechanism"
            ),
        ],
        relationship_explanation="The mechanism addresses the problem.",
        mvp_scope=["One workflow"],
        first_validation_action="Show it to one developer",
        time_estimate="2 days",
    )
    stored = repository.save_hypothesis("user-a", hypothesis)

    assert repository.list_hypotheses("user-a") == [stored]
    assert repository.list_hypotheses("user-b") == []
    assert (
        repository.add_feedback(
            "user-b",
            stored.id,
            FeedbackCreate(category="worth_doing"),
        )
        is None
    )
    feedback = repository.add_feedback(
        "user-a",
        stored.id,
        FeedbackCreate(category="worth_doing", note="I would build this."),
    )
    assert feedback is not None
    assert feedback.user_id == "user-a"


def test_repository_rejects_cross_tenant_source_references(
    repository, material_factory
) -> None:
    own = repository.add_material(material_factory(user_id="user-a"))
    foreign = repository.add_material(material_factory(user_id="user-b"))
    hypothesis = ProjectHypothesis(
        status="ready",
        title="Cross-tenant idea",
        one_liner="Must not be saved.",
        target_user="Developers",
        problem="Data isolation",
        source_contributions=[
            SourceContribution(
                material_id=own.id, role="problem", contribution="Own source"
            ),
            SourceContribution(
                material_id=foreign.id,
                role="mechanism",
                contribution="Foreign source",
            ),
        ],
        relationship_explanation="Invalid cross-tenant relation",
        mvp_scope=["Reject save"],
        first_validation_action="Run boundary test",
        time_estimate="1 day",
    )

    with pytest.raises(ValueError, match="do not belong"):
        repository.save_hypothesis("user-a", hypothesis)
