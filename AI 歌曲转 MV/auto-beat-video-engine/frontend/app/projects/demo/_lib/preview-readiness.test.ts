import { describe, expect, it } from "vitest";
import { derivePreviewReadiness } from "./state";
import type { ArtifactStatus, PreviewStatus } from "./types";

function callDerivePreviewReadiness(
  previewStatus: PreviewStatus,
  artifactStatuses: ArtifactStatus[],
) {
  return derivePreviewReadiness(
    previewStatus,
    artifactStatuses.map((artifactStatus) => ({ artifactStatus })),
  );
}

describe("derivePreviewReadiness", () => {
  it.each([
    ["ready", ["available", "available"], "ready"],
    ["ready", ["available", "missing"], "stale"],
    ["ready", ["available", "processing"], "stale"],
    ["ready", ["available", "failed"], "stale"],
    ["stale", ["available", "available"], "stale"],
    ["building", ["available", "available"], "building"],
    ["building", ["available", "missing"], "building"],
    ["failed", ["available", "available"], "failed"],
    ["failed", ["available", "missing"], "failed"],
  ] as const)(
    "%s + %j Artifact 派生为 %s",
    (previewStatus, artifactStatuses, expected) => {
      expect(
        callDerivePreviewReadiness(
          previewStatus,
          [...artifactStatuses],
        ),
      ).toBe(expected);
    },
  );
});
