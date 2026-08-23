from pathlib import Path

from sqlalchemy import select

from app.meetings.models import Meeting, TranscriptSegment
from app.summaries.models import SummaryVersion


def create_meeting(auth_client, title="Weekly product sync") -> str:
    response = auth_client.post(
        "/api/v1/meetings",
        json={
            "title": title,
            "meeting_at": "2026-08-23T09:00:00+08:00",
            "timezone": "Asia/Shanghai",
            "language": "zh-CN",
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_meetings_require_invitation_session(client):
    response = client.get("/api/v1/meetings")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "ACCESS_REQUIRED"


def test_create_list_and_read_meeting(auth_client):
    meeting_id = create_meeting(auth_client)

    listing = auth_client.get("/api/v1/meetings")
    detail = auth_client.get(f"/api/v1/meetings/{meeting_id}")

    assert listing.status_code == 200
    assert [item["id"] for item in listing.json()["items"]] == [meeting_id]
    assert detail.status_code == 200
    assert detail.json()["title"] == "Weekly product sync"
    assert detail.json()["segments"] == []


def test_create_rejects_whitespace_only_title(auth_client):
    response = auth_client.post("/api/v1/meetings", json={"title": "   "})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_text_transcript_is_stored_with_stable_segments(auth_client, session_factory):
    meeting_id = create_meeting(auth_client)

    response = auth_client.post(
        f"/api/v1/meetings/{meeting_id}/transcript",
        json={"text": "Alice: 确认周五发布。\n\nBob: 我来准备发布清单。"},
    )

    assert response.status_code == 200
    assert response.json()["segment_count"] == 2
    detail = auth_client.get(f"/api/v1/meetings/{meeting_id}").json()
    assert detail["segments"][0]["id"].startswith("seg_")
    assert detail["segments"][0]["speaker"] == "Alice"
    with session_factory() as session:
        stored = list(
            session.scalars(
                select(TranscriptSegment).where(TranscriptSegment.meeting_id == meeting_id)
            )
        )
    assert [item.sequence for item in stored] == [0, 1]


def test_vtt_upload_is_parsed(auth_client):
    meeting_id = create_meeting(auth_client)
    content = b"WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nAlice: Ship it\n"

    response = auth_client.post(
        f"/api/v1/meetings/{meeting_id}/transcript-file",
        files={"file": ("meeting.vtt", content, "text/vtt")},
    )

    assert response.status_code == 200
    detail = auth_client.get(f"/api/v1/meetings/{meeting_id}").json()
    assert detail["segments"][0]["start_ms"] == 1000


def test_transcript_upload_is_saved_to_controlled_asset_path(auth_client, settings, tmp_path: Path):
    meeting_id = create_meeting(auth_client)
    content = b"WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nAlice: Ship it\n"

    response = auth_client.post(
        f"/api/v1/meetings/{meeting_id}/transcript-file",
        files={"file": ("private-meeting.vtt", content, "text/vtt")},
    )

    assert response.status_code == 200
    stored = settings.upload_dir / meeting_id / "source.vtt"
    assert stored.read_bytes() == content
    assert "private-meeting" not in str(stored)

    deleted = auth_client.delete(f"/api/v1/meetings/{meeting_id}")

    assert deleted.status_code == 204
    assert not stored.parent.exists()


def test_audio_upload_reports_asr_not_configured(auth_client):
    meeting_id = create_meeting(auth_client)

    response = auth_client.post(
        f"/api/v1/meetings/{meeting_id}/transcript-file",
        files={"file": ("meeting.mp3", b"ID3mock", "audio/mpeg")},
    )

    assert response.status_code == 501
    assert response.json()["error"]["code"] == "ASR_NOT_CONFIGURED"


def test_pasted_transcript_removes_previous_raw_upload(auth_client, settings):
    meeting_id = create_meeting(auth_client)
    uploaded = auth_client.post(
        f"/api/v1/meetings/{meeting_id}/transcript-file",
        files={
            "file": (
                "meeting.vtt",
                b"WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nOriginal\n",
                "text/vtt",
            )
        },
    )
    assert uploaded.status_code == 200
    asset_directory = settings.upload_dir / meeting_id
    assert asset_directory.exists()

    replaced = auth_client.post(
        f"/api/v1/meetings/{meeting_id}/transcript",
        json={"text": "Pasted replacement transcript."},
    )

    assert replaced.status_code == 200
    assert not asset_directory.exists()


def test_unsafe_upload_name_is_rejected(auth_client):
    meeting_id = create_meeting(auth_client)

    response = auth_client.post(
        f"/api/v1/meetings/{meeting_id}/transcript-file",
        files={"file": ("notes.txt.exe", b"hello", "text/plain")},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "TRANSCRIPT_FILE_INVALID"


def test_pasted_transcript_has_a_hard_character_limit(auth_client):
    meeting_id = create_meeting(auth_client)

    response = auth_client.post(
        f"/api/v1/meetings/{meeting_id}/transcript",
        json={"text": "x" * 500_001},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_request_declared_over_total_body_limit_is_rejected(auth_client):
    response = auth_client.post(
        "/api/v1/meetings",
        headers={"Content-Length": str(7 * 1024 * 1024)},
        json={"title": "Oversized envelope"},
    )

    assert response.status_code == 413
    assert response.json()["error"]["code"] == "REQUEST_TOO_LARGE"


def test_transcript_cannot_replace_summarized_input(auth_client, session_factory):
    meeting_id = create_meeting(auth_client)
    auth_client.post(
        f"/api/v1/meetings/{meeting_id}/transcript",
        json={"text": "Alice: Original transcript."},
    )
    with session_factory.begin() as session:
        session.add(
            SummaryVersion(
                meeting_id=meeting_id,
                version=1,
                content={"summary_version": "1.0", "headline": "Original"},
            )
        )

    response = auth_client.post(
        f"/api/v1/meetings/{meeting_id}/transcript",
        json={"text": "Alice: Replaced transcript."},
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "TRANSCRIPT_LOCKED"


def test_transcript_cannot_change_while_summary_job_is_active(auth_client):
    meeting_id = create_meeting(auth_client)
    auth_client.post(
        f"/api/v1/meetings/{meeting_id}/transcript",
        json={"text": "Alice: Original transcript."},
    )
    queued = auth_client.post(f"/api/v1/meetings/{meeting_id}/summary-jobs")
    assert queued.status_code == 202

    response = auth_client.post(
        f"/api/v1/meetings/{meeting_id}/transcript",
        json={"text": "Alice: Replaced transcript."},
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "TRANSCRIPT_LOCKED"
    detail = auth_client.get(f"/api/v1/meetings/{meeting_id}").json()
    assert detail["segments"][0]["text"] == "Original transcript."


def test_delete_makes_meeting_immediately_inaccessible(auth_client, session_factory):
    meeting_id = create_meeting(auth_client)

    response = auth_client.delete(f"/api/v1/meetings/{meeting_id}")

    assert response.status_code == 204
    assert auth_client.get(f"/api/v1/meetings/{meeting_id}").status_code == 404
    with session_factory() as session:
        stored = session.get(Meeting, meeting_id)
        assert stored is not None
        assert stored.deleted_at is not None
