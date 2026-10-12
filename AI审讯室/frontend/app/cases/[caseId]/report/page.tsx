import { ReportScreen } from "@/app/case/001/report/page";

export default async function ReportPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  return <ReportScreen caseId={caseId} />;
}
