/** A local, browser-generated calming tone. Not a clinical or validated recovery therapy. */
export const SOUNDSCAPE_FREQUENCIES_HZ = [432, 528] as const;
export const SOUNDSCAPE_DURATION_S = 4;
export const SOUNDSCAPE_FADE_S = 0.8;
export const SOUNDSCAPE_PEAK_GAIN = 0.12;

export type SoundscapePlan = {
  frequencies: readonly number[];
  startAt: number;
  stopAt: number;
  fadeInEnd: number;
  fadeOutStart: number;
  peakGain: number;
};

/** Pure timing for the chord: a gentle fade in and out within a fixed duration. */
export function planSoundscape(now: number): SoundscapePlan {
  return {
    frequencies: SOUNDSCAPE_FREQUENCIES_HZ,
    startAt: now,
    stopAt: now + SOUNDSCAPE_DURATION_S,
    fadeInEnd: now + SOUNDSCAPE_FADE_S,
    fadeOutStart: now + SOUNDSCAPE_DURATION_S - SOUNDSCAPE_FADE_S,
    peakGain: SOUNDSCAPE_PEAK_GAIN,
  };
}

export const SOUNDSCAPE_DISCLAIMER = 'Local browser-generated tone, not a clinical or validated recovery therapy.';

export type SoundscapeHandle = { stop: () => void };
type AudioCtor = new () => AudioContext;

/**
 * Starts the chord. Rejects with an Error whose message is user-readable when Web Audio
 * is unavailable or the browser blocks playback. `onEnded` fires once when the tone has
 * finished on its own; it does not fire after `stop()`.
 */
export async function startSoundscape(onEnded: () => void): Promise<SoundscapeHandle> {
  const Ctor: AudioCtor | undefined = typeof window === 'undefined' ? undefined
    : (window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor }).AudioContext
      ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
  if (!Ctor) throw new Error('Web Audio is unavailable in this browser. Nothing will play.');
  const ctx = new Ctor();
  let done = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const oscillators: OscillatorNode[] = [];
  const stop = () => {
    if (done) return;
    done = true;
    if (timer !== undefined) clearTimeout(timer);
    for (const osc of oscillators) { try { osc.stop(); } catch { /* already stopped */ } }
    ctx.close().catch(() => undefined);
  };
  try {
    if (ctx.state === 'suspended') await ctx.resume();
    if (ctx.state !== 'running') throw new Error('state');
    const plan = planSoundscape(ctx.currentTime);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, plan.startAt);
    gain.gain.linearRampToValueAtTime(plan.peakGain, plan.fadeInEnd);
    gain.gain.setValueAtTime(plan.peakGain, plan.fadeOutStart);
    gain.gain.linearRampToValueAtTime(0, plan.stopAt);
    gain.connect(ctx.destination);
    for (const frequency of plan.frequencies) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      osc.connect(gain);
      osc.start(plan.startAt);
      osc.stop(plan.stopAt);
      oscillators.push(osc);
    }
  } catch {
    stop();
    throw new Error('Audio was blocked by the browser. Press the button again to allow playback; nothing is playing.');
  }
  timer = setTimeout(() => {
    if (done) return;
    stop();
    onEnded();
  }, SOUNDSCAPE_DURATION_S * 1000);
  return { stop };
}
