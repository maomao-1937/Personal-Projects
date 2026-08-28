from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class User:
    id: str
    status: str
    created_at: str


@dataclass(frozen=True, slots=True)
class Project:
    id: str
    owner_id: str
    name: str
    current_timeline_version_id: str | None
    created_at: str
    updated_at: str

