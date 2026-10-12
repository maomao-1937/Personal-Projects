import { ResultScreen } from "@/app/case/001/result/page";

export default async function ResultPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  return <ResultScreen caseId={caseId} />;
}
