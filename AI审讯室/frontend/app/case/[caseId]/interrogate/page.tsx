import { InterrogateScreen } from "@/app/case/001/interrogate/page";

export default async function GeneratedInterrogatePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  return <InterrogateScreen caseId={caseId} />;
}
