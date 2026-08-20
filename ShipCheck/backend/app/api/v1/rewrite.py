"""PRD 改写 API。输入原 PRD + 建议文本,输出改写后的完整 PRD。"""
from fastapi import APIRouter, Depends

from app.api.v1.invite import verify_invite
from pydantic import BaseModel, Field

from app.core.errors import AppError
from app.services.prd_rewrite import rewrite_prd

router = APIRouter(tags=["rewrite"], dependencies=[Depends(verify_invite)])


class RewriteRequest(BaseModel):
    original_prd: str = Field(..., min_length=10)
    suggestions_text: str = Field(..., min_length=2)


class RewriteResponse(BaseModel):
    rewritten_prd: str


@router.post("/rewrite-prd", response_model=RewriteResponse)
async def rewrite(req: RewriteRequest):
    try:
        out = rewrite_prd(req.original_prd, req.suggestions_text)
    except AppError:
        raise
    return RewriteResponse(rewritten_prd=out)
