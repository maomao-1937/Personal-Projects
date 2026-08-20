def test_acceptance_full_flow(client, auth, wait_done):
    prd = "做一个登录页,用户输邮箱密码登录,登录后跳转 dashboard。"
    r = client.post(
        "/api/v1/acceptance",
        json={"prd_text": prd, "target_url": "https://example.com"},
        headers=auth,
    )
    assert r.status_code == 200
    job_id = r.json()["job_id"]
    j = wait_done(client, job_id)
    assert j["status"] == "done"
    assert j["type"] == "acceptance"
    result = j["result_json"]
    assert result["summary"]["total"] > 0
    # mock checklist 3 条全 pass
    assert result["summary"]["passed"] == result["summary"]["total"]
    assert result["summary"]["failed"] == 0
    assert len(result["fix_tasks"]) == 0


def test_acceptance_job_listed(client, auth, wait_done):
    r = client.post(
        "/api/v1/acceptance",
        json={"prd_text": "另一个 PRD 文本内容", "target_url": "https://example.org"},
        headers=auth,
    )
    job_id = r.json()["job_id"]
    wait_done(client, job_id)
    r2 = client.get("/api/v1/jobs?limit=10")
    assert r2.status_code == 200
    data = r2.json()
    assert data["total"] >= 1
    assert any(j["id"] == job_id for j in data["jobs"])
