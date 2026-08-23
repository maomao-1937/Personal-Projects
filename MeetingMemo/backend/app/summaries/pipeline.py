from app.core.errors import DomainError
from app.summaries.providers import SummaryProvider
from app.summaries.schemas import PromptSegment, SummaryPayload


def validate_summary(
    summary: SummaryPayload,
    known_segment_ids: set[str],
    known_speakers: set[str],
) -> SummaryPayload:
    sourced_items = [
        *summary.topics,
        *summary.decisions,
        *summary.action_items,
        *summary.open_questions,
    ]
    for item in sourced_items:
        if not item.source_segment_ids or not set(item.source_segment_ids) <= known_segment_ids:
            raise DomainError("SUMMARY_SOURCE_INVALID", "摘要包含无法追溯的来源引用", 422)
    for action in summary.action_items:
        if action.owner is not None and action.owner not in known_speakers:
            raise DomainError("SUMMARY_OWNER_INVALID", "摘要包含转录中不存在的责任人", 422)
    return summary


def chunk_segments(segments: list[PromptSegment], chunk_chars: int) -> list[list[PromptSegment]]:
    chunks: list[list[PromptSegment]] = []
    current: list[PromptSegment] = []
    current_chars = 0
    for segment in segments:
        segment_chars = len(segment.text)
        if current and current_chars + segment_chars > chunk_chars:
            chunks.append(current)
            current = []
            current_chars = 0
        current.append(segment)
        current_chars += segment_chars
    if current:
        chunks.append(current)
    return chunks


class SummaryPipeline:
    def __init__(self, provider: SummaryProvider, *, chunk_chars: int = 24_000) -> None:
        if chunk_chars < 1:
            raise ValueError("chunk_chars must be positive")
        self.provider = provider
        self.chunk_chars = chunk_chars

    def run(self, segments: list[PromptSegment]) -> SummaryPayload:
        if not segments or not any(item.text.strip() for item in segments):
            raise DomainError("TRANSCRIPT_EMPTY", "转录内容为空", 422)
        meaningful_chars = sum(
            len("".join(character for character in item.text if not character.isspace()))
            for item in segments
        )
        if meaningful_chars < 5:
            raise DomainError("TRANSCRIPT_TOO_SHORT", "转录内容过短，无法生成可靠摘要", 422)
        chunks = chunk_segments(segments, self.chunk_chars)
        partials: list[SummaryPayload] = []
        for chunk in chunks:
            partial = self.provider.extract(chunk)
            validate_summary(
                partial,
                {item.id for item in chunk},
                {item.speaker for item in chunk if item.speaker},
            )
            partials.append(partial)
        summary = partials[0] if len(partials) == 1 else self.provider.merge(partials)
        known_segment_ids = {item.id for item in segments}
        known_speakers = {item.speaker for item in segments if item.speaker}
        return validate_summary(summary, known_segment_ids, known_speakers)
