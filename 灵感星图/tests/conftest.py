from collections.abc import Callable, Iterator

import pytest

from app.domain import Material
from app.repository import Repository


@pytest.fixture
def repository() -> Iterator[Repository]:
    repo = Repository("sqlite+pysqlite:///:memory:")
    repo.create_schema()
    try:
        yield repo
    finally:
        repo.close()


@pytest.fixture
def material_factory() -> Callable[..., Material]:
    def make_material(**overrides) -> Material:
        values = {
            "user_id": "user-a",
            "source_type": "text",
            "title": "Saved idea",
            "raw_text": "A useful saved thought",
            "summary": "A useful saved thought",
            "material_type": "insight",
            "topics": ["product"],
            "processing_status": "ready",
        }
        values.update(overrides)
        return Material(**values)

    return make_material
