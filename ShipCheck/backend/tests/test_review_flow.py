def test_review_full_flow(client, auth, wait_done):
    prd = "做一个登录页,响应要快,用户输邮箱密码登录。"
    r = client.post("/api/v1/review", json={"prd_text": prd}, headers=auth)
    assert r.status_code == 200
    job_id = r.json()["job_id"]
    j = wait_done(client, job_id)
    assert j["status"] == "done"
    assert j["type"] == "review"
    result = j["result_json"]
    assert result["summary"]["total_findings"] == 3
    assert result["summary"]["high"] >= 1
    assert result["summary"]["medium"] >= 1
    for f in result["findings"]:
        assert f["severity"] in ("high", "medium", "low")
        assert f["message"] and f["suggestion"]
