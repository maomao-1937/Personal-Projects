"use client";

/**
 * 提示音用 Web Audio API 合成，不依赖 public/ 下的音频文件
 * （项目里没有现成音源，合成两声短促的正弦音足够用，也省一次网络请求）。
 */
let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  return audioCtx;
}

function beep(ctx: AudioContext, freq: number, startAt: number, dur: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  // 淡入淡出，避免爆音
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(0.25, startAt + 0.02);
  gain.gain.linearRampToValueAtTime(0, startAt + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + dur);
}

/** 阶段结束提示音。休息结束音调高一些，听感上区分开。 */
export function playChime(kind: "work-end" | "break-end") {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();

  const now = ctx.currentTime;
  const base = kind === "work-end" ? 660 : 880;
  beep(ctx, base, now, 0.18);
  beep(ctx, base * 1.5, now + 0.22, 0.22);
}

/** 浏览器需要一次用户手势才允许出声，点「开始」时调一次解锁。 */
export function unlockAudio() {
  const ctx = getCtx();
  if (ctx?.state === "suspended") void ctx.resume();
}

export async function ensureNotifyPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function notify(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  new Notification(title, { body, tag: "study-planner-timer" });
}
