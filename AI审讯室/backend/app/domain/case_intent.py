from typing import Literal

from pydantic import ConfigDict, Field

from app.domain.types import DomainModel


class CaseIntent(DomainModel):
    """A bounded creative direction, with no solution or game-rule authority."""

    model_config = ConfigDict(
        extra="forbid", str_strip_whitespace=True,
        populate_by_name=True, serialize_by_alias=True,
    )

    scene: str = Field(min_length=2, max_length=80)
    incident: str = Field(min_length=4, max_length=120)
    suspect_role: str = Field(min_length=2, max_length=60)
    atmosphere: Literal["克制", "紧张", "轻松", "温和"]
    preferences: str = Field(min_length=2, max_length=160)
    adaptation_note: str = Field(default="", max_length=200)
