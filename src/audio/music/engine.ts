/**
 * The music engine: one profile playing on one context. Works on any BaseAudioContext with an injected clock,
 * so the same code runs live (clock = ctx.currentTime, driven by the game loop) and offline (clock = a counter
 * that the render script advances in 25 ms ticks, scheduling the whole file in one go).
 *
 * Node budget (DESIGN: under ~40 alive at once): the tape chain holds 17 for the whole run; a note is a
 * source and a gain (2), at most MAX_VOICES notes ring at the same time (reversed fragments and the second
 * voice count), plus a beep (2) and a splice tick (2) in flight.
 */
import type { Rng } from '../../core/rng';
import { bellBuffer, noiseBuffer, pluckBuffer, swellBuffer } from '../buffers';
import { adaptTargets, CALM_FLAGS, CROSSFADE_TAU, ease, type MusicFlags, type Targets } from './adapt';
import { createTapeChain, generateHoldLoop, type TapeChain } from './holdline';
import { STEPS_PER_BAR, type ProfileId, type ProfileParams } from './profiles';
import { readRoll, type RollNote, type RollPage, type Voice } from './roll';
import { createScheduler, type StepScheduler } from './scheduler';
import { degreeBelow, degreeFreq } from './scale';

export interface Clock {
  now(): number;
}

export const MAX_VOICES = 8;
export const NODES_PER_VOICE = 2;
/** A beep (oscillator + envelope) and a splice tick (source + gain) may be in flight on top of the voices. */
export const TRANSIENT_NODES = 4;
export const NODE_LIMIT = 40;

/** Level of one voice kind before the layer gain; velocity multiplies it. */
const VOICE_LEVEL: Record<Voice, number> = { pluck: 1.5, bell: 1.0, tick: 0.35, swell: 1.2 };
/** Where the chain's fade sits at full level, per profile: the music's own headroom under the SFX (B is sparser, so a little more). */
const OUT_LEVEL: Record<ProfileId, number> = { B: 0.7, C: 0.5, BC: 0.5 };
/** Hiss: the profile's value is multiplied by this. */
const HISS_SCALE = 1;
/** Below this tempo multiplier the mechanism has stopped and nothing more is scheduled. */
const PARK_TEMPO = 0.09;

export interface EngineInfo {
  loopSteps: number;
  pos: number;
  bars: number;
  voicesAlive: number;
  persistentNodes: number;
  parked: boolean;
  notes: number;
}

export interface MusicEngine {
  readonly params: ProfileParams;
  /** Schedule what falls into the look-ahead. Cheap to call every frame. */
  tick(): void;
  /** New run state. `immediate` sets everything at once (offline renders, the first call). */
  setFlags(f: MusicFlags, immediate?: boolean): void;
  /** The page whose obstacles are the roll. Takes effect at the next bar line. */
  setPage(page: RollPage | null): void;
  /** A hard splice: 'phase' (boss), 'turn' (page turn; also swaps the roll at once). */
  cut(kind: 'phase' | 'turn'): void;
  /** Fade out and stop. */
  stop(fadeS?: number): void;
  info(): EngineInfo;
  readonly targets: Targets;
}

interface Content {
  steps: number;
  byStep: Map<number, RollNote[]>;
  notes: number;
  /** The bar line of the first note: playing starts there, so a page never opens with seconds of silence. */
  start: number;
}

export interface EngineOpts {
  ctx: BaseAudioContext;
  out: AudioNode;
  clock: Clock;
  params: ProfileParams;
  rng: Rng;
  page: RollPage | null;
  flags?: MusicFlags;
  /** Seconds to ease in at the start (default 1.5). */
  fadeInS?: number;
}

interface Voice1 {
  src: AudioBufferSourceNode;
  end: number;
}

