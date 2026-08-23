import re
from dataclasses import dataclass
from pathlib import Path

from app.core.errors import DomainError

ALLOWED_CONTENT_TYPES = {
    ".txt": {"text/plain"},
    ".vtt": {"text/plain", "text/vtt"},
    ".srt": {"application/x-subrip", "text/plain"},
}
AUDIO_VIDEO_SUFFIXES = {
    ".aac",
    ".avi",
    ".m4a",
    ".mkv",
    ".mov",
    ".mp3",
    ".mp4",
    ".mpeg",
    ".ogg",
    ".wav",
    ".webm",
}
SPEAKER_PATTERN = re.compile(r"^([^:\n：]{1,80})[:：]\s*(.+)$", re.DOTALL)
TIME_PATTERN = re.compile(
    r"(?P<start>(?:\d{1,2}:)?\d{2}:\d{2}[,.]\d{3})\s*-->\s*"
    r"(?P<end>(?:\d{1,2}:)?\d{2}:\d{2}[,.]\d{3})"
)
MAX_SEGMENT_CHARS = 8_000


@dataclass(frozen=True, slots=True)
class ParsedSegment:
    sequence: int
    text: str
    start_ms: int | None = None
    end_ms: int | None = None
    speaker: str | None = None


def _speaker_and_text(value: str) -> tuple[str | None, str]:
    normalized = value.strip()
    match = SPEAKER_PATTERN.match(normalized)
    if match is None:
        return None, normalized
    return match.group(1).strip(), match.group(2).strip()


def _to_milliseconds(value: str) -> int:
    parts = value.replace(",", ".").split(":")
    if len(parts) == 2:
        hours = "0"
        minutes, seconds_with_millis = parts
    else:
        hours, minutes, seconds_with_millis = parts
    seconds, millis = seconds_with_millis.split(".")
    return int(hours) * 3_600_000 + int(minutes) * 60_000 + int(seconds) * 1_000 + int(millis)


def _require_segments(segments: list[ParsedSegment]) -> list[ParsedSegment]:
    if not segments:
        raise DomainError("TRANSCRIPT_EMPTY", "转录内容为空", 422)
    return segments


def _text_chunks(value: str) -> list[str]:
    return [
        value[offset : offset + MAX_SEGMENT_CHARS]
        for offset in range(0, len(value), MAX_SEGMENT_CHARS)
    ]


def parse_txt(value: str) -> list[ParsedSegment]:
    normalized = value.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not normalized:
        raise DomainError("TRANSCRIPT_EMPTY", "转录内容为空", 422)
    blocks = [item.strip() for item in re.split(r"\n\s*\n", normalized) if item.strip()]
    if len(blocks) == 1:
        lines = [item.strip() for item in blocks[0].splitlines() if item.strip()]
        if len(lines) > 1 and all(SPEAKER_PATTERN.match(item) for item in lines):
            blocks = lines
    segments: list[ParsedSegment] = []
    for block in blocks:
        speaker, text = _speaker_and_text(block)
        for chunk in _text_chunks(text):
            if chunk:
                segments.append(ParsedSegment(sequence=len(segments), speaker=speaker, text=chunk))
    return _require_segments(segments)


def _parse_timed_blocks(value: str, *, webvtt: bool) -> list[ParsedSegment]:
    normalized = value.replace("\r\n", "\n").replace("\r", "\n").strip()
    if webvtt and normalized.startswith("WEBVTT"):
        normalized = normalized[6:].lstrip()
    segments: list[ParsedSegment] = []
    for block in re.split(r"\n\s*\n", normalized):
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        time_index = next((index for index, line in enumerate(lines) if "-->" in line), None)
        if time_index is None:
            continue
        match = TIME_PATTERN.search(lines[time_index])
        if match is None:
            raise DomainError("TRANSCRIPT_FORMAT_INVALID", "转录时间码格式无效", 422)
        raw_text = "\n".join(lines[time_index + 1 :]).strip()
        if not raw_text:
            continue
        speaker, text = _speaker_and_text(raw_text)
        for chunk in _text_chunks(text):
            segments.append(
                ParsedSegment(
                    sequence=len(segments),
                    start_ms=_to_milliseconds(match.group("start")),
                    end_ms=_to_milliseconds(match.group("end")),
                    speaker=speaker,
                    text=chunk,
                )
            )
    return _require_segments(segments)


def parse_vtt(value: str) -> list[ParsedSegment]:
    return _parse_timed_blocks(value, webvtt=True)


def parse_srt(value: str) -> list[ParsedSegment]:
    return _parse_timed_blocks(value, webvtt=False)


def parse_transcript_file(
    filename: str,
    content_type: str | None,
    content: bytes,
    *,
    max_bytes: int = 5 * 1024 * 1024,
) -> list[ParsedSegment]:
    safe_name = Path(filename).name
    suffix = Path(filename).suffix.lower()
    normalized_type = (content_type or "").split(";", 1)[0].strip().lower()
    if (
        suffix in AUDIO_VIDEO_SUFFIXES
        or normalized_type.startswith("audio/")
        or normalized_type.startswith("video/")
    ):
        raise DomainError(
            "ASR_NOT_CONFIGURED",
            "音视频转录服务尚未配置，请先上传 TXT、VTT 或 SRT",
            501,
        )
    if (
        not filename
        or safe_name != filename
        or "/" in filename
        or "\\" in filename
        or suffix not in ALLOWED_CONTENT_TYPES
        or normalized_type not in ALLOWED_CONTENT_TYPES[suffix]
    ):
        raise DomainError("TRANSCRIPT_FILE_INVALID", "仅支持安全的 TXT、VTT 或 SRT 文件", 422)
    if len(content) > max_bytes:
        raise DomainError("TRANSCRIPT_FILE_TOO_LARGE", "转录文件超过大小限制", 413)
    try:
        decoded = content.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise DomainError(
            "TRANSCRIPT_ENCODING_INVALID", "转录文件必须使用 UTF-8 编码", 422
        ) from error
    if suffix == ".vtt" and not decoded.lstrip().startswith("WEBVTT"):
        raise DomainError("TRANSCRIPT_FILE_INVALID", "VTT 文件内容与扩展名不一致", 422)
    if suffix == ".srt" and (
        decoded.lstrip().startswith("WEBVTT") or TIME_PATTERN.search(decoded) is None
    ):
        raise DomainError("TRANSCRIPT_FILE_INVALID", "SRT 文件内容与扩展名不一致", 422)
    parser = {".txt": parse_txt, ".vtt": parse_vtt, ".srt": parse_srt}[suffix]
    return parser(decoded)
