import type { Shot } from "../../_lib/types";

export function isPreviewShotMissing(shot: Shot) {
  return shot.artifactStatus !== "available";
}

export function getShotStartTime(shots: Shot[], shotId: string) {
  const shotIndex = shots.findIndex((shot) => shot.id === shotId);
  if (shotIndex < 0) return 0;

  return shots
    .slice(0, shotIndex)
    .reduce((total, shot) => total + shot.durationSec, 0);
}

export function getNextAvailableShot(shots: Shot[], shotId: string) {
  const shotIndex = shots.findIndex((shot) => shot.id === shotId);
  if (shotIndex < 0) return undefined;

  return shots.slice(shotIndex + 1).find((shot) => !isPreviewShotMissing(shot));
}

export function buildPreviewRepairHref(shotId: string, returnTo: string) {
  return `/projects/demo/storyboard/shots/${shotId}?returnTo=${encodeURIComponent(returnTo)}`;
}
