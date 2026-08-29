import { Clock3, MapPin } from "lucide-react";

import type { EvidenceState, GameSession, PublicCase } from "../types";
import { EvidenceCard } from "./evidence-card";

export function CaseSummary({ caseData }: { caseData: PublicCase }) {
  return (
    <section className="material-section" aria-labelledby="case-summary-title">
      <p className="eyebrow">CASE BRIEF</p>
      <h2 id="case-summary-title">{caseData.title}</h2>
      <div className="material-fact">
        <Clock3 aria-hidden="true" size={15} />
        <span>{caseData.time}</span>
      </div>
      <div className="material-fact">
        <MapPin aria-hidden="true" size={15} />
        <span>{caseData.location}</span>
      </div>
      <p className="material-summary">{caseData.summary}</p>
      <h3>公开事实</h3>
      <ul className="plain-list">
        {caseData.publicFacts.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>
    </section>
  );
}

function evidenceState(session: GameSession, evidenceId: string, isPublic: boolean): EvidenceState {
  if (session.effectiveEvidenceIds.includes(evidenceId)) return "effective";
  const ineffective = session.messages.some(
    (message) =>
      message.role === "detective" &&
      message.evidenceId === evidenceId &&
      message.evidenceEffect === "used_ineffective",
  );
  if (ineffective) return "used_ineffective";
  return isPublic ? "public" : "discovered";
}

export function EvidenceList({
  session,
  selectedId,
  onSelect,
  disabled = false,
}: {
  session: GameSession;
  selectedId: string | null;
  onSelect?: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <section className="material-section" aria-labelledby="evidence-list-title">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">EVIDENCE FILES</p>
          <h2 id="evidence-list-title">证据文件</h2>
        </div>
        <span className="mono-id">{session.evidence.length}/5</span>
      </div>
      <div className="evidence-list">
        {session.evidence.map((evidence) => (
          <EvidenceCard
            key={evidence.id}
            evidence={evidence}
            state={evidenceState(session, evidence.id, evidence.public)}
            selected={selectedId === evidence.id}
            onSelect={onSelect}
            disabled={disabled}
          />
        ))}
      </div>
    </section>
  );
}

export function DetectiveNotes({ session }: { session: GameSession }) {
  return (
    <section className="material-section" aria-labelledby="detective-notes-title">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">DETECTIVE NOTES</p>
          <h2 id="detective-notes-title">侦探笔记</h2>
        </div>
        <span className="mono-id">AUTO</span>
      </div>
      {session.claims.length ? (
        <ol className="notes-list">
          {session.claims.map((claim) => (
            <li key={`${claim.id}-${claim.turn}`} className={claim.kind === "contradiction" ? "note--hit" : ""}>
              <span>{claim.text}</span>
              <small>{claim.source}</small>
              {claim.kind === "contradiction" ? <b>矛盾已记录</b> : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="empty-copy">有效回答和证据命中会自动记录在这里。</p>
      )}
    </section>
  );
}

