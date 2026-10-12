from __future__ import annotations

from app.domain.case_001 import MANUAL_CASE
from app.domain.case_refined_v2 import REFINED_CASE_V2
from app.domain.case_models import CaseSnapshot
from app.repositories.cases import CaseRepository


class CaseCatalog:
    """Resolve the built-in fallback and persisted generated snapshots."""

    def __init__(self, repository: CaseRepository) -> None:
        self.repository = repository

    def get(self, case_id: str) -> CaseSnapshot | None:
        if case_id == REFINED_CASE_V2.case_id:
            return REFINED_CASE_V2
        if case_id == MANUAL_CASE.case_id:
            return MANUAL_CASE
        return self.repository.get(case_id)

    def list(self, *, include_generated: bool = True) -> list[CaseSnapshot]:
        built_ins = [REFINED_CASE_V2, MANUAL_CASE]
        if not include_generated:
            return built_ins
        built_in_ids = {item.case_id for item in built_ins}
        generated = [
            item
            for item in self.repository.list_recent()
            if item.case_id not in built_in_ids
        ]
        return [*built_ins, *generated]
