import { Check, FileSearch, Link2, MessageSquareQuote, Target } from "lucide-react";

import type { GameSession } from "../types";

export function EvidenceChain({ session }: { session: GameSession }) {
  const recordedStatements = session.claims.filter((claim) => claim.kind !== "contradiction").slice(-2);
  const statements = recordedStatements.length ? recordedStatements : session.messages
    .filter((message) => message.role === "suspect")
    .slice(-1)
    .map((message) => ({ id: message.id, text: message.text, turn: message.turn }));
  const contradictions = session.claims.filter((claim) => claim.kind === "contradiction").slice(-2);
  const effectiveEvidence = session.evidence.filter((evidence) =>
    session.effectiveEvidenceIds.includes(evidence.id),
  ).slice(-2);

  return (
    <aside className="evidence-chain" role="region" aria-label="实时矛盾链">
      <header className="evidence-chain__header">
        <div>
          <p className="eyebrow">CASE LOGIC</p>
          <h2>实时矛盾链</h2>
        </div>
        <Target aria-hidden="true" size={18} />
      </header>

      <ol className="evidence-chain__track">
        <li className="chain-stage chain-stage--statement">
          <header><MessageSquareQuote aria-hidden="true" size={14} /><span>证词</span></header>
          {statements.length ? statements.map((claim) => (
            <article key={`${claim.id}-${claim.turn}`} className="chain-node">
              <small>{claim.turn ? `TURN ${String(claim.turn).padStart(2, "0")}` : "INITIAL STATEMENT"}</small>
              <p>{claim.text}</p>
            </article>
          )) : <p className="chain-node chain-node--empty">等待记录</p>}
        </li>

        <li className="chain-stage chain-stage--evidence">
          <header><FileSearch aria-hidden="true" size={14} /><span>证据</span></header>
          {effectiveEvidence.length ? effectiveEvidence.map((evidence) => (
            <article key={evidence.id} className="chain-node chain-node--effective">
              <small>{evidence.id}</small>
              <p>{evidence.name}</p>
            </article>
          )) : <p className="chain-node chain-node--empty">等待记录</p>}
        </li>

        <li className="chain-stage chain-stage--contradiction">
          <header><Link2 aria-hidden="true" size={14} /><span>矛盾</span></header>
          {contradictions.length ? contradictions.map((claim) => (
            <article key={`${claim.id}-${claim.turn}`} className="chain-node chain-node--hit">
              <small><Check aria-hidden="true" size={11} />已击中</small>
              <p>{claim.text}</p>
            </article>
          )) : <p className="chain-node chain-node--empty">等待对质</p>}
        </li>
      </ol>

      <footer className="evidence-chain__footer">
        <span>{effectiveEvidence.length} 条有效证据 · {contradictions.length} 处矛盾</span>
        <small>{contradictions.length ? "链路成立，可以继续扩大战果" : "把证据与一句具体证词放在一起"}</small>
      </footer>
    </aside>
  );
}
