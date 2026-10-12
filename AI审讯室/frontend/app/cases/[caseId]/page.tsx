import { DossierScreen } from "@/features/game/screens/dossier-screen";

export default async function CaseDossierPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  return <DossierScreen caseId={caseId} />;
}
