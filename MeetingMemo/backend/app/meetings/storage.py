import os
from contextlib import suppress
from dataclasses import dataclass
from pathlib import Path
from tempfile import NamedTemporaryFile
from uuid import UUID


def _meeting_directory(root: Path, meeting_id: str) -> Path:
    normalized_id = str(UUID(meeting_id))
    resolved_root = root.expanduser().resolve()
    meeting_directory = (resolved_root / normalized_id).resolve()
    if meeting_directory.parent != resolved_root:
        raise ValueError("meeting asset path escaped its configured root")
    return meeting_directory


@dataclass(slots=True)
class StagedTranscript:
    temporary_path: Path
    final_path: Path

    def commit(self) -> Path:
        os.replace(self.temporary_path, self.final_path)
        for existing in self.final_path.parent.glob("source.*"):
            if existing != self.final_path:
                existing.unlink(missing_ok=True)
        self.final_path.chmod(0o600)
        return self.final_path

    def discard(self) -> None:
        self.temporary_path.unlink(missing_ok=True)
        with suppress(OSError):
            self.temporary_path.parent.rmdir()


class LocalTranscriptStorage:
    def __init__(self, root: Path) -> None:
        self.root = root

    def stage(self, meeting_id: str, suffix: str, content: bytes) -> StagedTranscript:
        meeting_directory = _meeting_directory(self.root, meeting_id)
        meeting_directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        with NamedTemporaryFile(
            mode="wb",
            prefix=".source-",
            suffix=".tmp",
            dir=meeting_directory,
            delete=False,
        ) as temporary:
            temporary.write(content)
            temporary.flush()
            os.fsync(temporary.fileno())
            temporary_path = Path(temporary.name)
        temporary_path.chmod(0o600)
        return StagedTranscript(
            temporary_path=temporary_path,
            final_path=meeting_directory / f"source{suffix.lower()}",
        )

    def delete_meeting_assets(self, meeting_id: str) -> None:
        meeting_directory = _meeting_directory(self.root, meeting_id)
        if not meeting_directory.exists():
            return
        if meeting_directory.is_symlink():
            raise RuntimeError("meeting asset directory must not be a symlink")
        for child in meeting_directory.iterdir():
            if child.is_dir() and not child.is_symlink():
                raise RuntimeError("unexpected nested meeting asset directory")
            child.unlink()
        meeting_directory.rmdir()
