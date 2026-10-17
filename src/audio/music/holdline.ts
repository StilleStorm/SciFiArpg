/**
 * Profile B: the hold line (DESIGN 14.4). Tape music in the manner of the Studio Eksperymentalne Polskiego Radia:
 * a loop of self-generated material (plucks, pitched-noise swells, tape ticks) that goes through
 *   wow      0.3-0.8 Hz, a slow swing of a DelayNode's delayTime
 *   flutter  5-9 Hz, a faster, much smaller swing of the same delay
 *   hiss     filtered noise, quiet, under everything
 *   splices  hard gate cuts (and sometimes a jump of the play position)
 *   band     a high-pass + low-pass pair that narrows to 300-3400 Hz in bot hours
 *   beep     now and then, a telephone-band sine: the one raw tone
 * The same chain is used by C (lighter: less wow, less hiss) and by B+C.
 */
import type { Rng } from '../../core/rng';
import { noiseBuffer } from '../buffers';
import { STEPS_PER_BAR, type ProfileParams } from './profiles';
import { rollRange, type RollNote } from './roll';
import type { Scale } from './scale';

export interface TapeChain {
  /** Voices connect to these three layer gains. */
  main: GainNode;
  second: GainNode;
  reversed: GainNode;
  hissGain: GainNode;
  hp: BiquadFilterNode;
  lp: BiquadFilterNode;
  door: BiquadFilterNode;
  fade: GainNode;
  /** Nodes alive for the whole run. */
  readonly nodeCount: number;
  /** Close the gate for `seconds` from `at`: a splice. */
  cut(at: number, seconds: number): void;
  /** One hold-line beep at `at`. */
  beep(at: number, level?: number): void;
  /** Stop the oscillators and the noise, disconnect everything. */
  dispose(at: number): void;
}

const BEEP_HZ = 1040;
/** Base delay of the wow/flutter line in seconds; the LFOs swing around it. */
const BASE_DELAY = 0.012;

export function createTapeChain(ctx: BaseAudioContext, out: AudioNode, p: ProfileParams, at: number): TapeChain {
  const all: AudioNode[] = [];
  const mk = <T extends AudioNode>(n: T): T => {
    all.push(n);
    return n;
  };
  const main = mk(ctx.createGain());
  const second = mk(ctx.createGain());
  const reversed = mk(ctx.createGain());
  const gate = mk(ctx.createGain());
  const delay = mk(ctx.createDelay(0.05));
  delay.delayTime.value = BASE_DELAY;
  const wow = mk(ctx.createOscillator());
  const wowAmt = mk(ctx.createGain());
  const flutter = mk(ctx.createOscillator());
  const flutterAmt = mk(ctx.createGain());
  const hissSrc = mk(ctx.createBufferSource());
  const hissHp = mk(ctx.createBiquadFilter());
  const hissGain = mk(ctx.createGain());
  const beepBus = mk(ctx.createGain());
  const hp = mk(ctx.createBiquadFilter());
  const lp = mk(ctx.createBiquadFilter());
  const door = mk(ctx.createBiquadFilter());
  const fade = mk(ctx.createGain());

  for (const g of [main, second, reversed]) g.connect(gate);
  gate.connect(delay);
  wow.type = 'sine';
  wow.frequency.value = p.wowHz;
  wowAmt.gain.value = p.wowDepth;
  wow.connect(wowAmt);
  wowAmt.connect(delay.delayTime);
  flutter.type = 'sine';
  flutter.frequency.value = p.flutterHz;
  flutterAmt.gain.value = p.flutterDepth;
  flutter.connect(flutterAmt);
  flutterAmt.connect(delay.delayTime);

  hissSrc.buffer = noiseBuffer(ctx);
  hissSrc.loop = true;
  hissHp.type = 'highpass';
  hissHp.frequency.value = 2800;
  hissGain.gain.value = 0;
  hissSrc.connect(hissHp);
  hissHp.connect(hissGain);

  beepBus.gain.value = 1;
  hp.type = 'highpass';
  hp.frequency.value = p.band[0];
  hp.Q.value = 0.5;
  lp.type = 'lowpass';
  lp.frequency.value = p.band[1];
  lp.Q.value = 0.5;
  door.type = 'lowpass';
  door.frequency.value = 20000;
  door.Q.value = 0.5;
  fade.gain.value = 0;

  delay.connect(hp);
  hissGain.connect(hp);
  beepBus.connect(hp);
  hp.connect(lp);
  lp.connect(door);
  door.connect(fade);
  fade.connect(out);

  wow.start(at);
  flutter.start(at);
  hissSrc.start(at);

  return {
    main,
    second,
    reversed,
    hissGain,
    hp,
    lp,
    door,
    fade,
    nodeCount: all.length,
    cut(t, seconds) {
      gate.gain.cancelScheduledValues(t);
      gate.gain.setValueAtTime(1, Math.max(0, t - 0.001));
      gate.gain.linearRampToValueAtTime(0, t);
      gate.gain.setValueAtTime(0, t + seconds);
      gate.gain.linearRampToValueAtTime(1, t + seconds + 0.003);
    },
    beep(t, level = 0.12) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = BEEP_HZ;
      const e = ctx.createGain();
      e.gain.setValueAtTime(0, t);
      e.gain.linearRampToValueAtTime(level, t + 0.006);
      e.gain.setValueAtTime(level, t + 0.15);
      e.gain.linearRampToValueAtTime(0, t + 0.165);
      o.connect(e);
      e.connect(beepBus);
      o.start(t);
      o.stop(t + 0.18);
      o.onended = () => {
        o.disconnect();
        e.disconnect();
      };
    },
    dispose(t) {
      for (const n of [wow, flutter, hissSrc]) {
        try {
          n.stop(t);
        } catch {
          /* already stopped */
        }
      }
      hissSrc.onended = () => {
        for (const n of all) n.disconnect();
      };
    },
  };
}

