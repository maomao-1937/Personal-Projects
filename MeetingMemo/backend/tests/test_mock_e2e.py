from app.access.service import AccessService


def test_complete_mock_workflow(app, client, settings, session_factory):
    invite = AccessService(settings, session_factory).create_invite(
        label="mock-e2e",
        max_redemptions=50,
        code="MM-MOCK-E2E-CODE",
    )
    assert invite.code == "MM-MOCK-E2E-CODE"

    redeemed = client.post(
        "/api/v1/access/redeem",
        json={"invite_code": invite.code},
    )
    assert redeemed.status_code == 200
    assert redeemed.json()["remaining_redemptions"] == 49

    meeting = client.post(
        "/api/v1/meetings",
        json={"title": "发布复盘", "timezone": "Asia/Shanghai"},
    ).json()
    vtt = b"""WEBVTT

00:00:00.000 --> 00:00:03.000
Alice: Confirm production release.

00:00:03.000 --> 00:00:07.000
Bob: I will publish the announcement tomorrow.
"""
    uploaded = client.post(
        f"/api/v1/meetings/{meeting['id']}/transcript-file",
        files={"file": ("release.vtt", vtt, "text/vtt")},
    )
    assert uploaded.status_code == 200
    assert uploaded.json()["segment_count"] == 2

    created_job = client.post(f"/api/v1/meetings/{meeting['id']}/summary-jobs")
    assert created_job.status_code == 202
    assert app.state.job_runner.run_once() is True
    finished_job = client.get(f"/api/v1/jobs/{created_job.json()['id']}")
    assert finished_job.json()["status"] == "succeeded"

    versions = client.get(f"/api/v1/meetings/{meeting['id']}/summaries").json()["items"]
    assert len(versions) == 1
    v1 = versions[0]
    revised_content = v1["content"] | {"headline": "已确认发布并安排公告。"}
    created_v2 = client.post(
        f"/api/v1/summaries/{v1['id']}/revisions",
        json={"expected_version": 1, "content": revised_content},
    )
    assert created_v2.status_code == 201
    assert created_v2.json()["version"] == 2

    v2 = created_v2.json()
    approved = client.post(f"/api/v1/summaries/{v2['id']}/approve")
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"

    exported = client.get(f"/api/v1/summaries/{v2['id']}/export?format=markdown")
    assert exported.status_code == 200
    assert "已确认发布并安排公告" in exported.text
    assert "摘要版本：v2" in exported.text

    deleted = client.delete(f"/api/v1/meetings/{meeting['id']}")
    assert deleted.status_code == 204
    assert client.get(f"/api/v1/meetings/{meeting['id']}").status_code == 404
    assert client.get(f"/api/v1/summaries/{v2['id']}").status_code == 404
