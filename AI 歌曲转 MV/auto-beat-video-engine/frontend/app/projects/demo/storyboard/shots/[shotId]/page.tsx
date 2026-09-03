import { notFound } from "next/navigation";
import { demoProject } from "../../../_lib/fixture";
import { ShotEditorWorkspace } from "./_components/shot-editor-workspace";

interface ShotEditorPageProps {
  params: Promise<{ shotId: string }>;
  searchParams?: Promise<{ returnTo?: string | string[] }>;
}

function safePreviewReturnTo(value: string | string[] | undefined) {
  if (typeof value !== "string") return undefined;
  return /^\/projects\/demo\/preview(?:\?t=(?:0|[1-9]\d*)(?:\.\d+)?)?$/.test(value)
    ? value
    : undefined;
}

export default async function ShotEditorPage({ params, searchParams }: ShotEditorPageProps) {
  const { shotId } = await params;
  const { returnTo } = searchParams ? await searchParams : {};

  if (!demoProject.shots.some((shot) => shot.id === shotId)) {
    notFound();
  }

  return (
    <ShotEditorWorkspace
      returnTo={safePreviewReturnTo(returnTo)}
      shotId={shotId}
    />
  );
}
