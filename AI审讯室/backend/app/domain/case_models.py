from __future__ import annotations

from difflib import SequenceMatcher
import re
from typing import Literal

from pydantic import Field, field_validator, model_validator

from app.domain.types import DomainModel


ALLOWED_LIE_TOPICS = {
    "时间",
    "位置",
    "门禁",
    "设备",
    "款项",
    "监控",
    "手机",
    "身份",
    "权限",
    "文件",
}


def _normalized_sensitive_text(value: str) -> str:
    return re.sub(r"[\W_]+", "", value, flags=re.UNICODE).casefold()


class CaseOption(DomainModel):
    id: str = Field(min_length=2, max_length=16)
    label: str = Field(min_length=2, max_length=120)


class EvidenceDefinition(DomainModel):
    id: str = Field(pattern=r"^E\d{2}$")
    name: str = Field(min_length=2, max_length=40)
    description: str = Field(min_length=8, max_length=240)
    source: str = Field(min_length=2, max_length=80)
    hint: str = Field(min_length=4, max_length=120)
    public: bool


class SuspectDefinition(DomainModel):
    id: str = Field(min_length=2, max_length=16)
    name: str = Field(min_length=2, max_length=20)
    age: int = Field(ge=18, le=90)
    role: str = Field(min_length=2, max_length=60)
    public_identity: str = Field(min_length=4, max_length=160)
    demeanor: str = Field(min_length=4, max_length=120)
    soft_spot: str = Field(min_length=4, max_length=120)
    soft_spot_keywords: list[str] = Field(min_length=1, max_length=5)
    soft_spot_acknowledgement: str = Field(min_length=6, max_length=160)

    @field_validator("soft_spot_keywords")
    @classmethod
    def validate_soft_spot_keywords(cls, keywords: list[str]) -> list[str]:
        cleaned = [keyword.strip() for keyword in keywords]
        if any(not 2 <= len(keyword) <= 16 for keyword in cleaned):
            raise ValueError("soft spot keywords must contain 2-16 characters")
        if len(cleaned) != len(set(cleaned)):
            raise ValueError("soft spot keywords must be unique")
        return cleaned

    @model_validator(mode="after")
    def keep_acknowledgement_generalized(self) -> "SuspectDefinition":
        private_text = _normalized_sensitive_text(self.soft_spot)
        acknowledgement = _normalized_sensitive_text(
            self.soft_spot_acknowledgement
        )
        highly_similar = (
            SequenceMatcher(None, private_text, acknowledgement).ratio() >= 0.72
        )
        if (
            private_text in acknowledgement
            or acknowledgement in private_text
            or highly_similar
        ):
            raise ValueError("soft spot acknowledgement must not reveal private soft spot")
        return self


class LieNodeDefinition(DomainModel):
    id: str = Field(pattern=r"^L\d{2}$")
    claim: str = Field(min_length=4, max_length=160)
    evidence_id: str = Field(pattern=r"^E\d{2}$")
    topics: list[str] = Field(min_length=1, max_length=4)
    defense_delta: int = Field(ge=-30, le=-1)
    unlock_evidence_ids: list[str] = Field(max_length=3)
    acknowledgement: str = Field(min_length=6, max_length=180)

    @field_validator("topics")
    @classmethod
    def validate_topics(cls, topics: list[str]) -> list[str]:
        cleaned = [topic.strip() for topic in topics]
        if any(
            not topic
            or topic not in ALLOWED_LIE_TOPICS
            for topic in cleaned
        ):
            raise ValueError("topics must use controlled Chinese concepts")
        if len(cleaned) != len(set(cleaned)):
            raise ValueError("topics must be unique within a lie node")
        return cleaned


class TruthDefinition(DomainModel):
    verdict_id: str
    motive_id: str
    method_id: str
    core_evidence_weights: dict[str, int]
    summary: str = Field(min_length=20, max_length=500)
    timeline: list[str] = Field(min_length=5, max_length=7)


