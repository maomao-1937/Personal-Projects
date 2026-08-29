import { BriefingScreen } from "@/app/case/001/briefing/page";

export default async function GeneratedBriefingPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  return <BriefingScreen caseId={caseId} />;
}
