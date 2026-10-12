from __future__ import annotations

from typing import Literal

from pydantic import Field, field_validator

from app.domain.case_intent import CaseIntent
from app.domain.scoring import ReportInput, ScoreResult
from app.domain.types import DomainModel, GameSessionState, Tactic


class CreateSessionRequest(DomainModel):
    case_id: str = "refined-001-v2"


class LoginRequest(DomainModel):
    access_token: str = Field(min_length=1, max_length=512)


class AuthSessionResponse(DomainModel):
    authenticated: bool


class GenerateCaseRequest(DomainModel):
    prompt: str | None = Field(default=None, min_length=1, max_length=500)
    theme: Literal[
        "urban_archive",
        "workplace_secret",
        "missing_property",
    ] | None = None
    difficulty: str = Field(default="standard", pattern=r"^(standard|hard)$")

    @field_validator("prompt", mode="before")
    @classmethod
    def trim_prompt(cls, value):
        return value.strip() if isinstance(value, str) else value


class TurnRequest(DomainModel):
    message: str = Field(min_length=1, max_length=200)
    tactic: Tactic
    evidence_id: str | None = None
    suspect_id: str | None = Field(default=None, min_length=2, max_length=16)
    request_id: str | None = Field(default=None, min_length=8, max_length=64)


class ReportRequest(ReportInput):
    pass


class HealthResponse(DomainModel):
    status: str


class CaseOptionResponse(DomainModel):
    id: str
    label: str


class EvidenceResponse(DomainModel):
    id: str
    name: str
    description: str
    source: str
    hint: str
    public: bool


class PublicSuspectResponse(DomainModel):
    id: str
    name: str
    age: int
    role: str
    public_identity: str
    demeanor: str


class PublicCaseSuspectResponse(PublicSuspectResponse):
    initial_statement: str


class SessionSuspectResponse(PublicCaseSuspectResponse):
    defense: int
    defense_band: str
    hostility: int
    invalid_pressure_count: int


class PublicCaseResponse(DomainModel):
    case_id: str
    case_code: str
    title: str
    subtitle: str
    time: str
    location: str
    summary: str
    content_rating: str
    suspect: PublicSuspectResponse
    initial_statement: str
    suspects: list[PublicCaseSuspectResponse]
    public_facts: list[str]
    evidence_count: int
    evidence: list[EvidenceResponse]
    truth_options: list[CaseOptionResponse]
    motive_options: list[CaseOptionResponse]
    method_options: list[CaseOptionResponse]
    generation_source: str = "manual_fallback"
    generation_intent: CaseIntent | None = None


class SessionResponse(GameSessionState):
    evidence: list[EvidenceResponse]
    suspects: list[SessionSuspectResponse]
    report_result: ScoreResult | None = None


class TurnResponse(SessionResponse):
    reply: str
    evidence_effect: str
    new_evidence_ids: list[str]
    new_claim_ids: list[str]
    is_repeated: bool
    invalid_pressure: bool
    force_report: bool
