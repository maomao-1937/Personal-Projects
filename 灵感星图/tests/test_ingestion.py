from app.domain import MaterialAnalysis, MaterialCreate
from app.ingestion import IngestionService


class FakeAnalyzer:
    model_name = "fake-analyzer"

    def analyze_material(self, content: str) -> MaterialAnalysis:
        assert content == "做饭时双手被占用，无法操作菜谱。"
        return MaterialAnalysis(
            summary="做饭时无法触屏操作菜谱",
            organized_text="做饭时双手被占用，用户需要一种无需触屏即可查看菜谱步骤的方式。",
            material_type="problem",
            actors=["在家做饭的人"],
            problems=["双手被占用时无法操作手机"],
            mechanisms=[],
            insights=["需要免手操作"],
            topics=["做饭", "语音交互"],
        )


def test_ingestion_preserves_raw_content_and_structures_material(repository) -> None:
    service = IngestionService(repository, FakeAnalyzer())

    material = service.ingest(
        "user-a",
        MaterialCreate(
            source_type="text",
            content="做饭时双手被占用，无法操作菜谱。",
        ),
    )

    assert material.raw_text == "做饭时双手被占用，无法操作菜谱。"
    assert material.organized_text == (
        "做饭时双手被占用，用户需要一种无需触屏即可查看菜谱步骤的方式。"
    )
    assert material.problems == ["双手被占用时无法操作手机"]
    assert material.processing_status == "ready"
    assert material.model_name == "built-in-ai"
    assert repository.get_material("user-a", material.id) == material


def test_url_ingestion_uses_injected_fetcher(repository) -> None:
    class FakeFetcher:
        def fetch(self, url: str) -> str:
            assert url == "https://example.com/recipe"
            return "做饭时双手被占用，无法操作菜谱。"

    service = IngestionService(repository, FakeAnalyzer(), fetcher=FakeFetcher())
    material = service.ingest(
        "user-a",
        MaterialCreate(
            source_type="url",
            source_url="https://example.com/recipe",
        ),
    )

    assert material.source_url == "https://example.com/recipe"
    assert material.raw_text.startswith("做饭时")
