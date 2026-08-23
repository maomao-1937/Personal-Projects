from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class IntegrationStatus(BaseModel):
    status: Literal["configured", "not_configured"]


class IntegrationsResponse(BaseModel):
    slack: IntegrationStatus
    email: IntegrationStatus
    zoom: IntegrationStatus
    google_meet: IntegrationStatus


class DeliveryRequest(BaseModel):
    channel: Literal["slack", "email"]
    target: Literal["configured-default"]


class DeliveryError(BaseModel):
    code: str
    message: str


class DeliveryResponse(BaseModel):
    id: str
    summary_version_id: str
    channel: Literal["slack", "email"]
    status: Literal["pending", "succeeded", "failed", "unknown"]
    receipt: dict[str, object] = Field(default_factory=dict)
    error: DeliveryError | None
    created_at: datetime
    updated_at: datetime
