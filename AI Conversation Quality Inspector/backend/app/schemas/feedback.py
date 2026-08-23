from pydantic import BaseModel, ConfigDict

from app.models import FeedbackReason


class FeedbackRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    helpful: bool
    reason_code: FeedbackReason | None = None


class FeedbackResponse(FeedbackRequest):
    pass
