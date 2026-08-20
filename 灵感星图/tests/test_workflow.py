from uuid import uuid4

import pytest

from app.domain import (
    IncubationRequest,
    MaterialAnalysis,
    ProjectHypothesis,
    SourceContribution,
)
from app.model_gateway import HeuristicModelGateway
from app.retrieval import MaterialRetriever
from app.workflow import IncubationWorkflow, InvalidModelOutput


def test_workflow_keeps_selected_seed_first(repository, material_factory) -> None:
    seed = repository.add_material(
        material_factory(
            title="家庭露营准备问题",
            summary="家庭露营装备容易遗漏",
            problems=["装备遗漏"],
        )
    )
    repository.add_material(
        material_factory(summary="家庭角色分工", mechanisms=["角色分工"])
    )

    class CapturingGateway:
        model_name = "capture"

        def __init__(self) -> None:
            self.material_ids = []
            self.request = None

        def analyze_material(self, content: str) -> MaterialAnalysis:
            raise NotImplementedError

        def generate_hypothesis(self, materials, request) -> ProjectHypothesis:
            self.material_ids = [item.id for item in materials]
            self.request = request
            return ProjectHypothesis(
                status="no_viable_direction",
                reason="需要更多验证",
            )

    gateway = CapturingGateway()
    workflow = IncubationWorkflow(
        repository,
        MaterialRetriever(repository),
        gateway,
    )

    workflow.run("user-a", IncubationRequest(seed_material_id=seed.id))

    assert gateway.material_ids[0] == seed.id
    assert gateway.request.seed_material_id == seed.id
    assert "家庭露营准备问题" in gateway.request.query


def test_workflow_rejects_unknown_seed_material(repository) -> None:
    workflow = IncubationWorkflow(
        repository,
        MaterialRetriever(repository),
        HeuristicModelGateway(),
    )

    with pytest.raises(ValueError, match="seed material not found"):
        workflow.run("user-a", IncubationRequest(seed_material_id=uuid4()))


def test_workflow_rejects_seed_that_is_not_ready(repository, material_factory) -> None:
    seed = repository.add_material(material_factory(processing_status="processing"))
    workflow = IncubationWorkflow(
        repository,
        MaterialRetriever(repository),
        HeuristicModelGateway(),
    )

    with pytest.raises(ValueError, match="seed material is not ready"):
        workflow.run("user-a", IncubationRequest(seed_material_id=seed.id))


def test_workflow_refuses_to_force_a_direction_with_fewer_than_two_materials(
    repository, material_factory
) -> None:
    seed = repository.add_material(material_factory(summary="Only one idea"))
    workflow = IncubationWorkflow(
        repository,
        MaterialRetriever(repository),
        HeuristicModelGateway(),
    )

    result = workflow.run("user-a", IncubationRequest(seed_material_id=seed.id))

    assert result.status == "no_viable_direction"
    assert result.reason
    assert repository.list_hypotheses("user-a") == [result]


def test_workflow_rejects_unknown_material_ids(repository, material_factory) -> None:
    seed = repository.add_material(material_factory(summary="A real problem"))
    repository.add_material(material_factory(summary="A useful mechanism"))

    class ForgingGateway:
        model_name = "forger"

        def analyze_material(self, content: str) -> MaterialAnalysis:
            raise NotImplementedError

        def generate_hypothesis(self, materials, request) -> ProjectHypothesis:
            return ProjectHypothesis(
                status="ready",
                title="Forged",
                one_liner="Uses an unknown source.",
                target_user="Developers",
                problem="Trust",
                source_contributions=[
                    SourceContribution(
                        material_id=materials[0].id,
                        role="problem",
                        contribution="Real source",
                    ),
                    SourceContribution(
                        material_id=uuid4(),
                        role="mechanism",
                        contribution="Invented source",
                    ),
                ],
                relationship_explanation="Invalid relation",
                mvp_scope=["Prototype"],
                first_validation_action="Reject it",
                time_estimate="2 days",
            )

    workflow = IncubationWorkflow(
        repository,
        MaterialRetriever(repository),
        ForgingGateway(),
    )

    with pytest.raises(InvalidModelOutput, match="unknown material"):
        workflow.run("user-a", IncubationRequest(seed_material_id=seed.id))

    assert repository.list_hypotheses("user-a") == []


def test_heuristic_workflow_creates_explainable_hypothesis(
    repository, material_factory
) -> None:
    first = repository.add_material(
        material_factory(
            summary="收藏内容越来越多但不会回看",
            problems=["收藏不回看"],
            topics=["收藏"],
        )
    )
    second = repository.add_material(
        material_factory(
            summary="左右滑动可以快速完成筛选",
            mechanisms=["滑动筛选"],
            topics=["交互"],
        )
    )
    workflow = IncubationWorkflow(
        repository,
        MaterialRetriever(repository),
        HeuristicModelGateway(),
    )

    result = workflow.run(
        "user-a",
        IncubationRequest(seed_material_id=first.id),
    )

    assert result.status == "ready"
    assert {item.material_id for item in result.source_contributions} == {
        first.id,
        second.id,
    }
    assert result.first_validation_action


def test_heuristic_workflow_refuses_materials_without_problem_mechanism_relation(
    repository, material_factory
) -> None:
    seed = repository.add_material(
        material_factory(
            summary="税务记账的颜色偏好",
            problems=[],
            mechanisms=[],
            insights=["蓝色适合财务界面"],
            topics=["财务"],
        )
    )
    repository.add_material(
        material_factory(
            summary="花园灌溉的季节记录",
            problems=[],
            mechanisms=[],
            insights=["春季需要更多水"],
            topics=["园艺"],
        )
    )
    workflow = IncubationWorkflow(
        repository,
        MaterialRetriever(repository),
        HeuristicModelGateway(),
    )

    result = workflow.run("user-a", IncubationRequest(seed_material_id=seed.id))

    assert result.status == "no_viable_direction"


def test_heuristic_workflow_builds_exploratory_family_camping_direction(
    repository, material_factory
) -> None:
    scenario = repository.add_material(
        material_factory(
            summary="家庭露营时需要共同准备装备",
            actors=["家庭露营用户"],
            insights=["一家人共同出行"],
            topics=["家庭露营"],
        )
    )
    mechanism = repository.add_material(
        material_factory(
            summary="可以根据不同家庭角色分工并完成打卡",
            insights=["角色分工"],
            topics=["家庭露营", "角色分工"],
        )
    )
    workflow = IncubationWorkflow(
        repository,
        MaterialRetriever(repository),
        HeuristicModelGateway(),
    )

    result = workflow.run("user-a", IncubationRequest(seed_material_id=scenario.id))

    assert result.status == "ready"
    assert {item.material_id for item in result.source_contributions} == {
        scenario.id,
        mechanism.id,
    }
    assert "需要验证" in (result.problem or "")
