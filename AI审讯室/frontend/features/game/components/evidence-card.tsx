import { Check, FileText, Pin, X } from "lucide-react";

import { StatusLabel } from "@/components/ui/status-label";
import type { Evidence, EvidenceState } from "../types";

const STATE_COPY: Record<EvidenceState, string> = {
  public: "公开证据",
  discovered: "调查发现",
  selected: "本轮已选",
  effective: "已命中矛盾",
  used_ineffective: "曾出示 / 未生效",
};

const STATE_TONE: Record<EvidenceState, "neutral" | "selected" | "effective" | "ineffective"> = {
  public: "neutral",
  discovered: "neutral",
  selected: "selected",
  effective: "effective",
  used_ineffective: "ineffective",
};

export function EvidenceCard({
  evidence,
  state,
  selected,
  onSelect,
  disabled = false,
  compact = false,
}: {
  evidence: Evidence;
  state: EvidenceState;
  selected: boolean;
  onSelect?: (id: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const effectiveState = selected ? "selected" : state;
  const StateIcon =
    effectiveState === "effective"
      ? Check
      : effectiveState === "used_ineffective"
        ? X
        : effectiveState === "selected"
          ? Pin
          : FileText;

  const content = (
    <>
      <div className="evidence-card__header">
        <span className="mono-id">{evidence.id}</span>
        <StatusLabel tone={STATE_TONE[effectiveState]}>
          <StateIcon aria-hidden="true" size={12} />
          {STATE_COPY[effectiveState]}
        </StatusLabel>
      </div>
      <h3>{evidence.name}</h3>
      <p>{evidence.description}</p>
      {!compact ? (
        <dl className="evidence-card__meta">
          <div>
            <dt>来源</dt>
            <dd>{evidence.source}</dd>
          </div>
          <div>
            <dt>调查提示</dt>
            <dd>{evidence.hint}</dd>
          </div>
        </dl>
      ) : null}
    </>
  );

  if (!onSelect) {
    return <article className={`evidence-card evidence-card--${effectiveState}`}>{content}</article>;
  }

  return (
    <button
      type="button"
      className={`evidence-card evidence-card--button evidence-card--${effectiveState}`}
      aria-label={`${selected ? "取消选择" : "选择证据"} ${evidence.id} ${evidence.name}`}
      aria-pressed={selected}
      disabled={disabled}
      onClick={() => onSelect(evidence.id)}
    >
      {content}
    </button>
  );
}

