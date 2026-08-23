import pytest

from app.core.errors import DomainError
from app.meetings.parsers import (
    MAX_SEGMENT_CHARS,
    parse_srt,
    parse_transcript_file,
    parse_txt,
    parse_vtt,
)


def test_txt_parser_splits_paragraphs_and_speakers():
    segments = parse_txt("Alice: Ship it today.\n\nBob: I will prepare the release.")

    assert [item.sequence for item in segments] == [0, 1]
    assert [item.speaker for item in segments] == ["Alice", "Bob"]
    assert segments[1].text == "I will prepare the release."


def test_vtt_parser_preserves_timestamps():
    segments = parse_vtt("WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nAlice: Ship it\n")

    assert segments[0].start_ms == 1000
    assert segments[0].end_ms == 3000
    assert segments[0].speaker == "Alice"
    assert segments[0].text == "Ship it"


def test_vtt_parser_accepts_timestamp_without_hour_component():
    segments = parse_vtt("WEBVTT\n\n01:02.500 --> 02:03.750\nAlice: Short timestamp\n")

    assert segments[0].start_ms == 62_500
    assert segments[0].end_ms == 123_750


def test_srt_parser_preserves_multiline_text():
    segments = parse_srt("1\n00:00:04,500 --> 00:00:07,000\nBob: First line\nsecond line\n")

    assert segments[0].start_ms == 4500
    assert segments[0].end_ms == 7000
    assert segments[0].speaker == "Bob"
    assert segments[0].text == "First line\nsecond line"


@pytest.mark.parametrize(
    ("filename", "content_type"),
    [
        ("notes.exe", "text/plain"),
        ("notes.txt.exe", "text/plain"),
        ("../notes.txt", "text/plain"),
        ("notes.vtt", "application/octet-stream"),
    ],
)
def test_rejects_unsafe_transcript_file_metadata(filename, content_type):
    with pytest.raises(DomainError) as error:
        parse_transcript_file(filename, content_type, b"hello")

    assert error.value.code == "TRANSCRIPT_FILE_INVALID"


def test_rejects_invalid_utf8():
    with pytest.raises(DomainError) as error:
        parse_transcript_file("notes.txt", "text/plain", b"\xff\xfe")

    assert error.value.code == "TRANSCRIPT_ENCODING_INVALID"


def test_rejects_vtt_extension_when_content_is_not_webvtt():
    content = b"1\n00:00:01,000 --> 00:00:02,000\nNot actually WebVTT\n"

    with pytest.raises(DomainError) as error:
        parse_transcript_file("notes.vtt", "text/vtt", content)

    assert error.value.code == "TRANSCRIPT_FILE_INVALID"


def test_rejects_empty_transcript():
    with pytest.raises(DomainError) as error:
        parse_txt(" \n\n ")

    assert error.value.code == "TRANSCRIPT_EMPTY"


def test_single_long_transcript_block_is_split_before_llm_processing():
    original = "a" * (MAX_SEGMENT_CHARS * 2 + 17)

    segments = parse_txt(original)

    assert len(segments) == 3
    assert all(len(segment.text) <= MAX_SEGMENT_CHARS for segment in segments)
    assert "".join(segment.text for segment in segments) == original
