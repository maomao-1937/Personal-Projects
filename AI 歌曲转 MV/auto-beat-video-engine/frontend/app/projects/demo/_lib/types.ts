export type ShotStatus = "draft" | "queued" | "running" | "succeeded" | "failed_retryable";

export interface MediaVariants {
  width400: string;
  width800: string;
  width1200: string;
}

export type ArtifactStatus = "available" | "missing" | "processing" | "failed";

export interface AdvancedSettings {
  seed: string;
  resolution: "720p" | "1080p";
}

export interface ShotGenerationDraft {
  prompt: string;
  cameraMotion: string;
  advanced: AdvancedSettings;
  modelTierId: ModelTier["id"];
}

export interface Take {
  id: string;
  label: string;
  poster: MediaVariants;
  previewVideo: string;
  generationSnapshot: ShotGenerationDraft;
  selected: boolean;
}

export interface Shot {
  id: string;
  number: number;
  title: string;
  range: string;
  durationSec: number;
  description: string;
  prompt: string;
  cameraMotion: string;
  advancedSettings: AdvancedSettings;
  artifactStatus: ArtifactStatus;
  modelTierId?: ModelTier["id"];
  status: ShotStatus;
  progress?: number;
  error?: string;
  overridesGlobalStyle: boolean;
  appliedGenerationDraft?: ShotGenerationDraft;
  activeTakeId?: string;
  takes: Take[];
  poster: MediaVariants;
  previewVideo: string;
}

export type PreviewStatus = "ready" | "building" | "stale" | "failed";

export interface PreviewState {
  status: PreviewStatus;
}

export interface TimelineRulerTick {
  id: string;
  label: string;
  timeSec: number;
}

export interface TimelineWaveformSample {
  amplitude: number;
  timeSec: number;
}

export interface TimelineBeat {
  id: string;
  timeSec: number;
}

export interface TimelineSection {
  endSec: number;
  id: string;
  label: string;
  startSec: number;
}

export interface TimelineLyric {
  id: string;
  text: string;
  timeSec: number;
}

export interface TimelineAnalysis {
  beats: TimelineBeat[];
  lyrics: TimelineLyric[];
  rulerTicks: TimelineRulerTick[];
  sections: TimelineSection[];
  waveformSamples: TimelineWaveformSample[];
}

export interface ModelTier {
  id: "economy" | "balanced" | "quality";
  label: string;
  description: string;
  resolution: AdvancedSettings["resolution"];
  videoCoverage: string;
  consistency: string;
  estimatedDuration: string;
}

export interface DemoProject {
  id: string;
  title: string;
  globalStyle: string;
  modelTiers: ModelTier[];
  selectedModelTierId: ModelTier["id"];
  shots: Shot[];
  timelineAnalysis: TimelineAnalysis;
  preview: PreviewState;
}

export type ShotSummary = Record<ShotStatus, number> & { total: number };
