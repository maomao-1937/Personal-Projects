import { PreviewWorkspace } from "./_components/preview-workspace";

interface PreviewPageProps {
  searchParams: Promise<{ t?: string | string[] }>;
}

function parseInitialTime(value: string | string[] | undefined) {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export default async function PreviewPage({ searchParams }: PreviewPageProps) {
  const { t } = await searchParams;

  return <PreviewWorkspace initialTime={parseInitialTime(t)} />;
}
