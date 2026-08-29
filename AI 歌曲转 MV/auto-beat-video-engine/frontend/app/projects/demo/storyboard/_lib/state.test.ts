import { describe, expect, it } from "vitest";
import { workspaceFixture } from "./fixtures";
import { rebuildPreview, retryCut, saveCutDraft } from "./state";

describe("storyboard preview state", () => {
  it("retries only the selected failed cut", () => {
    const next = retryCut(workspaceFixture, "cut-06");

    expect(next.cuts.find((cut) => cut.id === "cut-06")?.status).toBe("queued");
    expect(next.cuts.find((cut) => cut.id === "cut-04")?.status).toBe("succeeded");
  });

  it("marks preview stale after saving a cut revision", () => {
    const next = saveCutDraft(workspaceFixture, "cut-06", {
      prompt: "新的镜头提示词",
    });

    expect(next.cuts.find((cut) => cut.id === "cut-06")?.prompt).toBe(
      "新的镜头提示词",
    );
    expect(next.preview.status).toBe("stale");
  });

  it("starts a local preview rebuild without changing cuts", () => {
    const stale = saveCutDraft(workspaceFixture, "cut-06", {
      prompt: "新的镜头提示词",
    });
    const next = rebuildPreview(stale);

    expect(next.preview.status).toBe("building");
    expect(next.cuts).toEqual(stale.cuts);
  });
});
