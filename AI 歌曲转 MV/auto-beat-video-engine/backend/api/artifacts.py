from fastapi import APIRouter, Header
from fastapi.responses import FileResponse

from backend.domain.errors import DomainError
from backend.persistence.database import Database
from backend.services.auth import AuthService
from backend.services.projects import ProjectService
from backend.storage.local_artifacts import LocalArtifactStore


def build_artifacts_router(
    database: Database,
    projects: ProjectService,
    auth: AuthService,
    artifacts: LocalArtifactStore,
) -> APIRouter:
    router = APIRouter(prefix="/api/v1/projects", tags=["artifacts"])

    @router.get("/{project_id}/artifacts/{artifact_id}/download")
    def download(
        project_id: str,
        artifact_id: str,
        authorization: str | None = Header(default=None),
    ) -> FileResponse:
        user = auth.authenticate_bearer(authorization)
        projects.get(user.id, project_id)
        with database.connect() as connection:
            row = connection.execute(
                "SELECT * FROM artifacts WHERE id = ? AND project_id = ? AND status = 'ready'",
                (artifact_id, project_id),
            ).fetchone()
        if row is None:
            raise DomainError("artifact_not_found", "文件不存在或尚未就绪。", status_code=404)
        path = artifacts.resolve(row["storage_key"])
        if not path.is_file():
            raise DomainError("artifact_file_missing", "文件已丢失。", status_code=410)
        return FileResponse(path, media_type="video/mp4", filename=path.name)

    return router
