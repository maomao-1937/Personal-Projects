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
    from app.db import init_db
    from app.main import app

    init_db()
    with TestClient(app) as c:
        yield c


@pytest.fixture
def wait_done():
    return _wait_done
