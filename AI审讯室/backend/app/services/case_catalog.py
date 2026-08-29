from __future__ import annotations

from app.domain.case_001 import MANUAL_CASE
from app.domain.case_models import CaseSnapshot
from app.repositories.cases import CaseRepository


class CaseCatalog:
    """Resolve the built-in fallback and persisted generated snapshots."""

    def __init__(self, repository: CaseRepository) -> None:
        self.repository = repository

    def get(self, case_id: str) -> CaseSnapshot | None:
        if case_id == MANUAL_CASE.case_id:
            return MANUAL_CASE
        return self.repository.get(case_id)
