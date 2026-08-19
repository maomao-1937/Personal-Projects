import { notFound } from "next/navigation";

import {
  LearningMap,
  type LearningMapSession,
} from "@/components/learning-map";
import { getDatabase } from "@/server/db/client";
import { createSessionRepository } from "@/server/repositories/session-repository";

export const dynamic = "force-dynamic";

export default async function SessionPage({
  params,
}: PageProps<"/sessions/[sessionId]">) {
  const { sessionId } = await params;
  const session = createSessionRepository(getDatabase()).getSessionWithConcepts(
    sessionId,
  );
  if (!session) notFound();

  const sessionView: LearningMapSession = {
    id: session.id,
    clientRequestId: session.clientRequestId,
    title: session.title,
    mapStatus: session.mapStatus,
    mapError: session.mapError,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    concepts: session.concepts,
  };

  return (
    <main className="page-wrap" id="main-content">
      <header className="page-intro page-intro--map">
        <span className="eyebrow">学习地图</span>
        <h1>{session.title}</h1>
        <p>不需要一次学完。每次只选一个知识点，用自己的话把它讲清楚。</p>
      </header>
      <LearningMap session={sessionView} />
    </main>
  );
}
