"""测试环境。必须在 app 导入前设置 env,settings 才会读到 mock + test db。"""
import os

os.environ["MOCK_MODE"] = "true"
os.environ["DB_URL"] = "sqlite:///./data/test.db"
os.environ["HUNYUAN_API_KEY"] = ""

import time

import pytest
from fastapi.testclient import TestClient


def _wait_done(client: TestClient, job_id: str, timeout: float = 10.0) -> dict:
    """轮询直到 Job done/failed。TestClient 通常会等 BackgroundTask,留余量。"""
    deadline = time.time() + timeout
    j = {}
    while time.time() < deadline:
        r = client.get(f"/api/v1/jobs/{job_id}")
        j = r.json()
        if j.get("status") in ("done", "failed"):
            return j
        time.sleep(0.1)
    return j


@pytest.fixture(scope="session")
def client():
    from app.db import init_db, session_scope
    from app.main import app
    from app.models.models import InviteCode

    init_db()
    # 种子测试邀请码(业务接口强制校验 X-Invite-Code)
    with session_scope() as s:
        if not s.query(InviteCode).filter(InviteCode.code == "SHIP-TEST-0000").first():
            s.add(InviteCode(code="SHIP-TEST-0000", max_uses=9999, used_count=0, active=True))
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def auth():
    """业务接口需要的邀请码头。"""
    return {"X-Invite-Code": "SHIP-TEST-0000"}


@pytest.fixture
def wait_done():
    return _wait_done
