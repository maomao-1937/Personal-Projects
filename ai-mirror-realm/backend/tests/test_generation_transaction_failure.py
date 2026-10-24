import pytest
from sqlalchemy import text

from app.models.portrait import PortraitTask
from app.routers.portraits import PUBLIC_GENERATION_ERROR
from conftest import register_user


@pytest.mark.parametrize("rejected_status", ["processing", "completed"])
def test_rejected_generation_write_is_rolled_back_before_marking_failed(
    client, db_session_factory, monkeypatch, rejected_status
):
    from app.routers import portraits

    register_user(client, db_session_factory, email="transaction-failure@example.com")
    monkeypatch.setattr(portraits.prompt_analysis_service, "analyze", lambda *_: None)
    uploaded = client.post(
        "/api/uploads/selfie",
        files={"file": ("selfie.jpg", b"\xff\xd8\xfftest", "image/jpeg")},
    )
    assert uploaded.status_code == 201
    # A real SQLite write failure invalidates the SQLAlchemy transaction.
    # Only the generation write is rejected; recording failure remains possible.
    with db_session_factory() as db:
        db.execute(text(f"""
            CREATE TRIGGER reject_generation_write
            BEFORE UPDATE ON portrait_tasks
            WHEN NEW.status = '{rejected_status}'
            BEGIN SELECT RAISE(ABORT, 'internal database write failure'); END
        """))
        db.commit()

    created = client.post(
        "/api/portraits",
        json={"selfie_url": uploaded.json()["url"], "user_prompt": "A portrait"},
    )
    assert created.status_code == 201, created.text
    task_id = created.json()["id"]
    response = client.get(f"/api/portraits/{task_id}/status")
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "failed"
    assert response.json()["error_message"] == PUBLIC_GENERATION_ERROR
    assert response.json()["result_url"] is None
    assert "internal database" not in response.text
    with db_session_factory() as db:
        task = db.get(PortraitTask, task_id)
        assert task.status == "failed"
        assert task.result_url is None
