import type {
  DemoProject,
  PreviewStatus,
  Shot,
  ShotGenerationDraft,
  ShotStatus,
  ShotSummary,
  Take,
} from "./types";

export type ShotEdits = Partial<
  Pick<Shot, "prompt" | "cameraMotion" | "advancedSettings" | "modelTierId">
>;

export function derivePreviewReadiness(
  previewStatus: PreviewStatus,
  shots: readonly Pick<Shot, "artifactStatus">[],
): PreviewStatus {
  if (previewStatus === "building" || previewStatus === "failed") {
    return previewStatus;
  }

  if (
    previewStatus === "stale" ||
    shots.some((shot) => shot.artifactStatus !== "available")
  ) {
    return "stale";
  }

  return "ready";
}

export function deriveShotGenerationDraft(
  project: DemoProject,
  shot: Shot,
): ShotGenerationDraft {
  if (shot.appliedGenerationDraft) return shot.appliedGenerationDraft;

  const activeTake = shot.takes.find((take) => take.id === shot.activeTakeId);
  if (activeTake) return activeTake.generationSnapshot;

  return {
    prompt: shot.prompt,
    cameraMotion: shot.cameraMotion,
    advanced: shot.advancedSettings,
    modelTierId: shot.modelTierId ?? project.selectedModelTierId,
  };
}

function withStalePreview(project: DemoProject, shots: Shot[]): DemoProject {
  return { ...project, shots, preview: { ...project.preview, status: "stale" } };
}

export function retryShot(project: DemoProject, shotId: string): DemoProject {
  const shot = project.shots.find((item) => item.id === shotId);
  if (!shot || shot.status !== "failed_retryable") return project;

  return withStalePreview(
    project,
    project.shots.map((item) =>
      item.id === shotId
        ? { ...item, status: "queued", artifactStatus: "processing", error: undefined }
        : item,
    ),
  );
}

export function createTake(
  project: DemoProject,
  shotId: string,
  draft?: ShotGenerationDraft,
): DemoProject {
  const shot = project.shots.find((item) => item.id === shotId);
  if (!shot) return project;

  const generationSnapshot: ShotGenerationDraft = draft ?? {
    prompt: shot.prompt,
    cameraMotion: shot.cameraMotion,
    advanced: shot.advancedSettings,
    modelTierId: shot.modelTierId ?? project.selectedModelTierId,
  };

  const takeNumber = String(shot.takes.length + 1).padStart(2, "0");
  const nextTake: Take = {
    id: `${shot.id}-take-${takeNumber}`,
    label: `Take ${takeNumber}`,
    poster: shot.poster,
    previewVideo: shot.previewVideo,
    generationSnapshot,
    selected: true,
  };

  return withStalePreview(
    project,
    project.shots.map((item) =>
      item.id === shotId
        ? {
            ...item,
            activeTakeId: nextTake.id,
            advancedSettings: generationSnapshot.advanced,
            appliedGenerationDraft: undefined,
            artifactStatus: "available",
            cameraMotion: generationSnapshot.cameraMotion,
            error: undefined,
            modelTierId: generationSnapshot.modelTierId,
            previewVideo: nextTake.previewVideo,
            prompt: generationSnapshot.prompt,
            progress: undefined,
            status: "succeeded",
            takes: [...item.takes.map((take) => ({ ...take, selected: false })), nextTake],
          }
        : item,
    ),
  );
}

export function selectTake(project: DemoProject, shotId: string, takeId: string): DemoProject {
  const shot = project.shots.find((item) => item.id === shotId);
  const selectedTake = shot?.takes.find((take) => take.id === takeId);
  if (!shot || !selectedTake) return project;

  return withStalePreview(
    project,
    project.shots.map((item) =>
      item.id === shotId
        ? {
            ...item,
            activeTakeId: takeId,
            advancedSettings: selectedTake.generationSnapshot.advanced,
            appliedGenerationDraft: undefined,
            artifactStatus: "available",
            cameraMotion: selectedTake.generationSnapshot.cameraMotion,
            modelTierId: selectedTake.generationSnapshot.modelTierId,
            poster: selectedTake.poster,
            previewVideo: selectedTake.previewVideo,
            prompt: selectedTake.generationSnapshot.prompt,
            status: "succeeded",
            takes: item.takes.map((take) => ({ ...take, selected: take.id === takeId })),
          }
        : item,
    ),
  );
}

export function applyShotEdits(
  project: DemoProject,
  shotId: string,
  edits: ShotEdits,
): DemoProject {
  const targetShot = project.shots.find((shot) => shot.id === shotId);
  if (!targetShot) return project;

  const currentDraft = deriveShotGenerationDraft(project, targetShot);
  const appliedGenerationDraft: ShotGenerationDraft = {
    prompt: edits.prompt ?? currentDraft.prompt,
    cameraMotion: edits.cameraMotion ?? currentDraft.cameraMotion,
    advanced: edits.advancedSettings ?? currentDraft.advanced,
    modelTierId: edits.modelTierId ?? currentDraft.modelTierId,
  };

  return withStalePreview(
    project,
    project.shots.map((shot) =>
      shot.id === shotId ? { ...shot, ...edits, appliedGenerationDraft } : shot,
    ),
  );
}

export function selectModelTier(
  project: DemoProject,
  modelTierId: DemoProject["selectedModelTierId"],
): DemoProject {
  if (!project.modelTiers.some((tier) => tier.id === modelTierId)) return project;

  return {
    ...project,
    selectedModelTierId: modelTierId,
    preview: { ...project.preview, status: "stale" },
  };
}

export function deriveShotSummary(shots: Shot[]): ShotSummary {
  const statuses: ShotStatus[] = ["draft", "queued", "running", "succeeded", "failed_retryable"];
  const summary = Object.fromEntries(statuses.map((status) => [status, 0])) as ShotSummary;

  for (const shot of shots) summary[shot.status] += 1;
  summary.total = shots.length;
  return summary;
}
