import Link from "next/link";
import { notFound } from "next/navigation";

import { TrainingPanel } from "@/components/training-panel";
import { getDatabase } from "@/server/db/client";
import { createSessionRepository } from "@/server/repositories/session-repository";
import { createTrainingRepository } from "@/server/repositories/training-repository";

export const dynamic = "force-dynamic";

export default async function ConceptPage({
  params,
}: PageProps<"/sessions/[sessionId]/concepts/[conceptId]">) {
  const { sessionId, conceptId } = await params;
  const db = getDatabase();
  const sessions = createSessionRepository(db);
  const context = sessions.getConceptWithSession(conceptId);
  if (!context || context.session.id !== sessionId) notFound();

  const training = createTrainingRepository(db).getTrainingView(conceptId);
  const session = sessions.getSessionWithConcepts(sessionId);
  if (!training || !session) notFound();
  const nextConcept = session.concepts.find(
    (concept) => concept.sortOrder > context.concept.sortOrder,
  );

  return (
    <main className="training-page" id="main-content">
      <nav className="breadcrumbs" aria-label="面包屑">
        <Link href={`/sessions/${session.id}`}>{session.title}</Link>
        <span aria-hidden="true">/</span>
        <span>{context.concept.title}</span>
      </nav>
      <TrainingPanel
        initialTraining={training}
        session={{ id: session.id, title: session.title }}
        nextConcept={
          nextConcept ? { id: nextConcept.id, title: nextConcept.title } : null
        }
      />
    </main>
  );
}
