/**
 * Sound profiles (DESIGN 14.4). One per planet, chosen from the dominant enemy family; tempo, scale, loop length,
 * filter band and splice rate are rolled from the run's rng fork 'music', so two planets with the same profile differ.
 *   B   hold line      Powiadomienia
 *   C   punched roll   Urzadzenia
 *   BC  the roll played through the hold line, with reversed fragments   Wygenerowane
 */
import type { Rng } from '../../core/rng';
import type { FamilyId } from '../../enemies/ids';
import { rollScale, type Scale } from './scale';

export type ProfileId = 'B' | 'C' | 'BC';
export const PROFILE_IDS: readonly ProfileId[] = ['B', 'C', 'BC'];

export interface ProfileParams {
  id: ProfileId;
  /** Beats per minute; a step is an eighth note. */
  bpm: number;
  scale: Scale;
  /** Frequency of degree 0. */
  rootHz: number;
  /** 8-16 bars of 8 steps. */
  loopBars: number;
  /** The tape band (Hz) outside bot hours. */
  band: readonly [number, number];
  /** Chance of a splice at a bar line, before the adaptation multiplier. */
  spliceRate: number;
  wowHz: number;
  /** Delay-time swing in seconds. */
  wowDepth: number;
  flutterHz: number;
  flutterDepth: number;
  /** Level of the hiss bed. */
  hiss: number;
  /** Mean seconds between occasional hold-line beeps (0 = none). */
  beepEveryS: number;
  /** Seeds the generated material of the hold line. */
  seed: number;
}

export const STEPS_PER_BAR = 8;

export function profileForFamily(family: FamilyId | undefined): ProfileId {
  if (family === 'powiadomienia') return 'B';
  if (family === 'wygenerowane') return 'BC';
  return 'C';
}

export function rollProfile(id: ProfileId, rng: Rng): ProfileParams {
  const tape = id !== 'C';
  const light = tape ? 1 : 0.45;
  return {
    id,
    bpm: Math.round(rng.range(58, 92)),
    scale: rollScale(rng),
    rootHz: Math.round(130 * 2 ** rng.range(0, 1)),
    loopBars: rng.int(8, 16),
    band: tape ? [Math.round(rng.range(200, 320)), Math.round(rng.range(3600, 6200))] : [Math.round(rng.range(110, 200)), Math.round(rng.range(6000, 9000))],
    spliceRate: rng.range(0.08, 0.3),
    wowHz: rng.range(0.3, 0.8),
    wowDepth: rng.range(0.0022, 0.0038) * light,
    flutterHz: rng.range(5.5, 9),
    flutterDepth: rng.range(0.00006, 0.00012) * light,
    hiss: (tape ? rng.range(0.035, 0.06) : rng.range(0.012, 0.022)),
    beepEveryS: id === 'C' ? 0 : rng.range(22, 44),
    seed: rng.int(1, 1e9),
  };
}
