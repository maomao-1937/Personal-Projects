export type CutStatus = "succeeded" | "running" | "failed_retryable" | "queued";
export type PreviewStatus = "ready" | "building" | "stale" | "failed";
export type SceneStatus = "succeeded" | "partial" | "queued";

export interface Scene {
  id: string;
  number: number;
  title: string;
  range: string;
  cutCount: number;
  status: SceneStatus;
}

export interface Cut {
  id: string;
  sceneId: string;
  number: number;
  range: string;
  duration: string;
  purpose: string;
  prompt: string;
  shotSize: string;
  cameraMotion: string;
  status: CutStatus;
  progress?: number;
  error?: string;
  assetVersion?: string;
  visualTone: "rain" | "neon" | "error" | "pending";
}

export interface PreviewState {
  status: PreviewStatus;
  timelineVersion: string;
}

export interface WorkspaceState {
  projectName: string;
  selectedSceneId: string;
  selectedCutId: string;
  scenes: Scene[];
  cuts: Cut[];
  preview: PreviewState;
  projectStats: {
    succeeded: number;
    total: number;
  };
}

export type CutDraft = Pick<Cut, "prompt">;
