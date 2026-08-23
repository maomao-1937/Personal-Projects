import json

import httpx
import pytest

from app.core.errors import DomainError
from app.summaries.pipeline import SummaryPipeline, validate_summary
from app.summaries.providers import (
    MockSummaryProvider,
    OpenAICompatibleSummaryProvider,
)
from app.summaries.schemas import (
    ActionItem,
    Decision,
    PromptSegment,
    SummaryPayload,
    Topic,
)


def valid_summary() -> SummaryPayload:
    return SummaryPayload(
        summary_version="1.0",
        headline="The team approved the launch.",
        topics=[
            Topic(
                title="Launch",
                summary="The release plan was reviewed.",
                source_segment_ids=["seg_1"],
            )
        ],
        decisions=[
            Decision(
                text="Launch on Friday.",
                source_segment_ids=["seg_1"],
                confidence="high",
            )
        ],
        action_items=[
            ActionItem(
                task="Prepare the checklist.",
                owner="Alice",
                due_date=None,
                source_segment_ids=["seg_2"],
                confidence="high",
            )
        ],
        open_questions=[],
        quality_flags=[],
    )


def prompt_segments(count: int = 2) -> list[PromptSegment]:
    return [
        PromptSegment(
            id=f"seg_{index + 1}",
            sequence=index,
            speaker="Alice" if index % 2 == 0 else "Bob",
            text=("Decision and follow-up details. " * 3).strip(),
        )
        for index in range(count)
    ]


def test_quality_gate_rejects_unknown_segment():
    summary = valid_summary()
    summary.decisions[0].source_segment_ids = ["seg_missing"]

    with pytest.raises(DomainError) as error:
        validate_summary(summary, {"seg_1", "seg_2"}, {"Alice", "Bob"})

    assert error.value.code == "SUMMARY_SOURCE_INVALID"


def test_quality_gate_rejects_unknown_owner():
    summary = valid_summary()
    summary.action_items[0].owner = "Mallory"

    with pytest.raises(DomainError) as error:
        validate_summary(summary, {"seg_1", "seg_2"}, {"Alice", "Bob"})

    assert error.value.code == "SUMMARY_OWNER_INVALID"


class RecordingProvider:
    def __init__(self) -> None:
        self.extract_calls = 0
        self.merge_calls = 0

    def extract(self, segments: list[PromptSegment]) -> SummaryPayload:
        self.extract_calls += 1
        source_id = segments[0].id
        return SummaryPayload(
            summary_version="1.0",
            headline=f"Chunk {self.extract_calls}",
            topics=[
                Topic(
                    title="Chunk",
                    summary="Chunk summary",
                    source_segment_ids=[source_id],
                )
            ],
            decisions=[],
            action_items=[],
            open_questions=[],
            quality_flags=[],
        )

    def merge(self, partials: list[SummaryPayload]) -> SummaryPayload:
        self.merge_calls += 1
        source_ids = [item.topics[0].source_segment_ids[0] for item in partials]
        return SummaryPayload(
            summary_version="1.0",
            headline="Merged",
            topics=[
                Topic(
                    title="All chunks",
                    summary="Merged summary",
                    source_segment_ids=source_ids,
                )
            ],
            decisions=[],
            action_items=[],
            open_questions=[],
            quality_flags=[],
        )


def test_long_transcript_uses_map_reduce():
    provider = RecordingProvider()

    result = SummaryPipeline(provider, chunk_chars=100).run(prompt_segments(4))

    assert provider.extract_calls == 4
    assert provider.merge_calls == 1
    assert result.headline == "Merged"


def test_short_transcript_uses_one_extract_call():
    provider = RecordingProvider()

    result = SummaryPipeline(provider, chunk_chars=10_000).run(prompt_segments(2))

    assert provider.extract_calls == 1
    assert provider.merge_calls == 0
    assert result.headline == "Chunk 1"


def test_pipeline_rejects_cross_chunk_source_reference():
    class CrossChunkProvider(RecordingProvider):
        def extract(self, segments: list[PromptSegment]) -> SummaryPayload:
            self.extract_calls += 1
            summary = super().extract(segments)
            summary.topics[0].source_segment_ids = ["seg_1"]
            return summary

    provider = CrossChunkProvider()

    with pytest.raises(DomainError) as error:
        SummaryPipeline(provider, chunk_chars=100).run(prompt_segments(2))

    assert error.value.code == "SUMMARY_SOURCE_INVALID"
    assert provider.merge_calls == 0


def test_pipeline_rejects_obviously_short_transcript():
    provider = RecordingProvider()
    segments = [PromptSegment(id="seg_1", sequence=0, text="ok")]

    with pytest.raises(DomainError) as error:
        SummaryPipeline(provider).run(segments)

    assert error.value.code == "TRANSCRIPT_TOO_SHORT"
    assert provider.extract_calls == 0


def test_openai_provider_retries_rate_limit_then_parses_json():
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return httpx.Response(429, json={"error": {"message": "slow down"}})
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": json.dumps(valid_summary().model_dump())}}]},
        )

    client = httpx.Client(transport=httpx.MockTransport(handler))
    provider = OpenAICompatibleSummaryProvider(
        api_key="secret",
        base_url="https://llm.example/v1",
        model="summary-model",
        client=client,
        sleep=lambda _: None,
    )

    result = provider.extract(prompt_segments())

    assert result.headline == "The team approved the launch."
    assert attempts == 2


def test_openai_provider_does_not_retry_authentication_failure():
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        return httpx.Response(401, json={"error": {"message": "bad key"}})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    provider = OpenAICompatibleSummaryProvider(
        api_key="bad-secret",
        base_url="https://llm.example/v1",
        model="summary-model",
        client=client,
        sleep=lambda _: None,
    )

    with pytest.raises(DomainError) as error:
        provider.extract(prompt_segments())

    assert error.value.code == "LLM_AUTH_FAILED"
    assert attempts == 1


def test_openai_merge_marks_partial_summary_order():
    captured_payload: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        captured_payload.update(json.loads(body["messages"][1]["content"]))
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": json.dumps(valid_summary().model_dump())}}]},
        )

    provider = OpenAICompatibleSummaryProvider(
        api_key="secret",
        base_url="https://llm.example/v1",
        model="summary-model",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    provider.merge([valid_summary(), valid_summary()])

    partials = captured_payload["partial_summaries"]
    assert [item["chunk_order"] for item in partials] == [0, 1]
    assert all("summary" in item for item in partials)


def test_mock_provider_is_deterministic_and_grounded():
    provider = MockSummaryProvider()

    first = provider.extract(prompt_segments())
    second = provider.extract(prompt_segments())

    assert first == second
    assert set(first.topics[0].source_segment_ids) == {"seg_1", "seg_2"}
