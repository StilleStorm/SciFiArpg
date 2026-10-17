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
  const key = `ks|${round(freq)}|${round(seconds, 2)}|${round(o.t60 ?? 1, 2)}|${o.bright ?? 0}|${reverse ? 'r' : 'f'}`;
  return cached(ctx, key, () => {
    const a = ksSamples(freq, BUF_SR, seconds, o);
    return reverse ? reversed(a) : a;
  });
}

export function bellBuffer(ctx: BaseAudioContext, freq: number, seconds: number, o: BellOpts = {}, reverse = false): AudioBuffer {
  const key = `fm|${round(freq)}|${round(seconds, 2)}|${round(o.t60 ?? 1.2, 2)}|${o.ratio ?? 0}|${o.index ?? 0}|${reverse ? 'r' : 'f'}`;
  return cached(ctx, key, () => {
    const a = fmBellSamples(freq, BUF_SR, seconds, o);
    return reverse ? reversed(a) : a;
  });
}

export function swellBuffer(ctx: BaseAudioContext, freq: number, seconds: number, seed = 1): AudioBuffer {
  return cached(ctx, `sw|${round(freq)}|${round(seconds, 1)}|${seed}`, () => swellSamples(freq, BUF_SR, seconds, 28, seed, 0.7));
}

export function motorBuffer(ctx: BaseAudioContext): AudioBuffer {
  return cached(ctx, 'motor', () => motorSamples(BUF_SR, 2, 48), BUF_SR);
}
