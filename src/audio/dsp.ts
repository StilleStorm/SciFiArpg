/**
 * Pure sample generators (no Web Audio): the plucks, bells and noise that every sound is built from.
 * They return Float32Arrays so they can be unit tested in node and wrapped into AudioBuffers by `buffers.ts`.
 *
 * Why not DelayNode feedback for Karplus-Strong: a feedback loop in Web Audio is floored to one render
 * quantum (128 frames, about 2.9 ms), so the highest pitch would be ~340 Hz. The music box needs 300-3000 Hz.
 */
import { createRng } from '../core/rng';

/** White noise in [-1, 1]. */
export function noiseSamples(sr: number, seconds: number, seed = 1): Float32Array<ArrayBuffer> {
  const rng = createRng(seed);
  const out = new Float32Array(Math.floor(sr * seconds));
  for (let i = 0; i < out.length; i++) out[i] = rng.next() * 2 - 1;
  return out;
}

export function reversed(a: Float32Array): Float32Array<ArrayBuffer> {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[a.length - 1 - i] ?? 0;
  return out;
}

export function peakOf(a: Float32Array): number {
  let p = 0;
  for (let i = 0; i < a.length; i++) p = Math.max(p, Math.abs(a[i] ?? 0));
  return p;
}

function normalize(a: Float32Array<ArrayBuffer>, peak: number): Float32Array<ArrayBuffer> {
  const p = peakOf(a);
  if (p > 0) {
    const k = peak / p;
    for (let i = 0; i < a.length; i++) a[i] = (a[i] ?? 0) * k;
  }
  return a;
}

/** A short fade at the end so a buffer never ends in a click. */
function fadeOut(a: Float32Array, sr: number, seconds = 0.012): void {
  const n = Math.min(a.length, Math.floor(sr * seconds));
  for (let i = 0; i < n; i++) {
    const k = i / n;
    const j = a.length - n + i;
    a[j] = (a[j] ?? 0) * (1 - k);
  }
}

export interface PluckOpts {
  /** Seconds for the string to fall by 60 dB. */
  t60?: number;
  /** Cutoff (Hz) of the excitation noise: low = a soft thumb, high = a bright pick. */
  bright?: number;
  seed?: number;
  peak?: number;
}

/**
 * Karplus-Strong string: a burst of lowpassed noise circulating in a delay line of one period with a
 * two-point-average loss filter and an allpass for the fractional delay, so the pitch is within a few cents.
 */
export function ksSamples(freq: number, sr: number, seconds: number, o: PluckOpts = {}): Float32Array<ArrayBuffer> {
  const len = Math.max(8, Math.floor(sr * seconds));
  const out = new Float32Array(len);
  const rng = createRng(o.seed ?? 1);
  const period = sr / Math.max(20, freq);
  const total = Math.max(2, period - 0.5);
  const n = Math.floor(total);
  const frac = total - n;
  const c = (1 - frac) / (1 + frac);
  const t60 = o.t60 ?? 1;
  const loss = 10 ** (-3 / (Math.max(20, freq) * t60));
  // excitation: noise through a one-pole lowpass
  const a = Math.exp((-2 * Math.PI * (o.bright ?? 4000)) / sr);
  let lp = 0;
  for (let i = 0; i < n + 1 && i < len; i++) {
    lp = (1 - a) * (rng.next() * 2 - 1) + a * lp;
    out[i] = lp;
  }
  // remove the DC of the burst so the string does not thump
  let mean = 0;
  for (let i = 0; i < n + 1 && i < len; i++) mean += out[i] ?? 0;
  mean /= n + 1;
  for (let i = 0; i < n + 1 && i < len; i++) out[i] = (out[i] ?? 0) - mean;
  let sPrev = 0;
  for (let i = n + 1; i < len; i++) {
    const s = loss * 0.5 * ((out[i - n] ?? 0) + (out[i - n - 1] ?? 0));
    out[i] = c * s + sPrev - c * (out[i - 1] ?? 0);
    sPrev = s;
  }
  fadeOut(out, sr);
  return normalize(out, o.peak ?? 0.9);
}

export interface BellOpts {
  /** Seconds to fall by 60 dB. */
  t60?: number;
  /** Modulator frequency as a multiple of the carrier (inharmonic = bell). */
  ratio?: number;
  /** Peak modulation index; it decays faster than the amplitude. */
  index?: number;
  /** Detune between the two voices, in cents. */
  detune?: number;
  peak?: number;
}

