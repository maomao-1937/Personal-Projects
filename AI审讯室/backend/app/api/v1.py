from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response, status

from app.core.config import Settings
from app.domain.scoring import ScoreResult
from app.schemas.api import (
    AuthSessionResponse,
    CreateSessionRequest,
    GenerateCaseRequest,
    HealthResponse,
    LoginRequest,
    PublicCaseResponse,
    ReportRequest,
    SessionResponse,
    TurnRequest,
    TurnResponse,
)
from app.services.game import GameService
from app.services.case_generation import CaseGenerationService
from app.services.auth import AccessAuthService, AuthIdentity


def create_v1_router(
    service: GameService,
    case_generation_service: CaseGenerationService,
    auth_service: AccessAuthService,
    settings: Settings,
) -> APIRouter:
    router = APIRouter(prefix="/api/v1")

    def require_identity(request: Request) -> AuthIdentity:
        if not auth_service.configured:
            return AuthIdentity(subject="local-development")
        return auth_service.verify_cookie(
            request.cookies.get(settings.auth_cookie_name)
        )

    @router.get("/health", response_model=HealthResponse)
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @router.post("/auth/login", status_code=status.HTTP_204_NO_CONTENT)
    def login(
        payload: LoginRequest,
        request: Request,
        response: Response,
    ) -> None:
        source = request.client.host if request.client is not None else "unknown"
        cookie = auth_service.login(payload.access_token, source)
        response.set_cookie(
            settings.auth_cookie_name,
            cookie,
            max_age=settings.auth_session_ttl_seconds,
            httponly=True,
            secure=settings.auth_cookie_secure,
            samesite="lax",
            path="/",
        )

    @router.get("/auth/session", response_model=AuthSessionResponse)
    def get_auth_session(
        _: AuthIdentity = Depends(require_identity),
    ) -> dict[str, bool]:
        return {"authenticated": True}

    @router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
    def logout(response: Response) -> None:
        response.delete_cookie(
            settings.auth_cookie_name,
            httponly=True,
            secure=settings.auth_cookie_secure,
            samesite="lax",
            path="/",
        )

    @router.get("/cases/{case_id}", response_model=PublicCaseResponse)
    def get_case(
        case_id: str,
        _: AuthIdentity = Depends(require_identity),
    ) -> dict:
        payload = service.get_public_case(case_id)
        return _camelize(payload)

    @router.post("/cases/generate", response_model=PublicCaseResponse)
    def generate_case(
        request: GenerateCaseRequest,
        _: AuthIdentity = Depends(require_identity),
    ) -> dict:
        snapshot = case_generation_service.generate(
            theme=request.theme,
            difficulty=request.difficulty,
        )
        return snapshot.public_payload()

    @router.post("/cases/fallback", response_model=PublicCaseResponse)
    def fallback_case(
        _: AuthIdentity = Depends(require_identity),
    ) -> dict:
        return service.get_public_case("001")

    @router.post(
        "/sessions",
        status_code=status.HTTP_201_CREATED,
        response_model=SessionResponse,
    )
    def create_session(
        request: CreateSessionRequest,
        identity: AuthIdentity = Depends(require_identity),
    ) -> dict:
        state = service.create_session(request.case_id, owner_id=identity.subject)
        return _session_payload(state, service)

    @router.get("/sessions/{session_id}", response_model=SessionResponse)
    def get_session(
        session_id: str,
        identity: AuthIdentity = Depends(require_identity),
    ) -> dict:
        state = service.get_session(session_id, owner_id=identity.subject)
        return _session_payload(state, service)

    @router.post("/sessions/{session_id}/turns", response_model=TurnResponse)
    def submit_turn(
        session_id: str,
        request: TurnRequest,
        identity: AuthIdentity = Depends(require_identity),
    ) -> dict:
        outcome = service.submit_turn(
            session_id,
            request.message,
            request.tactic.value,
            request.evidence_id,
            request.request_id,
            owner_id=identity.subject,
        )
        payload = _session_payload(outcome.state, service)
        payload.update(
            {
                "reply": outcome.reply,
                "evidenceEffect": outcome.evidence_effect,
                "newEvidenceIds": outcome.new_evidence_ids,
                "newClaimIds": outcome.new_claim_ids,
                "isRepeated": outcome.is_repeated,
                "invalidPressure": outcome.invalid_pressure,
                "forceReport": outcome.force_report,
            }
        )
        return payload

    @router.post("/sessions/{session_id}/reports", response_model=ScoreResult)
    def submit_report(
        session_id: str,
        request: ReportRequest,
        identity: AuthIdentity = Depends(require_identity),
    ) -> dict:
        result = service.submit_report(
            session_id,
            request,
            owner_id=identity.subject,
        )
        return result.model_dump(by_alias=True, mode="json")

    return router


def _session_payload(state, service: GameService) -> dict:
    payload = state.model_dump(by_alias=True, mode="json")
    discovered = set(state.discovered_evidence_ids)
    case = service.get_case_snapshot(state.case_id)
    payload["evidence"] = [
        item.model_dump(by_alias=True, mode="json")
        for item in case.evidence
        if item.id in discovered
    ]
    return payload


def _camelize(value):
    if isinstance(value, list):
        return [_camelize(item) for item in value]
    if isinstance(value, dict):
        converted = {}
        for key, item in value.items():
            parts = key.split("_")
            camel_key = parts[0] + "".join(part.capitalize() for part in parts[1:])
            converted[camel_key] = _camelize(item)
        return converted
    return value
