def test_not_found(client):
    r = client.get("/api/v1/jobs/nonexistent-id")
    assert r.status_code == 404
    data = r.json()
    assert data["error"]["code"] == "not_found"


def test_validation_short_prd(client, auth):
    r = client.post("/api/v1/review", json={"prd_text": "太短"}, headers=auth)
    assert r.status_code == 422
    data = r.json()
    assert data["error"]["code"] == "validation_error"


def test_acceptance_bad_url(client, auth):
    r = client.post(
        "/api/v1/acceptance",
        json={"prd_text": "一个足够长的 PRD 文本内容", "target_url": "not-a-url"},
        headers=auth,
    )
    assert r.status_code == 422
    data = r.json()
    assert data["error"]["code"] == "validation_error"


def test_health(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json()["mock_mode"] is True


def test_invite_required(client):
    """业务接口无邀请码 → 401。"""
    r = client.post("/api/v1/review", json={"prd_text": "一个足够长的 PRD 文本内容"})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "invite_required"


def test_invite_invalid_code(client):
    """错误邀请码 → 403。"""
    r = client.post(
        "/api/v1/review",
        json={"prd_text": "一个足够长的 PRD 文本内容"},
        headers={"X-Invite-Code": "SHIP-BAD-CODE"},
    )
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "invite_invalid"