/**
 * The hold line's own material: a short motif played again and again with small transpositions (the tape loop),
 * a slow bass pluck, a few pitched-noise swells and the ticks of the leader tape.
 * Ranks decide what survives in a calm page (the motif and the first swells), what joins when enemies come.
 */
export function generateHoldLoop(rng: Rng, scale: Scale, bars: number): RollNote[] {
  const out: RollNote[] = [];
  const range = rollRange(scale);
  const loopSteps = bars * STEPS_PER_BAR;
  // the motif: 3-5 notes in the upper half
  const motifLen = rng.int(3, 5);
  const motif: { at: number; degree: number }[] = [];
  let at = 0;
  let degree = rng.int(Math.floor(range * 0.45), Math.floor(range * 0.8));
  for (let i = 0; i < motifLen; i++) {
    motif.push({ at, degree });
    at += rng.int(1, 3);
    degree = Math.max(1, Math.min(range - 1, degree + rng.pick([-2, -1, 1, 2, 3])));
  }
  const every = rng.pick([2, 2, 4]);
  for (let bar = 0; bar < bars; bar += every) {
    const shift = bar === 0 ? 0 : rng.pick([0, 0, -1, 1, 2]);
    motif.forEach((m, i) => {
      const step = bar * STEPS_PER_BAR + m.at;
      if (step >= loopSteps) return;
      out.push({
        step,
        degree: Math.max(0, Math.min(range - 1, m.degree + shift)),
        steps: 2,
        vel: 0.55 + 0.15 * rng.next(),
        voice: 'pluck',
        rank: (bar === 0 ? 0.05 : 0.25 + 0.4 * rng.next()) + i * 0.01,
      });
    });
  }
  // slow low pluck on some bar lines
  for (let bar = 0; bar < bars; bar++) {
    if (!rng.chance(0.45)) continue;
    out.push({ step: bar * STEPS_PER_BAR, degree: rng.int(0, 2), steps: 4, vel: 0.7, voice: 'pluck', rank: 0.15 + 0.35 * rng.next() });
  }
  // pitched-noise swells
  const swells = rng.int(3, 5);
  for (let i = 0; i < swells; i++) {
    out.push({
      step: rng.int(0, bars - 1) * STEPS_PER_BAR + rng.pick([0, 4]),
      degree: rng.int(Math.floor(range * 0.2), Math.floor(range * 0.7)),
      steps: rng.int(12, 20),
      vel: 0.5,
      voice: 'swell',
      rank: i === 0 ? 0.1 : 0.4 + 0.5 * rng.next(),
    });
  }
  // leader-tape ticks
  const ticks = rng.int(6, 12);
  for (let i = 0; i < ticks; i++) {
    out.push({ step: rng.int(0, loopSteps - 1), degree: 0, steps: 1, vel: 0.35 + 0.2 * rng.next(), voice: 'tick', rank: 0.6 + 0.4 * rng.next() });
  }
  return out.sort((a, b) => a.step - b.step || a.degree - b.degree);
}
