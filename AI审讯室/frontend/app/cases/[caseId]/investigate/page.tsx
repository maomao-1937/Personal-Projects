import { InvestigationScreen } from "@/features/game/screens/investigation-screen";

export default async function InvestigatePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  return <InvestigationScreen caseId={caseId} />;
}
