/**
 * Builds short, soft demonstration tones as WAV blob URLs entirely in-browser.
 * These are NOT real recordings.
 */
const cache = new Map<string, string>();

export function demoAudioUrl(src: string, seconds: number): string {
  if (!src.startsWith('tone:')) return src;
  const key = src + ':' + seconds;
  const hit = cache.get(key);
  if (hit) return hit;
  const seed = Number(src.slice(5)) || 1;
  const rate = 11025;
  const n = Math.floor(rate * seconds);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, n * 2, true);
  const roots = [196, 220, 174.6, 246.9, 207.7, 261.6, 185];
  const base = roots[(seed - 1) % roots.length];
  const chord = [1, 1.25, 1.5, 2];
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const env = Math.min(1, t / 1.2) * Math.min(1, (seconds - t) / 1.5);
    const swell = 0.6 + 0.4 * Math.sin(2 * Math.PI * 0.18 * t + seed);
    let s = 0;
    chord.forEach((m, k) => { s += Math.sin(2 * Math.PI * base * m * t + k) / (k + 1.5); });
    v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s * 0.22 * env * swell)) * 32767, true);
  }
  const url = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  cache.set(key, url);
  return url;
}

export function fmtTime(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  return m + ':' + String(Math.floor(s % 60)).padStart(2, '0');
}
