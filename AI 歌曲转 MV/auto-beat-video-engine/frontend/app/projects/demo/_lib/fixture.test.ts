import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { demoProject } from "./fixture";
import type { TimelineAnalysis } from "./types";

describe("demo project fixture", () => {
  it("provides eight shots with real responsive posters", () => {
    expect(demoProject.shots).toHaveLength(8);
    for (const shot of demoProject.shots) {
      expect(shot.poster).toEqual(
        expect.objectContaining({ width400: expect.any(String), width1200: expect.any(String) }),
      );
      for (const path of Object.values(shot.poster)) {
        expect(existsSync(join(process.cwd(), "public", path))).toBe(true);
      }
    }
  });

  it("provides a real local preview video for every shot", () => {
    demoProject.shots.forEach((shot, index) => {
      const scene = String(index + 1).padStart(2, "0");
      expect(shot.previewVideo).toBe(
        `/demo/after-rain/media/scene-${scene}-preview.mp4`,
      );
      expect(
        existsSync(join(process.cwd(), "public", shot.previewVideo)),
      ).toBe(true);
    });
  });

  it("covers every generation status and the three model tiers", () => {
    expect(new Set(demoProject.shots.map((shot) => shot.status))).toEqual(
      new Set(["draft", "queued", "running", "succeeded", "failed_retryable"]),
    );
    expect(demoProject.modelTiers.map((tier) => tier.id)).toEqual([
      "economy",
      "balanced",
      "quality",
    ]);
    expect(demoProject.modelTiers).toEqual([
      expect.objectContaining({
        id: "economy",
        resolution: "720p",
        videoCoverage: "30%–40%",
        consistency: "基础",
      }),
      expect.objectContaining({
        id: "balanced",
        resolution: "720p",
        videoCoverage: "约 60%",
        consistency: "中高",
      }),
      expect.objectContaining({
        id: "quality",
        resolution: "1080p",
        videoCoverage: "80%–100%",
        consistency: "高",
      }),
    ]);
    expect(demoProject.modelTiers.every((tier) => !("modelRoute" in tier))).toBe(true);
    expect(demoProject.modelTiers.every((tier) => !("costRange" in tier))).toBe(true);
  });

  it("uses one artifact status as the playback source of truth", () => {
    expect(demoProject.preview.status).toBe("stale");
    expect(demoProject.shots.map((shot) => shot.artifactStatus)).toEqual([
      "available",
      "processing",
      "processing",
      "available",
      "failed",
      "missing",
      "processing",
      "missing",
    ]);

    for (const shot of demoProject.shots) {
      if (shot.artifactStatus === "available") {
        expect(shot.activeTakeId).toBeTruthy();
        expect(shot.takes.some((take) => take.id === shot.activeTakeId)).toBe(true);
      } else {
        expect(shot.activeTakeId).toBeUndefined();
        expect(shot.takes).toHaveLength(0);
      }
    }
  });

  it("provides fixed typed timeline analysis aligned with internal shot boundaries", () => {
    const analysis: TimelineAnalysis = demoProject.timelineAnalysis;

    let boundary = 0;
    const internalShotBoundaries = demoProject.shots.slice(0, -1).map((shot) => {
      boundary += shot.durationSec;
      return boundary;
    });
    expect(analysis.beats.map((beat) => beat.timeSec)).toEqual(internalShotBoundaries);
    expect(analysis.sections).toEqual([
      expect.objectContaining({ label: "主歌", startSec: 0, endSec: 24 }),
      expect.objectContaining({ label: "过渡", startSec: 24, endSec: 48 }),
      expect.objectContaining({ label: "副歌", startSec: 48, endSec: 66 }),
    ]);
    expect(analysis.lyrics).toEqual([
      expect.objectContaining({ timeSec: 9, text: "离开站台" }),
      expect.objectContaining({ timeSec: 28, text: "玻璃倒影" }),
      expect.objectContaining({ timeSec: 52, text: "天桥停留" }),
    ]);
    expect(analysis.waveformSamples).toHaveLength(44);
    expect(analysis.waveformSamples[0]).toEqual({ timeSec: 0.75, amplitude: 8 });
    expect(analysis.waveformSamples.at(-1)).toEqual({ timeSec: 65.25, amplitude: 27 });
  });
});
