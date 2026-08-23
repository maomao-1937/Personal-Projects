from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response

from app.access.dependencies import require_access_session
from app.integrations.schemas import (
    DeliveryError,
    DeliveryRequest,
    DeliveryResponse,
    IntegrationsResponse,
    IntegrationStatus,
)
from app.integrations.service import IntegrationService

router = APIRouter(
    prefix="/api/v1",
    tags=["integrations"],
    dependencies=[Depends(require_access_session)],
)


def get_integration_service(request: Request) -> IntegrationService:
    return IntegrationService(
        request.app.state.settings,
        request.app.state.session_factory,
        request.app.state.delivery_providers,
    )


@router.get("/integrations", response_model=IntegrationsResponse)
def read_integrations(
    service: Annotated[IntegrationService, Depends(get_integration_service)],
) -> IntegrationsResponse:
    statuses = service.statuses()
    return IntegrationsResponse(
        slack=IntegrationStatus(status=statuses["slack"]),
        email=IntegrationStatus(status=statuses["email"]),
        zoom=IntegrationStatus(status=statuses["zoom"]),
        google_meet=IntegrationStatus(status=statuses["google_meet"]),
    )


@router.post(
    "/summaries/{summary_id}/deliveries",
    response_model=DeliveryResponse,
    status_code=201,
)
def create_delivery(
    summary_id: str,
    payload: DeliveryRequest,
    response: Response,
    service: Annotated[IntegrationService, Depends(get_integration_service)],
) -> DeliveryResponse:
    result = service.deliver(summary_id, payload.channel, payload.target)
    response.status_code = 201 if result.created else 200
    delivery = result.delivery
    error = None
    if delivery.error_code and delivery.error_message:
        error = DeliveryError(code=delivery.error_code, message=delivery.error_message)
    return DeliveryResponse(
        id=delivery.id,
        summary_version_id=delivery.summary_version_id,
        channel=delivery.channel,
        status=delivery.status,
        receipt=delivery.receipt,
        error=error,
        created_at=delivery.created_at,
        updated_at=delivery.updated_at,
    )
