let sharedCtx: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioCtx =
    window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedCtx) sharedCtx = new AudioCtx();
  return sharedCtx;
}

/** Call from a click/tap so later chimes are allowed by the browser. */
export async function unlockKitchenAudio() {
  const ctx = getAudioContext();
  if (!ctx) return false;
  if (ctx.state === "suspended") await ctx.resume();
  return ctx.state === "running";
}

export async function playKitchenChime(preview = false) {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") await ctx.resume();
  if (ctx.state !== "running") return;

  const now = ctx.currentTime;
  const tones = preview
    ? [
        { freq: 880, at: 0, dur: 0.12 },
        { freq: 1174, at: 0.14, dur: 0.16 },
      ]
    : [
        { freq: 880, at: 0, dur: 0.14 },
        { freq: 1174, at: 0.16, dur: 0.14 },
        { freq: 880, at: 0.32, dur: 0.2 },
        { freq: 1318, at: 0.5, dur: 0.22 },
      ];

  for (const tone of tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = tone.freq;
    const start = now + tone.at;
    const peak = preview ? 0.22 : 0.28;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + tone.dur + 0.05);
  }
}

export const KITCHEN_ALERTS_KEY = "uff-kitchen-alerts";

export function readKitchenAlertsEnabled() {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem(KITCHEN_ALERTS_KEY);
  if (stored === null) return true;
  return stored === "1";
}

export function writeKitchenAlertsEnabled(on: boolean) {
  if (typeof window === "undefined") return;
  if (on) localStorage.setItem(KITCHEN_ALERTS_KEY, "1");
  else localStorage.removeItem(KITCHEN_ALERTS_KEY);
}
