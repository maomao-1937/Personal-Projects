from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


def to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


class DomainModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )


class Tactic(str, Enum):
    CALM = "calm"
    EMPATHY = "empathy"
    PRESSURE = "pressure"


class DefenseBand(str, Enum):
    CALM = "calm"
    GUARDED = "guarded"
    SHAKEN = "shaken"
    BREAKING = "breaking"


class Message(DomainModel):
    id: str
    role: Literal["detective", "suspect"]
    text: str
    turn: int
    tactic: Tactic | None = None
    evidence_id: str | None = None
    evidence_effect: Literal["none", "effective", "used_ineffective"] = "none"
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class Claim(DomainModel):
    id: str
    text: str
    source: str
    turn: int
    kind: Literal["statement", "contradiction", "timeline", "empathy"]


class GameSessionState(DomainModel):
    schema_version: int = 1
    session_id: str
    case_id: str = "001"
    stage: Literal[
        "briefing", "interrogation", "report_ready", "report_required", "completed"
    ] = "briefing"
    turn_count: int = 0
    defense: int = 72
    hostility: int = 0
    defense_band: DefenseBand = DefenseBand.CALM
    selected_evidence_id: str | None = None
    discovered_evidence_ids: list[str] = Field(default_factory=lambda: ["E01", "E02"])
    effective_evidence_ids: list[str] = Field(default_factory=list)
    hit_lie_node_ids: list[str] = Field(default_factory=list)
    claims: list[Claim] = Field(default_factory=list)
    messages: list[Message] = Field(default_factory=list)
    can_submit_report: bool = False
    invalid_pressure_count: int = 0
    report_result: dict | None = None


class TurnEvaluation(DomainModel):
    state: GameSessionState
    reply: str
    evidence_effect: Literal["none", "effective", "used_ineffective"]
    new_evidence_ids: list[str] = Field(default_factory=list)
    new_claim_ids: list[str] = Field(default_factory=list)
    is_repeated: bool = False
    invalid_pressure: bool = False
    force_report: bool = False

