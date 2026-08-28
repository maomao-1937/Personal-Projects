from dataclasses import asdict

from fastapi import APIRouter, File, Header, UploadFile

from backend.domain.errors import DomainError
from backend.services.audio import AudioService
from backend.services.auth import AuthService


def build_audio_router(audio_service: AudioService, auth: AuthService) -> APIRouter:
    router = APIRouter(prefix="/api/v1/projects", tags=["audio"])

    @router.post("/{project_id}/audio", status_code=201)
    async def upload_audio(
        project_id: str,
        audio: UploadFile = File(...),
        authorization: str | None = Header(default=None),
    ) -> dict[str, object]:
        user = auth.authenticate_bearer(authorization)
        data = await audio.read(audio_service.max_bytes + 1)
        if len(data) > audio_service.max_bytes:
            raise DomainError(
                "audio_too_large",
                "音频文件超过 100 MB。",
                status_code=413,
                details={"max_bytes": audio_service.max_bytes},
            )
        result = audio_service.upload(
            user.id,
            project_id,
            filename=audio.filename or "audio",
            content_type=audio.content_type or "application/octet-stream",
            data=data,
        )
        return asdict(result)

    return router

