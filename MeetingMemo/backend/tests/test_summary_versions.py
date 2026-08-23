from copy import deepcopy

from sqlalchemy import select

from app.meetings.models import AuditEvent


def generated_summary(app, auth_client) -> tuple[str, dict]:
    meeting = auth_client.post("/api/v1/meetings", json={"title": "Versioned planning meeting"})
    meeting_id = meeting.json()["id"]
    auth_client.post(
        f"/api/v1/meetings/{meeting_id}/transcript",
        json={"text": "Alice: 确认周五发布。\n\nBob: 我来准备发布清单。"},
    )
    auth_client.post(f"/api/v1/meetings/{meeting_id}/summary-jobs")
    assert app.state.job_runner.run_once() is True
    summaries = auth_client.get(f"/api/v1/meetings/{meeting_id}/summaries")
    assert summaries.status_code == 200
    return meeting_id, summaries.json()["items"][0]


def revised_content(summary: dict) -> dict:
    content = deepcopy(summary["content"])
    content["headline"] = "人工确认：团队将在周五发布。"
    return content


def test_list_and_read_summary(app, auth_client):
    meeting_id, summary = generated_summary(app, auth_client)

    detail = auth_client.get(f"/api/v1/summaries/{summary['id']}")

    assert detail.status_code == 200
    assert detail.json()["meeting_id"] == meeting_id
    assert detail.json()["version"] == 1
    assert detail.json()["content"]["summary_version"] == "1.0"


def test_revision_creates_new_version_without_mutating_parent(app, auth_client):
    meeting_id, summary_v1 = generated_summary(app, auth_client)
    original_content = deepcopy(summary_v1["content"])

    response = auth_client.post(
        f"/api/v1/summaries/{summary_v1['id']}/revisions",
        json={
            "expected_version": 1,
            "content": revised_content(summary_v1),
        },
    )

    assert response.status_code == 201
    assert response.json()["version"] == 2
    assert response.json()["parent_version_id"] == summary_v1["id"]
    assert response.json()["created_source"] == "human"
    parent = auth_client.get(f"/api/v1/summaries/{summary_v1['id']}").json()
    assert parent["content"] == original_content
    listing = auth_client.get(f"/api/v1/meetings/{meeting_id}/summaries").json()
    assert [item["version"] for item in listing["items"]] == [2, 1]


def test_stale_revision_is_rejected(app, auth_client):
    _, summary_v1 = generated_summary(app, auth_client)
    auth_client.post(
        f"/api/v1/summaries/{summary_v1['id']}/revisions",
        json={"expected_version": 1, "content": revised_content(summary_v1)},
    )

    response = auth_client.post(
        f"/api/v1/summaries/{summary_v1['id']}/revisions",
        json={"expected_version": 1, "content": revised_content(summary_v1)},
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "VERSION_CONFLICT"


def test_revision_revalidates_source_references(app, auth_client):
    _, summary_v1 = generated_summary(app, auth_client)
    content = revised_content(summary_v1)
    content["decisions"][0]["source_segment_ids"] = ["seg_missing"]

    response = auth_client.post(
        f"/api/v1/summaries/{summary_v1['id']}/revisions",
        json={"expected_version": 1, "content": content},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "SUMMARY_SOURCE_INVALID"


def test_only_latest_summary_can_be_approved(app, auth_client):
    _, summary_v1 = generated_summary(app, auth_client)
    revision = auth_client.post(
        f"/api/v1/summaries/{summary_v1['id']}/revisions",
        json={"expected_version": 1, "content": revised_content(summary_v1)},
    ).json()

    stale = auth_client.post(f"/api/v1/summaries/{summary_v1['id']}/approve")
    approved = auth_client.post(f"/api/v1/summaries/{revision['id']}/approve")

    assert stale.status_code == 409
    assert stale.json()["error"]["code"] == "VERSION_CONFLICT"
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"


def test_exports_markdown_json_and_text(app, auth_client):
    _, summary = generated_summary(app, auth_client)

    markdown = auth_client.get(f"/api/v1/summaries/{summary['id']}/export?format=markdown")
    json_response = auth_client.get(f"/api/v1/summaries/{summary['id']}/export?format=json")
    text = auth_client.get(f"/api/v1/summaries/{summary['id']}/export?format=text")

    assert markdown.status_code == 200
    assert markdown.headers["content-type"].startswith("text/markdown")
    assert "# Versioned planning meeting" in markdown.text
    assert "seg_" in markdown.text
    assert json_response.status_code == 200
    assert json_response.json()["summary"]["version"] == 1
    assert text.status_code == 200
    assert text.headers["content-type"].startswith("text/plain")
    assert "核心结论" in text.text


def test_revision_and_approval_write_safe_audit_events(app, auth_client, session_factory):
    _, summary_v1 = generated_summary(app, auth_client)
    revision = auth_client.post(
        f"/api/v1/summaries/{summary_v1['id']}/revisions",
        json={"expected_version": 1, "content": revised_content(summary_v1)},
    ).json()
    auth_client.post(f"/api/v1/summaries/{revision['id']}/approve")

    with session_factory() as session:
        events = list(
            session.scalars(
                select(AuditEvent)
                .where(AuditEvent.action.in_(["summary_revision", "summary_approve"]))
                .order_by(AuditEvent.created_at)
            )
        )

    assert [event.action for event in events] == ["summary_revision", "summary_approve"]
    assert all(event.session_fingerprint for event in events)
    assert all(event.trace_id for event in events)
    assert events[0].details == {"version": 2}
    assert events[1].details == {"version": 2}
    assert "headline" not in str([event.details for event in events])
