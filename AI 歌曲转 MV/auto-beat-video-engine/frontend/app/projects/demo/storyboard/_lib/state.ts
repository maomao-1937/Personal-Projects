import type { CutDraft, WorkspaceState } from "./types";

export function retryCut(state: WorkspaceState, cutId: string): WorkspaceState {
  return {
    ...state,
    cuts: state.cuts.map((cut) =>
      cut.id === cutId && cut.status === "failed_retryable"
        ? { ...cut, status: "queued" as const, error: undefined }
        : cut,
    ),
  };
}

export function saveCutDraft(
  state: WorkspaceState,
  cutId: string,
  draft: CutDraft,
): WorkspaceState {
  return {
    ...state,
    cuts: state.cuts.map((cut) => (cut.id === cutId ? { ...cut, ...draft } : cut)),
    preview: { ...state.preview, status: "stale" },
  };
}

export function rebuildPreview(state: WorkspaceState): WorkspaceState {
  return {
    ...state,
    preview: { ...state.preview, status: "building" },
  };
}