/** Two-operator FM bell, two slightly detuned voices summed (the music box comb). */
export function fmBellSamples(freq: number, sr: number, seconds: number, o: BellOpts = {}): Float32Array<ArrayBuffer> {
  const len = Math.max(8, Math.floor(sr * seconds));
  const out = new Float32Array(len);
  const t60 = o.t60 ?? 1.2;
  const ratio = o.ratio ?? 3.51;
  const index = o.index ?? 2.2;
  const det = 2 ** ((o.detune ?? 7) / 2400);
  const kAmp = Math.log(1000) / t60;
  const kIdx = kAmp * 2.6;
  for (let v = 0; v < 2; v++) {
    const fc = freq * (v === 0 ? det : 1 / det);
    const fm = fc * ratio;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.exp(-kAmp * t) * Math.min(1, t / 0.002);
      const idx = index * Math.exp(-kIdx * t);
      out[i] = (out[i] ?? 0) + env * Math.sin(2 * Math.PI * fc * t + idx * Math.sin(2 * Math.PI * fm * t));
    }
  }
  fadeOut(out, sr);
  return normalize(out, o.peak ?? 0.8);
}

/** Noise through a narrow resonator, swelled in and out: a pitched breath (tape music, not a tone). */
export function swellSamples(freq: number, sr: number, seconds: number, q = 30, seed = 1, peak = 0.7): Float32Array<ArrayBuffer> {
  const len = Math.max(8, Math.floor(sr * seconds));
  const noise = noiseSamples(sr, seconds, seed);
  const w0 = (2 * Math.PI * Math.min(freq, sr * 0.45)) / sr;
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  const b0 = alpha / a0;
  const b2 = -alpha / a0;
  const a1 = (-2 * Math.cos(w0)) / a0;
  const a2 = (1 - alpha) / a0;
  const out = new Float32Array(len);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < len; i++) {
    const x = noise[i] ?? 0;
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    const k = i / len;
    out[i] = y * Math.sin(Math.PI * k) ** 2;
  }
  return normalize(out, peak);
}

/** Tape-motor hum that loops seamlessly: noise modulated at `hz` (a whole number of cycles per loop), low-passed. */
export function motorSamples(sr: number, seconds: number, hz: number, seed = 3): Float32Array<ArrayBuffer> {
  const cycles = Math.max(1, Math.round(hz * seconds));
  const f = cycles / seconds;
  const len = Math.floor(sr * seconds);
  const noise = noiseSamples(sr, seconds, seed);
  const out = new Float32Array(len);
  const a1 = Math.exp((-2 * Math.PI * 140) / sr);
  const a2 = Math.exp((-2 * Math.PI * 520) / sr);
  let lowA = 0;
  let lowB = 0;
  // two passes so the filter state at the seam matches the start
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const am = 0.55 + 0.45 * Math.sin(2 * Math.PI * f * t) + 0.2 * Math.sin(2 * Math.PI * 2 * f * t + 1);
      const x = (noise[i] ?? 0) * am;
      lowA = (1 - a1) * x + a1 * lowA;
      lowB = (1 - a2) * x + a2 * lowB;
      if (pass === 1) out[i] = lowA * 1.0 + lowB * 0.35;
    }
  }
  return normalize(out, 0.8);
}

/** A tanh-style saturation curve: thickens a sine with harmonics (so a 90 Hz thump is heard on a phone speaker). */
export function saturationCurve(n = 1024, drive = 2.2): Float32Array<ArrayBuffer> {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(drive * x) / Math.tanh(drive);
  }
  return c;
}

/** The ceiling curve of the master: linear to 0.6, then a soft knee that never passes `ceiling` (-1.4 dBFS at 0.855). */
export function ceilingCurve(n = 4096, ceiling = 0.89, knee = 0.6): Float32Array<ArrayBuffer> {
  const c = new Float32Array(n);
  const span = ceiling - knee;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a <= knee ? a : knee + span * Math.tanh((a - knee) / span);
    c[i] = Math.sign(x) * y;
  }
  return c;
}

export const dbToGain = (db: number): number => 10 ** (db / 20);
export const gainToDb = (g: number): number => 20 * Math.log10(Math.max(g, 1e-9));
