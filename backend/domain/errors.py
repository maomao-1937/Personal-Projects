from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class DomainError(Exception):
    code: str
    message: str
    status_code: int = 400
    retryable: bool = False
    details: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        super().__init__(self.message)
