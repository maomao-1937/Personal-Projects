from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field

from backend.api.errors import install_error_handlers


class ProjectPayload(BaseModel):
    name: str = Field(min_length=1)


def test_validation_error_uses_safe_envelope() -> None:
    app = FastAPI()
    install_error_handlers(app)

    @app.post("/api/v1/projects")
    def create_project(payload: ProjectPayload) -> ProjectPayload:
        return payload

    response = TestClient(app).post("/api/v1/projects", json={"name": ""})

    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "request_validation_failed"
    assert error["retryable"] is False
    assert error["request_id"].startswith("req_")
