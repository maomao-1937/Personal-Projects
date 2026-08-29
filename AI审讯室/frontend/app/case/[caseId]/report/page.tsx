import { ReportScreen } from "@/app/case/001/report/page";

export default async function GeneratedReportPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  return <ReportScreen caseId={caseId} />;
}
