from __future__ import annotations

from app.domain import IncubationRequest, ProjectHypothesis
from app.model_gateway import ModelGateway
from app.repository import Repository
from app.retrieval import MaterialRetriever


class InvalidModelOutput(ValueError):
    pass


class SeedMaterialNotFound(ValueError):
    pass


class SeedMaterialNotReady(ValueError):
    pass


class IncubationWorkflow:
    """Fixed orchestration: retrieve, gate, generate, validate, persist."""

    def __init__(
        self,
        repository: Repository,
        retriever: MaterialRetriever,
        model_gateway: ModelGateway,
        retrieval_limit: int = 12,
    ) -> None:
        self.repository = repository
        self.retriever = retriever
        self.model_gateway = model_gateway
        self.retrieval_limit = retrieval_limit

    def run(self, user_id: str, request: IncubationRequest) -> ProjectHypothesis:
        seed = self.repository.get_material(user_id, request.seed_material_id)
        if seed is None:
            raise SeedMaterialNotFound("seed material not found")
        if seed.processing_status != "ready":
            raise SeedMaterialNotReady("seed material is not ready")

        query = f"{seed.title or ''} {seed.summary}".strip()[:500]
        seeded_request = request.model_copy(
            update={"query": query or "围绕核心素材生成一个周末项目"}
        )
        candidates = self.retriever.search_from_seed(
            user_id,
            seed,
            limit=self.retrieval_limit,
        )
        excluded = {topic.casefold() for topic in request.constraints.excluded_topics}
        if excluded:
            candidates = [
                material
                for material in candidates
                if material.id == seed.id
                or not excluded.intersection(
                    topic.casefold() for topic in material.topics
                )
            ]

        if len(candidates) < 2:
            result = ProjectHypothesis(
                status="no_viable_direction",
                query=seeded_request.query,
                reason="至少需要 2 条可用素材，当前没有足够依据形成可靠方向。",
            )
            return self.repository.save_hypothesis(user_id, result)

        result = self.model_gateway.generate_hypothesis(
            candidates, seeded_request
        ).model_copy(update={"query": seeded_request.query})
        if result.status == "no_viable_direction":
            return self.repository.save_hypothesis(user_id, result)

        known_ids = {material.id for material in candidates}
        cited_ids = {item.material_id for item in result.source_contributions}
        unknown_ids = cited_ids - known_ids
        if unknown_ids:
            raise InvalidModelOutput(
                "model referenced unknown material IDs: "
                + ", ".join(sorted(str(item) for item in unknown_ids))
            )
        if seed.id not in cited_ids:
            raise InvalidModelOutput("model did not cite seed material")
        return self.repository.save_hypothesis(user_id, result)
