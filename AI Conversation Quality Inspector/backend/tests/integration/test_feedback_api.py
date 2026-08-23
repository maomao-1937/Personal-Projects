from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import create_app
from tests.conftest import TEST_INVITE
from tests.support import VALID_TRANSCRIPT, StaticModel

SECOND_INVITE = "pilot_second_invite_1234567890"


def create_completed_analysis(client: TestClient, csrf_token: str) -> str:
    response = client.post(
        "/api/v1/analyses",
        json={"qa_type": "sales", "transcript": VALID_TRANSCRIPT},
        headers={
            "Idempotency-Key": str(uuid4()),
            "X-CSRF-Token": csrf_token,
        },
    )
    assert response.status_code == 200
    return response.json()["analysis_id"]


def test_feedback_can_be_created_then_updated(access_client) -> None:
    client, csrf_token = access_client
    analysis_id = create_completed_analysis(client, csrf_token)

    first = client.put(
        f"/api/v1/analyses/{analysis_id}/feedback",
        json={"helpful": True},
        headers={"X-CSRF-Token": csrf_token},
    )
    second = client.put(
        f"/api/v1/analyses/{analysis_id}/feedback",
        json={"helpful": False, "reason_code": "score_unfair"},
        headers={"X-CSRF-Token": csrf_token},
    )

    assert first.status_code == 200
    assert first.json() == {"helpful": True, "reason_code": None}
    assert second.status_code == 200
    assert second.json() == {"helpful": False, "reason_code": "score_unfair"}


def test_other_invite_cannot_modify_feedback(test_settings) -> None:
    settings = test_settings.model_copy(update={"invite_codes": f"{TEST_INVITE},{SECOND_INVITE}"})
    app = create_app(settings, model_client=StaticModel())
    with TestClient(app) as client:
        first_access = client.post("/api/v1/access/redeem", json={"code": TEST_INVITE}).json()
        analysis_id = create_completed_analysis(client, first_access["csrf_token"])

        client.cookies.clear()
        second_access = client.post("/api/v1/access/redeem", json={"code": SECOND_INVITE}).json()
        response = client.put(
            f"/api/v1/analyses/{analysis_id}/feedback",
            json={"helpful": True},
            headers={"X-CSRF-Token": second_access["csrf_token"]},
        )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "ANALYSIS_NOT_FOUND"


def test_feedback_requires_csrf(access_client) -> None:
    client, csrf_token = access_client
    analysis_id = create_completed_analysis(client, csrf_token)

    response = client.put(
        f"/api/v1/analyses/{analysis_id}/feedback",
        json={"helpful": True},
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "CSRF_INVALID"
