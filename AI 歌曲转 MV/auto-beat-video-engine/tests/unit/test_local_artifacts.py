import pytest

from backend.domain.errors import DomainError
from backend.storage.local_artifacts import LocalArtifactStore


def test_artifact_store_rejects_parent_path(tmp_path) -> None:
    store = LocalArtifactStore(tmp_path / "artifacts")

    with pytest.raises(DomainError) as caught:
        store.resolve("../secret")

    assert caught.value.code == "invalid_artifact_path"


def test_artifact_store_writes_inside_root_atomically(tmp_path) -> None:
    store = LocalArtifactStore(tmp_path / "artifacts")

    stored = store.put_bytes("prj_1/audio/source.wav", b"media")

    assert stored.path == (tmp_path / "artifacts/prj_1/audio/source.wav").resolve()
    assert stored.path.read_bytes() == b"media"
    assert stored.sha256
