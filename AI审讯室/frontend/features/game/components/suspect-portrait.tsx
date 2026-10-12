import Image from "next/image";

import type { Suspect } from "../types";

const PORTRAITS: Record<string, string> = {
  s01: "/images/refined-001-v2/suspect-s01.png",
  "suspect-s01": "/images/refined-001-v2/suspect-s01.png",
  s02: "/images/refined-001-v2/suspect-s02.png",
  "suspect-s02": "/images/refined-001-v2/suspect-s02.png",
  s03: "/images/refined-001-v2/suspect-s03.png",
  "suspect-s03": "/images/refined-001-v2/suspect-s03.png",
};

function resolvePortrait(id: string) {
  const normalized = id.toLowerCase();
  return PORTRAITS[normalized] ?? Object.entries(PORTRAITS).find(([key]) => normalized.endsWith(key))?.[1] ?? null;
}

export function SuspectPortrait({ suspect, priority = false }: { suspect: Suspect; priority?: boolean }) {
  const source = resolvePortrait(suspect.id);
  return (
    <div className={`identity-photo${source ? " identity-photo--image" : ""}`} aria-hidden="true">
      {source ? <Image src={source} alt="" fill sizes="(max-width: 700px) 72px, 180px" priority={priority} /> : <span>{suspect.name.slice(0, 1)}</span>}
    </div>
  );
}
