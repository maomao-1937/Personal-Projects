from __future__ import annotations

import hashlib
import os
import secrets
from dataclasses import dataclass
from pathlib import Path

from backend.domain.errors import DomainError


@dataclass(frozen=True, slots=True)
class StoredFile:
    key: str
    path: Path
    bytes: int
    sha256: str


class LocalArtifactStore:
    def __init__(self, root: str | Path) -> None:
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def resolve(self, key: str) -> Path:
        if not key or Path(key).is_absolute():
            raise DomainError("invalid_artifact_path", "Artifact 路径不合法。")
        candidate = (self.root / key).resolve()
        if not candidate.is_relative_to(self.root):
            raise DomainError("invalid_artifact_path", "Artifact 路径不合法。")
        return candidate

    def put_bytes(self, key: str, data: bytes) -> StoredFile:
        target = self.resolve(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_name(f".{target.name}.{secrets.token_hex(4)}.tmp")
        try:
            with temporary.open("xb") as output:
                output.write(data)
                output.flush()
                os.fsync(output.fileno())
            os.replace(temporary, target)
        finally:
            temporary.unlink(missing_ok=True)
        return StoredFile(
            key=key,
            path=target,
            bytes=len(data),
            sha256=hashlib.sha256(data).hexdigest(),
        )

