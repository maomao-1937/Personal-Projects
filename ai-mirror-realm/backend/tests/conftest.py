from __future__ import annotations

from pathlib import Path
from typing import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings
from app.database import Base, get_db
from app.main import app
from app.seed import seed_styles


@pytest.fixture
def db_session_factory(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    database_path = tmp_path / "mirror-realm-test.db"
    engine = create_engine(
        f"sqlite:///{database_path}",
        connect_args={"check_same_thread": False},
    )
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    upload_dir = tmp_path / "uploads"
    generated_dir = tmp_path / "generated"
    upload_dir.mkdir(parents=True)
    generated_dir.mkdir(parents=True)
    monkeypatch.setattr(settings, "UPLOAD_DIR", upload_dir)
    monkeypatch.setattr(settings, "GENERATED_DIR", generated_dir)

    with session_factory() as db:
        seed_styles(db)

    return session_factory


@pytest.fixture
def client(db_session_factory, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    def override_get_db() -> Iterator[Session]:
        db = db_session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    app.state.limiter.enabled = False

    # Background generation must use the same isolated database as the request.
    from app.routers import portraits

    monkeypatch.setattr(portraits, "SessionLocal", db_session_factory)
    monkeypatch.setattr(
        portraits.ai_service,
        "generate_portrait_sync",
        lambda selfie_path, prompt: b"\x89PNG\r\n\x1a\nmock-image",
    )

    test_client = TestClient(app)
    try:
        yield test_client
    finally:
        test_client.close()

        app.dependency_overrides.clear()
        app.state.limiter.enabled = True


def issue_invitation(db_session_factory, **kwargs) -> str:
    from app.services.invitation_service import create_invitation

    with db_session_factory() as db:
        raw_token, _ = create_invitation(db, **kwargs)
        db.commit()
        return raw_token


def register_user(
    client: TestClient,
    db_session_factory,
    *,
    email: str = "invited@example.com",
    password: str = "password123",
) -> dict:
    invite_token = issue_invitation(db_session_factory)
    response = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": password,
            "nickname": "镜界用户",
            "invite_token": invite_token,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()
