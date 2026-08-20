import uuid
from datetime import datetime

from app.db import recover_jobs, session_scope
from app.models.models import ChecklistItem, Job


def test_recover_running_job(client):
    """重启恢复:running 的 Job 被标记 failed(interrupted)。"""
    jid = str(uuid.uuid4())
    with session_scope() as s:
        s.add(
            Job(
                id=jid,
                type="review",
                prd_text="test prd text",
                status="running",
                started_at=datetime.utcnow(),
            )
        )
    recover_jobs()
    with session_scope() as s:
        j = s.get(Job, jid)
        assert j.status == "failed"
        assert "interrupted" in (j.error_message or "")


def test_recover_running_item(client):
    """running 的 ChecklistItem 也被标记 failed。"""
    jid = str(uuid.uuid4())
    cid = str(uuid.uuid4())
    with session_scope() as s:
        s.add(Job(id=jid, type="acceptance", prd_text="t", status="done"))
        s.add(
            ChecklistItem(
                id=cid,
                job_id=jid,
                seq=1,
                description="d",
                expected="e",
                status="running",
            )
        )
    recover_jobs()
    with session_scope() as s:
        it = s.get(ChecklistItem, cid)
        assert it.status == "failed"


def test_passed_item_not_recovered(client, auth, wait_done):
    """已 passed 的 item 在重跑同 Job 时不重跑。"""
    r = client.post(
        "/api/v1/acceptance",
        json={"prd_text": "一个足够长的 PRD 文本内容", "target_url": "https://example.com"},
        headers=auth,
    )
    job_id = r.json()["job_id"]
    j = wait_done(client, job_id)
    assert j["status"] == "done"
    # 找到第一个 item 的 id
    with session_scope() as s:
        items = (
            s.query(ChecklistItem)
            .filter(ChecklistItem.job_id == job_id)
            .all()
        )
        assert len(items) > 0
        assert all(it.status == "passed" for it in items)
