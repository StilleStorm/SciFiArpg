/** AudioBuffers made from the pure generators in dsp.ts, cached per context so a note is synthesized once. */
import { ksSamples, motorSamples, noiseSamples, fmBellSamples, swellSamples, reversed, type BellOpts, type PluckOpts } from './dsp';

/** Sample rate of generated buffers. The context resamples; music is band-limited anyway. */
export const BUF_SR = 24000;
const CAP = 96;

interface Store {
  map: Map<string, AudioBuffer>;
  noise: AudioBuffer | null;
}
const stores = new WeakMap<BaseAudioContext, Store>();

function storeOf(ctx: BaseAudioContext): Store {
  let s = stores.get(ctx);
  if (!s) {
    s = { map: new Map(), noise: null };
    stores.set(ctx, s);
  }
  return s;
}

function wrap(ctx: BaseAudioContext, data: Float32Array<ArrayBuffer>, sr = BUF_SR): AudioBuffer {
  const b = ctx.createBuffer(1, data.length, sr);
  b.copyToChannel(data, 0);
  return b;
}

function cached(ctx: BaseAudioContext, key: string, make: () => Float32Array<ArrayBuffer>, sr = BUF_SR): AudioBuffer {
  const s = storeOf(ctx);
  const hit = s.map.get(key);
  if (hit) return hit;
  const b = wrap(ctx, make(), sr);
  if (s.map.size >= CAP) {
    const first = s.map.keys().next();
    if (!first.done) s.map.delete(first.value);
  }
  s.map.set(key, b);
  return b;
}

const round = (x: number, d = 1): number => Math.round(x * 10 ** d) / 10 ** d;

/** A reversed copy of a cached buffer (so the forward note is synthesized once and the reverse costs a copy). */
function reversedOf(ctx: BaseAudioContext, key: string, fwd: AudioBuffer): AudioBuffer {
  return cached(ctx, `${key}|r`, () => reversed(fwd.getChannelData(0)), fwd.sampleRate);
}

/** Two seconds of white noise, looped by every noise layer (each starts at its own offset). */
export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const s = storeOf(ctx);
  if (!s.noise) {
    const rate = ctx.sampleRate || 44100;
    const data = noiseSamples(rate, 2, 0x5eed);
    s.noise = wrap(ctx, data, rate);
  }
  return s.noise;
}

export function pluckBuffer(ctx: BaseAudioContext, freq: number, seconds: number, o: PluckOpts = {}, reverse = false): AudioBuffer {
  const key = `ks|${round(freq)}|${round(seconds, 2)}|${round(o.t60 ?? 1, 2)}|${o.bright ?? 0}`;
  const fwd = cached(ctx, key, () => ksSamples(freq, BUF_SR, seconds, o));
  return reverse ? reversedOf(ctx, key, fwd) : fwd;
}

export function bellBuffer(ctx: BaseAudioContext, freq: number, seconds: number, o: BellOpts = {}, reverse = false): AudioBuffer {
  const key = `fm|${round(freq)}|${round(seconds, 2)}|${round(o.t60 ?? 1.2, 2)}|${o.ratio ?? 0}|${o.index ?? 0}`;
  const fwd = cached(ctx, key, () => fmBellSamples(freq, BUF_SR, seconds, o));
  return reverse ? reversedOf(ctx, key, fwd) : fwd;
}

/** Swells are low and narrow-band: 16 kHz is plenty and halves the work. */
const SWELL_SR = 16000;
export function swellBuffer(ctx: BaseAudioContext, freq: number, seconds: number, seed = 1): AudioBuffer {
  return cached(ctx, `sw|${round(freq)}|${round(seconds, 1)}|${seed}`, () => swellSamples(freq, SWELL_SR, seconds, 28, seed, 0.7), SWELL_SR);
}

export function motorBuffer(ctx: BaseAudioContext): AudioBuffer {
  return cached(ctx, 'motor', () => motorSamples(BUF_SR, 2, 48), BUF_SR);
}
