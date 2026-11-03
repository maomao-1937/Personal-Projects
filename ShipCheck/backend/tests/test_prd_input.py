import pytest

from app.db import session_scope
from app.models.models import Job
from app.services import runner


@pytest.mark.parametrize("route", ["review", "acceptance"])
@pytest.mark.parametrize("text", [" " * 10, "\t\r\n" * 4, " \n123456789\t ", "\u3000" * 12])
def test_invalid_prd_is_rejected_before_creating_a_job(client, auth, monkeypatch, route, text):
    calls = []
    monkeypatch.setattr(runner, "run_job", calls.append)
    before = client.get("/api/v1/jobs", headers=auth).json()["total"]
    payload = {"prd_text": text}
    if route == "acceptance":
        payload["target_url"] = "https://example.com"
    response = client.post(f"/api/v1/{route}", json=payload, headers=auth)
    assert response.status_code == 422, response.text
    assert calls == []
    assert client.get("/api/v1/jobs", headers=auth).json()["total"] == before


@pytest.mark.parametrize("route", ["review", "acceptance"])
def test_valid_prd_keeps_internal_format_and_discards_outer_whitespace(client, auth, monkeypatch, route):
    calls = []
    monkeypatch.setattr(runner, "run_job", calls.append)
    text = "用户登录后可以查看记录。\n\n管理员可以导出报告。"
    payload = {"prd_text": " \n" + text + "\t "}
    if route == "acceptance":
        payload["target_url"] = "https://example.com"
    response = client.post(f"/api/v1/{route}", json=payload, headers=auth)
    assert response.status_code == 200, response.text
    job_id = response.json()["job_id"]
    assert calls == [job_id]
    with session_scope() as session:
        assert session.get(Job, job_id).prd_text == text
