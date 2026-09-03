import { describe, expect, it } from "vitest";
import { demoProject } from "./fixture";
import {
  applyShotEdits,
  createTake,
  deriveShotSummary,
  retryShot,
  selectModelTier,
  selectTake,
} from "./state";

describe("demo project state", () => {
  it("retries only the failed retryable shot and marks the preview stale", () => {
    const next = retryShot(demoProject, "shot-05");

    expect(next.shots.find((shot) => shot.id === "shot-05")).toMatchObject({
      status: "queued",
      artifactStatus: "processing",
      error: undefined,
    });
    expect(next.shots.find((shot) => shot.id === "shot-04")).toMatchObject({
      status: "succeeded",
      artifactStatus: "available",
    });
    expect(next.preview.status).toBe("stale");
    expect(demoProject.shots.find((shot) => shot.id === "shot-05")?.status).toBe(
      "failed_retryable",
    );
  });

  it("ignores retry requests for artifacts that are not failed", () => {
    const next = retryShot(demoProject, "shot-04");

    expect(next).toBe(demoProject);
    expect(next.shots.find((shot) => shot.id === "shot-04")).toMatchObject({
      status: "succeeded",
      artifactStatus: "available",
    });
  });

  it("creates an available take from the current generation draft", () => {
    const next = createTake(demoProject, "shot-06", {
      prompt: "高架桥下的手持跟拍草稿",
      cameraMotion: "手持漂移",
      advanced: { seed: "9090", resolution: "1080p" },
      modelTierId: "quality",
    });
    const shot = next.shots.find((item) => item.id === "shot-06");

    expect(shot).toMatchObject({
      activeTakeId: "shot-06-take-01",
      advancedSettings: { seed: "9090", resolution: "1080p" },
      artifactStatus: "available",
      cameraMotion: "手持漂移",
      modelTierId: "quality",
      prompt: "高架桥下的手持跟拍草稿",
      status: "succeeded",
    });
    expect(shot?.takes).toHaveLength(1);
    expect(shot?.takes[0]).toMatchObject({
      generationSnapshot: {
        prompt: "高架桥下的手持跟拍草稿",
        cameraMotion: "手持漂移",
        advanced: { seed: "9090", resolution: "1080p" },
        modelTierId: "quality",
      },
    });
    expect(next.preview.status).toBe("stale");
  });

  it("selects a take while preserving the other take and stales the preview", () => {
    const generated = createTake(demoProject, "shot-01", {
      prompt: "新的站台构图",
      cameraMotion: "手持漂移",
      advanced: { seed: "1357", resolution: "1080p" },
      modelTierId: "quality",
    });
    const next = selectTake(generated, "shot-01", "shot-01-take-01");
    const shot = next.shots.find((item) => item.id === "shot-01");

    expect(shot?.activeTakeId).toBe("shot-01-take-01");
    expect(shot?.takes.map((take) => take.selected)).toEqual([true, false]);
    expect(shot).toMatchObject({
      prompt: "雨后高架站台，短发女性穿深灰长风衣，紫蓝霓虹反射，电影感。",
      cameraMotion: "缓慢推进",
      artifactStatus: "available",
    });
    expect(next.preview.status).toBe("stale");
  });

  it("derives a status summary from shots without saved project statistics", () => {
    expect(deriveShotSummary(demoProject.shots)).toEqual({
      draft: 2,
      queued: 2,
      running: 1,
      succeeded: 2,
      failed_retryable: 1,
      total: 8,
    });
    expect(demoProject).not.toHaveProperty("projectStats");
  });

  it("applies controlled shot edits to the project and stales the preview", () => {
    const next = applyShotEdits(demoProject, "shot-01", {
      prompt: "雨声中的站台近景",
      cameraMotion: "手持漂移",
      advancedSettings: { seed: "7777", resolution: "1080p" },
      modelTierId: "quality",
    });

    expect(next.shots.find((shot) => shot.id === "shot-01")).toMatchObject({
      prompt: "雨声中的站台近景",
      cameraMotion: "手持漂移",
      advancedSettings: { seed: "7777", resolution: "1080p" },
      modelTierId: "quality",
    });
    expect(next.preview.status).toBe("stale");
    expect(demoProject.shots[0]?.prompt).not.toBe("雨声中的站台近景");
  });

  it("stores the selected model tier in shared project state", () => {
    const next = selectModelTier(demoProject, "economy");

    expect(next.selectedModelTierId).toBe("economy");
    expect(next.preview.status).toBe("stale");
    expect(demoProject.selectedModelTierId).toBe("balanced");
  });
});
