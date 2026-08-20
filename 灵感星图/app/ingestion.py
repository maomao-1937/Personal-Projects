from __future__ import annotations

from typing import Protocol

from app.domain import Material, MaterialAnalysis, MaterialCreate, MaterialUpdate
from app.repository import Repository
from app.security import HttpUrlFetcher


class MaterialAnalyzer(Protocol):
    model_name: str

    def analyze_material(self, content: str) -> MaterialAnalysis: ...


class ContentFetcher(Protocol):
    def fetch(self, url: str) -> str: ...


class IngestionService:
    def __init__(
        self,
        repository: Repository,
        analyzer: MaterialAnalyzer,
        fetcher: ContentFetcher | None = None,
    ) -> None:
        self.repository = repository
        self.analyzer = analyzer
        self.fetcher = fetcher or HttpUrlFetcher()

    def ingest(self, user_id: str, data: MaterialCreate) -> Material:
        source_url = str(data.source_url) if data.source_url else None
        if data.source_type == "url":
            if source_url is None:
                raise ValueError("source_url is required")
            raw_text = self.fetcher.fetch(source_url)
        else:
            raw_text = data.content or ""

        analysis = self.analyzer.analyze_material(raw_text)
        material = Material(
            user_id=user_id,
            source_type=data.source_type,
            title=data.title,
            raw_text=raw_text,
            source_url=source_url,
            **analysis.model_dump(),
            processing_status="ready",
            model_name=self._public_model_name(),
        )
        return self.repository.add_material(material)

    def update(
        self, user_id: str, material_id, data: MaterialUpdate
    ) -> Material | None:
        existing = self.repository.get_material(user_id, material_id)
        if existing is None:
            return None
        analysis = self.analyzer.analyze_material(data.content)
        updated = existing.model_copy(
            update={
                "title": data.title,
                "raw_text": data.content,
                **analysis.model_dump(),
                "processing_status": "ready",
                "model_name": self._public_model_name(),
            }
        )
        return self.repository.update_material(user_id, material_id, updated)

    def reanalyze(self, user_id: str, material_id) -> Material | None:
        existing = self.repository.get_material(user_id, material_id)
        if existing is None:
            return None
        return self.update(
            user_id,
            material_id,
            MaterialUpdate(title=existing.title, content=existing.raw_text),
        )

    def _public_model_name(self) -> str:
        return (
            "local-fallback"
            if self.analyzer.model_name == "heuristic-v1"
            else "built-in-ai"
        )