export function createMusicEngine(o: EngineOpts): MusicEngine {
  const { ctx, clock, params } = o;
  const rng = o.rng.fork('engine');
  const loopSteps = params.loopBars * STEPS_PER_BAR;
  const stepBase = 60 / params.bpm / 2;
  const chain: TapeChain = createTapeChain(ctx, o.out, params, clock.now());
  const sched: StepScheduler = createScheduler();
  const holdLoop = (): RollNote[] => generateHoldLoop(o.rng.fork('loop'), params.scale, params.loopBars);

  const build = (page: RollPage | null): Content => {
    const notes = params.id === 'B' || !page ? holdLoop() : readRoll(page, params.scale, loopSteps);
    const byStep = new Map<number, RollNote[]>();
    for (const n of notes) {
      const list = byStep.get(n.step) ?? [];
      list.push(n);
      byStep.set(n.step, list);
    }
    const first = notes.reduce((m, n) => Math.min(m, n.step), loopSteps);
    return { steps: loopSteps, byStep, notes: notes.length, start: notes.length ? first - (first % STEPS_PER_BAR) : 0 };
  };

  let page: RollPage | null = o.page;
  let content = build(page);
  /** Buffers still to be synthesized ahead of need, one per tick: no frame pays for a whole bell at once. */
  let warm: (() => void)[] = [];
  const queueWarm = (c: Content): void => {
    const seen = new Set<string>();
    warm = [];
    for (const list of c.byStep.values()) {
      for (const ev of list) {
        if (ev.voice === 'tick') continue;
        const k = `${ev.voice}|${ev.degree}|${ev.steps}`;
        if (seen.has(k)) continue;
        seen.add(k);
        warm.push(() => void bufferFor(ev, ev.degree, false));
        if (ev.voice !== 'swell') warm.push(() => void bufferFor({ ...ev, voice: 'pluck' }, degreeBelow(params.scale, ev.degree), false));
      }
    }
  };
  let pending: { page: RollPage | null } | undefined;
  let tgt: Targets = adaptTargets(o.flags ?? CALM_FLAGS, params.id);
  let flags: MusicFlags = o.flags ?? CALM_FLAGS;
  const cur = { tempo: tgt.tempo, density: tgt.density, second: tgt.second, direction: tgt.direction as number };
  let pos = content.start;
  let bars = 0;
  /** Step within the current bar (0..7), counted as played. */
  let stepInBar = 0;
  /** The notes played in the last bar and in this one, by step in bar: the material of a reversed fragment. */
  let prevBar: { ev: RollNote; k: number }[] = [];
  let thisBar: { ev: RollNote; k: number }[] = [];
  let reverseThisBar = false;
  /** The last pitched note played, and an echo of it armed for a bar the page leaves empty. */
  let lastNote: RollNote | null = null;
  let echo: RollNote | null = null;
  let voices: Voice1[] = [];
  let parked = false;
  let stopped = false;
  let lastNow = clock.now();
  let nextBeep = -1;
  let nextOccasional = clock.now() + 8 + rng.range(0, params.beepEveryS);

  // ---- parameters ----
  const applyTargets = (immediate: boolean): void => {
    const at = clock.now();
    const set = (p: AudioParam, v: number, tau = CROSSFADE_TAU): void => {
      if (immediate) p.setValueAtTime(v, at);
      else p.setTargetAtTime(v, at, tau);
    };
    const band = tgt.band ?? params.band;
    set(chain.main.gain, tgt.main);
    set(chain.second.gain, tgt.second);
    set(chain.reversed.gain, tgt.reversed);
    set(chain.hissGain.gain, params.hiss * HISS_SCALE * tgt.hiss);
    set(chain.hp.frequency, band[0]);
    set(chain.lp.frequency, band[1]);
    set(chain.door.frequency, tgt.door);
    set(chain.fade.gain, tgt.level * OUT_LEVEL[params.id], flags.dead ? 1.4 : CROSSFADE_TAU);
    if (immediate) {
      cur.tempo = tgt.tempo;
      cur.density = tgt.density;
      cur.second = tgt.second;
      cur.direction = tgt.direction;
    }
  };
  chain.fade.gain.setValueAtTime(0, clock.now());
  applyTargets(true);
  // start of the run: ease in rather than switch on
  chain.fade.gain.setValueAtTime(0, clock.now());
  chain.fade.gain.linearRampToValueAtTime(tgt.level * OUT_LEVEL[params.id], clock.now() + (o.fadeInS ?? 1.5));

  // ---- voices ----
  const aliveAt = (t: number): number => {
    voices = voices.filter((v) => v.end > t - 0.05);
    return voices.filter((v) => v.end > t).length;
  };

  const layerNode = (layer: 'main' | 'second' | 'reversed'): GainNode => (layer === 'main' ? chain.main : layer === 'second' ? chain.second : chain.reversed);

  /** The buffer of a note, synthesized on first use and cached; null for a tick (noise, no pitch). */
  const bufferFor = (ev: RollNote, degree: number, reverse: boolean): AudioBuffer | null => {
    const freq = degreeFreq(params.scale, params.rootHz, degree);
    if (freq < 40 || freq > 5000) return null;
    const sec = stepBase * Math.max(1, ev.steps);
    if (ev.voice === 'bell') return bellBuffer(ctx, freq, Math.min(2, 0.8 + sec * 0.9), { t60: 0.7 + sec * 0.5, detune: 7 }, reverse);
    if (ev.voice === 'swell') return swellBuffer(ctx, freq, Math.min(5, sec), params.seed & 7);
    if (ev.voice === 'tick') return null;
    return pluckBuffer(ctx, freq, Math.min(2.4, 0.7 + sec * 1.1), { t60: 0.6 + sec * 0.9, bright: 3200, seed: 11 }, reverse);
  };

  queueWarm(content);

  const playNote = (ev: RollNote, time: number, layer: 'main' | 'second' | 'reversed', degree: number, vel: number, reverse: boolean): void => {
    if (aliveAt(time) >= MAX_VOICES) return;
    if (ev.voice === 'tick') {
      tickAt(time, vel);
      return;
    }
    const buf = bufferFor(ev, degree, reverse);
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.detune.value = rng.range(-5, 5);
    const rate = Math.max(0.3, cur.tempo < 1 ? cur.tempo ** 0.5 : 1);
    src.playbackRate.value = reverse && ev.voice === 'swell' ? 1 : rate;
    const g = ctx.createGain();
    g.gain.value = vel * VOICE_LEVEL[ev.voice];
    src.connect(g);
    g.connect(layerNode(layer));
    const end = time + buf.duration / rate;
    src.start(time);
    src.stop(end + 0.02);
    src.onended = () => {
      src.disconnect();
      g.disconnect();
    };
    voices.push({ src, end });
  };

  /** A leader-tape tick or a splice: a few ms of noise. */
  const tickAt = (time: number, vel: number): void => {
    if (aliveAt(time) >= MAX_VOICES + 1) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(vel * VOICE_LEVEL.tick, time + 0.0008);
    g.gain.exponentialRampToValueAtTime(0.0008, time + 0.014);
    src.connect(g);
    g.connect(chain.main);
    src.start(time, rng.range(0, 1.5));
    src.stop(time + 0.02);
    src.onended = () => {
      src.disconnect();
      g.disconnect();
    };
    voices.push({ src, end: time + 0.02 });
  };

  const playEvent = (ev: RollNote, time: number): void => {
    const reverse = cur.direction < 0;
    playNote(ev, time, 'main', ev.degree, ev.vel, reverse);
    if (cur.second > 0.03 && (ev.voice === 'pluck' || ev.voice === 'bell')) {
      // a fifth below, slightly late
      playNote({ ...ev, voice: 'pluck' }, time + 0.06 + rng.range(0, 0.03), 'second', degreeBelow(params.scale, ev.degree), ev.vel * 0.8, reverse);
    }
    if (thisBar.length < 8) thisBar.push({ ev, k: stepInBar });
    if (ev.voice !== 'tick') lastNote = ev;
  };

  const splice = (time: number, jump: boolean): void => {
    chain.cut(time, rng.range(0.018, 0.045));
    tickAt(time, 0.8);
    if (jump && rng.chance(0.6)) pos = (((pos + rng.pick([-3, -2, -1, 1, 2, 3]) * STEPS_PER_BAR) % loopSteps) + loopSteps) % loopSteps;
  };

  const barLine = (time: number): void => {
    bars++;
    if (pending !== undefined) {
      page = pending.page;
      content = build(page);
      queueWarm(content);
      pending = undefined;
      pos = cur.direction < 0 ? (content.start + STEPS_PER_BAR - 1) % loopSteps : content.start;
    }
    // A bar the page leaves empty is not silence: the last note comes back twice, softer, like paper creaking.
    const bar0 = cur.direction < 0 ? pos - (STEPS_PER_BAR - 1) : pos;
    let anyNote = false;
    for (let k = 0; k < STEPS_PER_BAR && !anyNote; k++) {
      const list = content.byStep.get((((bar0 + k) % loopSteps) + loopSteps) % loopSteps);
      anyNote = list !== undefined && list.some((e) => e.rank <= cur.density);
    }
    echo = anyNote ? null : lastNote;
    // a reversed fragment: this bar echoes the notes of the last one, backwards, step by step
    reverseThisBar = tgt.reversedEvery > 0 && bars % tgt.reversedEvery === 0;
    prevBar = thisBar;
    thisBar = [];
    stepInBar = 0;
    if (tgt.splice > 0 && rng.chance(params.spliceRate * tgt.splice)) splice(time, true);
    if (params.beepEveryS > 0 && tgt.beepEvery === 0 && time > nextOccasional) {
      chain.beep(time + 0.2, 0.1);
      nextOccasional = time + params.beepEveryS * rng.range(0.7, 1.4);
    }
  };

  const onStep = (time: number): void => {
    const dir = cur.direction < 0 ? -1 : 1;
    const atBarLine = dir > 0 ? pos % STEPS_PER_BAR === 0 : pos % STEPS_PER_BAR === STEPS_PER_BAR - 1;
    if (atBarLine) barLine(time);
    const list = content.byStep.get(pos);
    if (list) for (const ev of list) if (ev.rank <= cur.density) playEvent(ev, time);
    if (echo && (stepInBar === 0 || stepInBar === 4)) playNote(echo, time, 'main', echo.degree, echo.vel * (stepInBar === 0 ? 0.45 : 0.3), cur.direction < 0);
    if (reverseThisBar) for (const e of prevBar) if (e.k === stepInBar) playNote(e.ev, time, 'reversed', e.ev.degree, e.ev.vel * 0.9, true);
    stepInBar++;
    pos = (((pos + dir) % loopSteps) + loopSteps) % loopSteps;
  };

  const info = (): EngineInfo => ({
    loopSteps,
    pos,
    bars,
    voicesAlive: aliveAt(clock.now()),
    persistentNodes: chain.nodeCount,
    parked,
    notes: content.notes,
  });

  return {
    params,
    get targets() {
      return tgt;
    },
    tick() {
      if (stopped) return;
      const now = clock.now();
      if (!sched.due(now)) return;
      const dt = Math.min(0.5, Math.max(0, now - lastNow));
      lastNow = now;
      cur.tempo = ease(cur.tempo, tgt.tempo, dt, flags.dead ? 1.6 : CROSSFADE_TAU);
      cur.density = ease(cur.density, tgt.density, dt);
      cur.second = ease(cur.second, tgt.second, dt);
      cur.direction = tgt.direction;
      if (cur.tempo < PARK_TEMPO) {
        parked = true;
        sched.run(now, () => 1e6, () => undefined);
        return;
      }
      if (parked) {
        parked = false;
        sched.reset(now);
      }
      sched.run(now, () => stepBase / Math.max(PARK_TEMPO, cur.tempo), onStep);
      warm.shift()?.();
      if (tgt.beepEvery > 0) {
        if (nextBeep < 0) nextBeep = now + 0.4;
        while (nextBeep < now + 0.1) {
          chain.beep(nextBeep, 0.14);
          nextBeep += tgt.beepEvery;
        }
      } else nextBeep = -1;
    },
    setFlags(f, immediate = false) {
      const wasDead = flags.dead;
      flags = f;
      tgt = adaptTargets(f, params.id);
      applyTargets(immediate);
      if (f.dead && !wasDead) {
        const now = clock.now();
        for (const v of voices) if (v.end > now) v.src.playbackRate.setTargetAtTime(0.12, now, 1.1);
      }
    },
    setPage(next) {
      pending = { page: next };
    },
    cut(kind) {
      const now = clock.now() + 0.02;
      if (kind === 'turn') {
        chain.cut(now, 0.07);
        tickAt(now, 0.9);
        // The roll of the new page begins at once: swap now, play it from the first step.
        if (pending) page = pending.page;
        content = build(page);
        queueWarm(content);
        pending = undefined;
        pos = cur.direction < 0 ? (content.start + STEPS_PER_BAR - 1) % loopSteps : content.start;
      } else {
        splice(now, true);
        chain.cut(now, 0.09);
      }
    },
    stop(fadeS = 1.5) {
      if (stopped) return;
      stopped = true;
      const now = clock.now();
      chain.fade.gain.cancelScheduledValues(now);
      chain.fade.gain.setValueAtTime(chain.fade.gain.value, now);
      chain.fade.gain.linearRampToValueAtTime(0, now + fadeS);
      chain.dispose(now + fadeS + 0.1);
    },
    info,
  };
}