class CaseSnapshot(DomainModel):
    schema_version: int = 1
    case_id: str = Field(min_length=3, max_length=64)
    case_code: str = Field(min_length=4, max_length=24)
    source: Literal["llm", "manual_fallback"]
    model_name: str | None = Field(default=None, max_length=120)
    title: str = Field(min_length=2, max_length=40)
    subtitle: str = Field(min_length=4, max_length=80)
    time: str = Field(min_length=4, max_length=80)
    location: str = Field(min_length=2, max_length=80)
    summary: str = Field(min_length=20, max_length=500)
    content_rating: Literal["12+ 推理"] = "12+ 推理"
    suspect: SuspectDefinition
    initial_statement: str = Field(min_length=10, max_length=300)
    public_facts: list[str] = Field(min_length=2, max_length=5)
    evidence: list[EvidenceDefinition] = Field(min_length=5, max_length=5)
    lie_nodes: list[LieNodeDefinition] = Field(min_length=3, max_length=3)
    truth_options: list[CaseOption] = Field(min_length=3, max_length=3)
    motive_options: list[CaseOption] = Field(min_length=3, max_length=3)
    method_options: list[CaseOption] = Field(min_length=3, max_length=3)
    truth: TruthDefinition
    reply_templates: dict[str, str]

    @model_validator(mode="after")
    def validate_graph(self) -> "CaseSnapshot":
        evidence_ids = [item.id for item in self.evidence]
        if len(evidence_ids) != len(set(evidence_ids)):
            raise ValueError("evidence ids must be unique")
        if sum(item.public for item in self.evidence) != 2:
            raise ValueError("case must contain exactly 2 public evidence items")

        lie_ids = [item.id for item in self.lie_nodes]
        if len(lie_ids) != len(set(lie_ids)):
            raise ValueError("lie node ids must be unique")
        evidence_id_set = set(evidence_ids)
        lie_evidence_ids = [item.evidence_id for item in self.lie_nodes]
        if len(lie_evidence_ids) != len(set(lie_evidence_ids)):
            raise ValueError("lie nodes must use distinct evidence")
        for node in self.lie_nodes:
            if node.evidence_id not in evidence_id_set:
                raise ValueError(f"lie node {node.id} references unknown evidence")
            unknown_unlocks = set(node.unlock_evidence_ids) - evidence_id_set
            if unknown_unlocks:
                raise ValueError(f"lie node {node.id} unlocks unknown evidence")
            if f"effective_{node.id}" not in self.reply_templates:
                raise ValueError(f"missing reply template for {node.id}")

        available_evidence = {item.id for item in self.evidence if item.public}
        remaining_nodes = list(self.lie_nodes)
        while remaining_nodes:
            reachable = [
                node for node in remaining_nodes if node.evidence_id in available_evidence
            ]
            if not reachable:
                raise ValueError("evidence chain is unreachable from public evidence")
            for node in reachable:
                available_evidence.update(node.unlock_evidence_ids)
                remaining_nodes.remove(node)
        if self.source == "llm" and available_evidence != evidence_id_set:
            raise ValueError("generated case leaves evidence undiscoverable")

        option_groups = (
            (self.truth_options, self.truth.verdict_id, "verdict"),
            (self.motive_options, self.truth.motive_id, "motive"),
            (self.method_options, self.truth.method_id, "method"),
        )
        for options, correct_id, label in option_groups:
            option_ids = [item.id for item in options]
            if len(option_ids) != len(set(option_ids)):
                raise ValueError(f"{label} option ids must be unique")
            if correct_id not in option_ids:
                raise ValueError(f"correct {label} id is not an option")

        weight_ids = set(self.truth.core_evidence_weights)
        if not weight_ids or not weight_ids.issubset(evidence_id_set):
            raise ValueError("truth weights reference unknown evidence")
        if any(weight < 1 for weight in self.truth.core_evidence_weights.values()):
            raise ValueError("truth evidence weights must be positive")
        if sum(self.truth.core_evidence_weights.values()) > 20:
            raise ValueError("truth evidence weights exceed 20")

        required_templates = {
            "repeated",
            "irrelevant",
            "pressure",
            "empathy",
            "probing",
            "background",
            "confession",
        }
        if not required_templates.issubset(self.reply_templates):
            raise ValueError("required reply templates are missing")
        for key, value in self.reply_templates.items():
            if not 6 <= len(value.strip()) <= 360:
                raise ValueError(f"reply template length is invalid for {key}")
            if key != "confession" and (
                self.truth.summary in value or self.suspect.soft_spot in value
            ):
                raise ValueError(f"reply template {key} reveals private truth")

        public_evidence_ids = {item.id for item in self.evidence if item.public}
        node_by_template = {
            f"effective_{node.id}": node for node in self.lie_nodes
        }
        for key, value in self.reply_templates.items():
            if key == "confession":
                continue
            allowed_evidence_ids = set(public_evidence_ids)
            node = node_by_template.get(key)
            if node is not None:
                allowed_evidence_ids.add(node.evidence_id)
                allowed_evidence_ids.update(node.unlock_evidence_ids)
            for evidence in self.evidence:
                if evidence.id in allowed_evidence_ids:
                    continue
                if any(
                    private_text in value
                    for private_text in (
                        evidence.name,
                        evidence.description,
                        evidence.source,
                        evidence.hint,
                    )
                ):
                    raise ValueError(f"reply template {key} reveals hidden evidence")
        return self

    def public_payload(self) -> dict:
        return {
            "caseId": self.case_id,
            "caseCode": self.case_code,
            "generationSource": self.source,
            "title": self.title,
            "subtitle": self.subtitle,
            "time": self.time,
            "location": self.location,
            "summary": self.summary,
            "contentRating": self.content_rating,
            "suspect": self.suspect.model_dump(
                by_alias=True,
                mode="json",
                exclude={
                    "soft_spot",
                    "soft_spot_keywords",
                    "soft_spot_acknowledgement",
                },
            ),
            "initialStatement": self.initial_statement,
            "publicFacts": self.public_facts,
            "evidence": [
                item.model_dump(by_alias=True, mode="json")
                for item in self.evidence
                if item.public
            ],
            "truthOptions": [
                item.model_dump(by_alias=True, mode="json")
                for item in self.truth_options
            ],
            "motiveOptions": [
                item.model_dump(by_alias=True, mode="json")
                for item in self.motive_options
            ],
            "methodOptions": [
                item.model_dump(by_alias=True, mode="json")
                for item in self.method_options
            ],
        }


def snapshot_from_legacy(
    payload: dict,
    *,
    case_id: str | None = None,
    case_code: str | None = None,
    source: Literal["llm", "manual_fallback"] = "manual_fallback",
    model_name: str | None = None,
) -> CaseSnapshot:
    return CaseSnapshot.model_validate(
        {
            **payload,
            "schema_version": 1,
            "case_id": case_id or payload["case_id"],
            "case_code": case_code or payload["case_code"],
            "source": source,
            "model_name": model_name,
        }
    )
