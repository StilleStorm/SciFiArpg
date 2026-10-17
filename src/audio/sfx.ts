/**
 * The SFX engine: a recipe (recipes.ts) becomes a short-lived chain of nodes per call, no pooling.
 * Every source is disconnected when the sound ends (`onended` on the last one to finish).
 */
import { createRng, type Rng } from '../core/rng';
import { noiseBuffer, motorBuffer, pluckBuffer } from './buffers';
import { getMix, isRunning, getContext } from './context';
import { saturationCurve } from './dsp';
import { RECIPES, recipeLength, type Layer, type Recipe, type SfxName } from './recipes';

export * from './recipes';

export interface PlayOpts {
  /** Overall gain, 1 = as written. */
  gain?: number;
  /** Pitch multiplier for every layer (small random variation per call keeps repeats from sounding stamped out). */
  rate?: number;
  /** Per-role gain, e.g. `{ body: 0.2 }` for a beast that is not confirmed yet. */
  scale?: Partial<Record<NonNullable<Layer['role']>, number>>;
  /** Seconds from now. */
  when?: number;
}

/** Where a sound goes: a context, the node to connect to, and a clock. The live mix, or an offline render. */
export interface Sink {
  ctx: BaseAudioContext;
  out: AudioNode;
  now(): number;
  rng: Rng;
}

/** Global SFX level; the per-recipe calibration lives in levels.ts. */
export const SFX_TRIM = 1;
/** The boss hum is a bed under the whole fight: RMS about -38 dBFS. */
const HUM_LEVEL = 0.06;
const MAX_VOICES = 26;
const SOFT_VOICES = 16;

const saturation = saturationCurve();
const liveRng = createRng(0xa0d10);
const lastPlayed = new Map<string, number>();
let voiceEnds: number[] = [];

function bandComp(q: number): number {
  return Math.min(4, Math.sqrt(Math.max(1, q)));
}

/** Build one recipe into `sink`. Returns false when it was dropped (rate limit, too many voices). */
export function playRecipe(sink: Sink, name: string, recipe: Recipe, opts: PlayOpts = {}, limit = true): boolean {
  const { ctx, rng } = sink;
  const t0 = sink.now() + (opts.when ?? 0) + 0.002;
  if (limit) {
    const now = sink.now();
    const last = lastPlayed.get(name) ?? -10;
    if (now - last < (recipe.minGap ?? 0)) return false;
    voiceEnds = voiceEnds.filter((e) => e > now);
    const n = voiceEnds.length;
    if (n >= MAX_VOICES || (n >= SOFT_VOICES && (recipe.priority ?? 1) < 5)) return false;
    lastPlayed.set(name, now);
    voiceEnds.push(t0 + recipeLength(recipe) + 0.05);
  }
  const rate = opts.rate ?? 1;
  const out = ctx.createGain();
  out.gain.value = SFX_TRIM * (recipe.trim ?? 1) * (opts.gain ?? 1);
  out.connect(sink.out);
  const nodes: AudioNode[] = [out];
  let lastEnd = -1;
  let lastSrc: AudioScheduledSourceNode | null = null;

  for (const l of recipe.layers) {
    const roleScale = l.role ? (opts.scale?.[l.role] ?? 1) : 1;
    const gain = l.gain * roleScale;
    if (gain < 0.002) continue;
    const start = t0 + (l.delay ?? 0);
    const grains = l.repeat && l.repeat > 1 ? l.repeat : 1;
    const spread = l.spread ?? 0;
    const env = ctx.createGain();
    env.gain.value = 0;
    env.connect(out);
    nodes.push(env);
    const kind = l.kind;
    const isClick = kind === 'click';
    const attack = isClick ? Math.min(l.attack, 0.0008) : l.attack;
    const decay = l.decay;
    // the time each grain starts, jittered but sorted so the automation stays monotonic
    const starts: number[] = [];
    for (let i = 0; i < grains; i++) {
      const base = grains === 1 ? 0 : (i / grains) * spread;
      starts.push(start + base + (grains === 1 ? 0 : rng.range(0, (spread / grains) * 0.8)));
    }
    const envelope = (g: number): number => {
      let end = start;
      for (let i = 0; i < starts.length; i++) {
        const s = starts[i] ?? start;
        const next = starts[i + 1] ?? Infinity;
        const gi = g * (grains === 1 ? 1 : rng.range(0.55, 1.15));
        const room = next - s - 0.0005;
        const a = Math.min(attack, room * 0.3);
        const d = Math.max(0.001, Math.min(decay, room - a));
        env.gain.setValueAtTime(0, s);
        env.gain.linearRampToValueAtTime(gi, s + Math.max(a, 0.0003));
        env.gain.exponentialRampToValueAtTime(0.0005, s + Math.max(a, 0.0003) + d);
        end = s + Math.max(a, 0.0003) + d;
      }
      return end;
    };

    let src: AudioScheduledSourceNode;
    let end: number;
    if (kind === 'noise' || isClick) {
      const q = l.q ?? 1;
      const n = ctx.createBufferSource();
      n.buffer = noiseBuffer(ctx);
      n.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = q;
      const f0 = (l.bandpass ?? l.freq) * rate;
      bp.frequency.setValueAtTime(f0, start);
      if (l.pitchDrop && grains === 1) {
        const f1 = Math.max(40, Math.min(ctx.sampleRate * 0.45, f0 * (1 - l.pitchDrop)));
        bp.frequency.exponentialRampToValueAtTime(f1, start + attack + decay);
      } else if (grains > 1) {
        for (const s of starts) bp.frequency.setValueAtTime(f0 * rng.range(0.82, 1.2), s);
      }
      n.connect(bp);
      let tail: AudioNode = bp;
      nodes.push(n, bp);
      if (l.lp) {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = l.lp;
        tail.connect(lp);
        tail = lp;
        nodes.push(lp);
      }
      if (l.hp) {
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = l.hp;
        tail.connect(hp);
        tail = hp;
        nodes.push(hp);
      }
      tail.connect(env);
      end = envelope(gain * bandComp(q));
      n.start(start, rng.range(0, 1.5));
      src = n;
    } else if (kind === 'thump') {
      const o = ctx.createOscillator();
      o.type = 'sine';
      const f0 = l.freq * rate;
      const f1 = Math.max(20, f0 * (1 - (l.pitchDrop ?? 0)));
      o.frequency.setValueAtTime(f0, start);
      o.frequency.exponentialRampToValueAtTime(f1, start + Math.min(decay * 0.7, 0.09));
      nodes.push(o);
      if (f0 > 56) {
        const sh = ctx.createWaveShaper();
        sh.curve = saturation;
        o.connect(sh);
        sh.connect(env);
        nodes.push(sh);
      } else {
        o.connect(env);
      }
      end = envelope(gain);
      o.start(start);
      src = o;
    } else if (kind === 'pluck') {
      const s = ctx.createBufferSource();
      s.buffer = pluckBuffer(ctx, l.freq * rate, decay * 1.05, { t60: decay, bright: l.bright ?? 4000, seed: 7 });
      s.connect(env);
      nodes.push(s);
      env.gain.setValueAtTime(0, start);
      env.gain.linearRampToValueAtTime(gain, start + Math.max(attack, 0.0005));
      env.gain.linearRampToValueAtTime(0, start + decay * 1.05);
      end = start + decay * 1.05;
      s.start(start);
      src = s;
    } else {
      // the telephone-band sine
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = l.freq * rate;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = l.bandpass ?? l.freq;
      bp.Q.value = l.q ?? 0.7;
      o.connect(bp);
      bp.connect(env);
      nodes.push(o, bp);
      end = envelope(gain * 1.4);
      o.start(start);
      src = o;
    }
    src.stop(end + 0.03);
    if (end > lastEnd) {
      lastEnd = end;
      lastSrc = src;
    }
  }
  if (lastSrc) {
    lastSrc.onended = () => {
      for (const n of nodes) n.disconnect();
    };
  } else {
    out.disconnect();
  }
  return true;
}

