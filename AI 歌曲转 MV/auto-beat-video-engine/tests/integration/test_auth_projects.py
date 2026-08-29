from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.api.auth import build_auth_router
from backend.api.errors import install_error_handlers
from backend.api.projects import build_projects_router
from backend.persistence.database import Database
from backend.persistence.repositories import Repositories
from backend.services.auth import AuthService
from backend.services.projects import ProjectService


def _client(tmp_path) -> tuple[TestClient, AuthService, Database]:
    database = Database(tmp_path / "app.db")
    database.initialize()
    repositories = Repositories(database)
    auth = AuthService(database)
    projects = ProjectService(repositories.projects)
    app = FastAPI()
    install_error_handlers(app)
    app.include_router(build_auth_router(auth))
    app.include_router(build_projects_router(projects, auth))
    return TestClient(app), auth, database


def _login(client: TestClient, auth: AuthService, code: str) -> str:
    auth.add_invite_code(code)
    response = client.post("/api/v1/auth/invite", json={"invite_code": code})
    assert response.status_code == 200
    return response.json()["session_token"]


def test_invite_and_session_are_stored_only_as_hashes(tmp_path) -> None:
    client, auth, database = _client(tmp_path)
    invite_code = "invite-a-plaintext"
    token = _login(client, auth, invite_code)

    with database.connect() as connection:
        invite_rows = connection.execute("SELECT code_hash FROM invite_codes").fetchall()
        session_rows = connection.execute("SELECT token_hash FROM sessions").fetchall()

    assert invite_code not in repr(invite_rows)
    assert token not in repr(session_rows)


def test_user_cannot_read_another_users_project(tmp_path) -> None:
    client, auth, _ = _client(tmp_path)
    token_a = _login(client, auth, "invite-a")
    token_b = _login(client, auth, "invite-b")
    created = client.post(
        "/api/v1/projects",
        json={"name": "Private MV"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    project_id = created.json()["id"]

    response = client.get(
        f"/api/v1/projects/{project_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )

    assert response.status_code == 404


def test_project_list_contains_only_owned_projects(tmp_path) -> None:
    client, auth, _ = _client(tmp_path)
    token = _login(client, auth, "invite-list")
    headers = {"Authorization": f"Bearer {token}"}
    client.post("/api/v1/projects", json={"name": "My MV"}, headers=headers)

    response = client.get("/api/v1/projects", headers=headers)

    assert response.status_code == 200
    assert [item["name"] for item in response.json()["items"]] == ["My MV"]


def test_opening_owned_project_updates_last_activity(tmp_path) -> None:
    client, auth, database = _client(tmp_path)
    token = _login(client, auth, "invite-touch")
    headers = {"Authorization": f"Bearer {token}"}
    project_id = client.post(
        "/api/v1/projects", json={"name": "Touched MV"}, headers=headers
    ).json()["id"]
    with database.transaction() as connection:
        connection.execute(
            "UPDATE projects SET updated_at = '2000-01-01T00:00:00+00:00' WHERE id = ?",
            (project_id,),
        )

    response = client.get(f"/api/v1/projects/{project_id}", headers=headers)

    assert response.status_code == 200
    with database.connect() as connection:
        assert connection.execute(
            "SELECT updated_at FROM projects WHERE id = ?", (project_id,)
        ).fetchone()[0] > "2000-01-01T00:00:00+00:00"
