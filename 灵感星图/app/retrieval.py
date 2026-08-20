from __future__ import annotations

import re

from app.domain import Material
from app.repository import Repository

TOKEN_RE = re.compile(r"[a-zA-Z0-9]+|[\u4e00-\u9fff]+")
GENERIC_DISCOVERY_QUERIES = {
    "给我一个周末项目",
    "生成一个周末项目",
    "周末项目",
    "project idea",
    "weekend project",
}


def _tokens(text: str) -> set[str]:
    result: set[str] = set()
    for match in TOKEN_RE.findall(text.lower()):
        if match.isascii():
            result.add(match)
            continue
        if len(match) == 1:
            result.add(match)
        else:
            result.update(match[index : index + 2] for index in range(len(match) - 1))
    return result


def _searchable_text(material: Material) -> str:
    fields = [
        material.title or "",
        material.summary,
        material.organized_text or "",
        *material.actors,
        *material.problems,
        *material.mechanisms,
        *material.insights,
        *material.topics,
    ]
    return " ".join(fields)


class MaterialRetriever:
    """Small MVP retriever whose interface can later be backed by pgvector."""

    def __init__(self, repository: Repository) -> None:
        self.repository = repository

    def search(self, user_id: str, query: str, limit: int = 12) -> list[Material]:
        materials = [
            material
            for material in self.repository.list_materials(user_id)
            if material.processing_status == "ready"
        ]
        query_tokens = _tokens(query)
        scored = [
            (len(query_tokens & _tokens(_searchable_text(material))), material)
            for material in materials
        ]
        matches = [(score, material) for score, material in scored if score > 0]
        if not matches and query.strip().casefold() in GENERIC_DISCOVERY_QUERIES:
            return materials[:limit]
        if not matches:
            return []
        matches.sort(key=lambda item: (-item[0], str(item[1].id)))
        return [material for _, material in matches[:limit]]

    def search_from_seed(
        self,
        user_id: str,
        seed: Material,
        limit: int = 12,
    ) -> list[Material]:
        if limit < 1:
            return []
        seed_tokens = _tokens(_searchable_text(seed))
        others = [
            material
            for material in self.repository.list_materials(user_id)
            if material.processing_status == "ready" and material.id != seed.id
        ]
        ranked = sorted(
            others,
            key=lambda material: (
                -len(seed_tokens & _tokens(_searchable_text(material))),
                str(material.id),
            ),
        )
        return [seed, *ranked[: limit - 1]]