/** The live sink, or null while the context is locked or suspended. */
function liveSink(): Sink | null {
  const mix = getMix();
  const ctx = getContext();
  if (!mix || !ctx || !isRunning()) return null;
  return { ctx, out: mix.sfx, now: () => ctx.currentTime, rng: liveRng };
}

/** Play a named sound now (or `when` seconds from now). No-op while audio is locked. */
export function play(name: SfxName, opts: PlayOpts = {}): void {
  const sink = liveSink();
  if (!sink) return;
  const r = RECIPES[name];
  const rate = opts.rate ?? 1 + (liveRng.next() - 0.5) * 0.1;
  playRecipe(sink, name, r, { ...opts, rate });
}

export interface Hum {
  stop(fadeS?: number): void;
}

/** The tape-motor hum under a boss fight: a looped, motor-modulated noise through a low-pass. */
export function startHum(): Hum | null {
  const sink = liveSink();
  if (!sink) return null;
  const { ctx } = sink;
  const now = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = motorBuffer(ctx);
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(HUM_LEVEL, now + 1.4);
  src.connect(lp);
  lp.connect(g);
  g.connect(sink.out);
  src.start(now);
  let stopped = false;
  return {
    stop(fadeS = 1.2) {
      if (stopped) return;
      stopped = true;
      const t = ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + fadeS);
      src.stop(t + fadeS + 0.05);
      src.onended = () => {
        src.disconnect();
        lp.disconnect();
        g.disconnect();
      };
    },
  };
}

/** Build the hum into any sink (offline render). */
export function humInto(sink: Sink, at = 0): void {
  const { ctx } = sink;
  const t = sink.now() + at;
  const src = ctx.createBufferSource();
  src.buffer = motorBuffer(ctx);
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  const g = ctx.createGain();
  g.gain.value = HUM_LEVEL;
  src.connect(lp);
  lp.connect(g);
  g.connect(sink.out);
  src.start(t);
}
