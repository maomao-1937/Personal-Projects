from app.core.errors import ModelUnavailable
from app.models import QAType, RiskLevel
from app.schemas.analysis import (
    Confidence,
    DimensionName,
    DimensionStatus,
    Evidence,
    EvidenceType,
    ModelAnalysisResult,
    ModelDimension,
)

VALID_TRANSCRIPT = (
    "客户：这个价格有些贵，我还需要比较一下。\n销售：我们已经是最低价格了，今天必须决定。"
)


def valid_model_result() -> ModelAnalysisResult:
    return ModelAnalysisResult(
        confidence=Confidence.HIGH,
        risk_level=RiskLevel.MEDIUM,
        risk_flags=["绝对化价格承诺"],
        dimensions=[
            ModelDimension(
                name=name,
                status=DimensionStatus.SCORED,
                score=70,
                summary="存在可定位的改进空间。",
                evidence=[
                    Evidence(
                        type=EvidenceType.PROBLEMATIC_LANGUAGE,
                        turn_ids=["t2"],
                        quotes=["我们已经是最低价格了"],
                        rationale="销售使用了无法核验的绝对化价格表达。",
                    )
                ],
                improvement="先澄清客户顾虑，再提供可核验的信息。",
                confidence=Confidence.HIGH,
            )
            for name in DimensionName
        ],
        major_issues=[],
        suggested_reply="方便说说您主要在比较哪些方面吗？",
        limitations=["缺少企业价格政策。"],
    )


class StaticModel:
    model_version = "fake-model-v1"

    def __init__(self, *, fail: bool = False) -> None:
        self.fail = fail
        self.call_count = 0

    def ensure_configured(self) -> None:
        return None

    def analyze(self, transcript, qa_type: QAType) -> ModelAnalysisResult:
        self.call_count += 1
        if self.fail:
            raise ModelUnavailable()
        return valid_model_result()
