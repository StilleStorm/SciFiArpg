/**
 * The adaptation layer (DESIGN 14.4), shared by all profiles: run state in, gain targets per layer out.
 * Pure functions; the engine eases the audio parameters toward the targets over 2-4 seconds
 * (a time constant of 1 s reaches 95% in 3 s).
 *
 *   calm        sparse: the strongest pins of the roll, no second voice, no splices (hold line: a few)
 *   near        more than 2 enemies close: a second voice a fifth below, slightly late, more notes
 *   elite       splices begin, a reversed fragment every 8 bars
 *   boss        tempo x1.25, hiss up, splices often; every boss phase is a hard cut (an event)
 *   bot hours   telephone band only (300-3400 Hz) and a hold beep every 4 s
 *   paused      the same: the pause sheet is the line on hold ("muzyka na czekanie"), driven by `game:paused`
 *   reversed    the loop runs backwards (Czas wsteczny)
 *   suspended   ducked 12 dB and low-passed, as if behind a door (Zawieszenie)
 *   death       the mechanism slows to a stop, no sting
 *   page turn   a splice (an event), the level dips while the sheet is in the air
 */
import type { ProfileId } from './profiles';

export interface MusicFlags {
  /** Enemies within earshot (state.enemies near the player). */
  enemiesNear: number;
  elite: boolean;
  boss: boolean;
  botTime: boolean;
  /** The pause sheet holds the run: treated exactly like botTime (telephone band, hold beep). */
  paused: boolean;
  reversed: boolean;
  suspended: boolean;
  dead: boolean;
  pageTurn: boolean;
  /** The player is in the base page of the planet: the calm layer only, 6 dB down (DESIGN 4.1). Absent = false. */
  base?: boolean;
}

export const CALM_FLAGS: MusicFlags = {
  enemiesNear: 0,
  elite: false,
  boss: false,
  botTime: false,
  paused: false,
  reversed: false,
  suspended: false,
  dead: false,
  pageTurn: false,
  base: false,
};

/** The base page plays the calm layer at this level (-6 dB). */
export const BASE_LEVEL = 0.5;

/** More than this many enemies near brings in the second voice. */
export const NEAR_COUNT = 2;
export const CROSSFADE_TAU = 1.0;
/** Telephone band. */
export const PHONE_BAND: readonly [number, number] = [300, 3400];
export const BOT_BEEP_S = 4;

export interface Targets {
  /** Gain of the first voice. */
  main: number;
  /** Second voice (a fifth below, late). */
  second: number;
  /** Reversed fragments layer. */
  reversed: number;
  /** Multiplier on the profile's hiss bed. */
  hiss: number;
  /** Share of the roll's pins that sound (rank <= density). */
  density: number;
  /** Tempo multiplier; 0 = stopped. */
  tempo: number;
  /** Multiplier on the profile's splice rate per bar. */
  splice: number;
  /** A reversed fragment every this many bars; 0 = none. */
  reversedEvery: number;
  /** A hold beep every this many seconds; 0 = only the profile's occasional one. */
  beepEvery: number;
  /** Band: null = the profile's own band. */
  band: readonly [number, number] | null;
  /** Low-pass of the "door" in Hz (>= 18000 = open). */
  door: number;
  /** Overall level (1 = full, 0.25 = -12 dB). */
  level: number;
  /** +1 forwards, -1 backwards. */
  direction: 1 | -1;
}

const CALM_SPLICE: Record<ProfileId, number> = { B: 0.35, C: 0, BC: 0.2 };

export function adaptTargets(f: MusicFlags, profile: ProfileId): Targets {
  const t: Targets = {
    main: 1,
    second: 0,
    reversed: profile === 'BC' ? 0.55 : 0,
    hiss: 1,
    density: 0.55,
    tempo: 1,
    splice: CALM_SPLICE[profile],
    reversedEvery: profile === 'BC' ? 16 : 0,
    beepEvery: 0,
    band: null,
    door: 20000,
    level: 1,
    direction: 1,
  };
  const near = f.enemiesNear > NEAR_COUNT;
  if (near || f.elite || f.boss) {
    t.second = 0.65;
    t.density = 0.8;
    t.hiss = 1.15;
  }
  if (f.elite || f.boss) {
    t.density = 0.9;
    t.splice = 1;
    t.reversedEvery = 8;
    t.reversed = Math.max(t.reversed, 0.55);
    t.hiss = 1.3;
  }
  if (f.boss) {
    t.density = 1;
    t.tempo = 1.25;
    t.hiss = 2;
    t.splice = 1.6;
  }
  if (f.botTime || f.paused) {
    t.band = PHONE_BAND;
    t.main = 0.85;
    t.second = 0;
    t.reversed = 0;
    t.reversedEvery = 0;
    t.density = 0.5;
    t.splice = 0;
    t.beepEvery = BOT_BEEP_S;
    t.hiss = 1;
  }
  if (f.reversed) t.direction = -1;
  if (f.suspended) {
    t.level *= 0.25;
    t.door = 650;
  }
  if (f.pageTurn) t.level *= 0.35;
  if (f.base) t.level *= BASE_LEVEL;
  if (f.dead) {
    t.tempo = 0;
    t.level = 0;
    t.second = 0;
    t.hiss = 0;
    t.beepEvery = 0;
    t.splice = 0;
    t.reversedEvery = 0;
  }
  return t;
}

export type MusicState = 'calm' | 'near' | 'elite' | 'boss' | 'botTime' | 'paused' | 'reversed' | 'suspended' | 'death' | 'pageTurn';

/** The dominant state, for logs and the render script. */
export function describeState(f: MusicFlags): MusicState {
  if (f.dead) return 'death';
  if (f.suspended) return 'suspended';
  if (f.botTime) return 'botTime';
  if (f.paused) return 'paused';
  if (f.pageTurn) return 'pageTurn';
  if (f.boss) return 'boss';
  if (f.elite) return 'elite';
  if (f.reversed) return 'reversed';
  if (f.enemiesNear > NEAR_COUNT) return 'near';
  return 'calm';
}

/** The named states the render script and tests iterate over. */
export const RENDER_STATES: Record<'calm' | 'enemies' | 'elite' | 'boss' | 'botTime' | 'reversed', MusicFlags> = {
  calm: CALM_FLAGS,
  enemies: { ...CALM_FLAGS, enemiesNear: 5 },
  elite: { ...CALM_FLAGS, enemiesNear: 5, elite: true },
  boss: { ...CALM_FLAGS, enemiesNear: 5, boss: true },
  botTime: { ...CALM_FLAGS, enemiesNear: 3, botTime: true },
  reversed: { ...CALM_FLAGS, enemiesNear: 1, reversed: true },
};

/** One step of a first-order ease toward `target` over about `tau` seconds. */
export function ease(current: number, target: number, dt: number, tau = CROSSFADE_TAU): number {
  return target + (current - target) * Math.exp(-dt / tau);
}

export function sameFlags(a: MusicFlags, b: MusicFlags): boolean {
  return (
    a.enemiesNear > NEAR_COUNT === b.enemiesNear > NEAR_COUNT &&
    a.elite === b.elite &&
    a.boss === b.boss &&
    a.botTime === b.botTime &&
    a.paused === b.paused &&
    a.reversed === b.reversed &&
    a.suspended === b.suspended &&
    a.dead === b.dead &&
    a.pageTurn === b.pageTurn &&
    (a.base === true) === (b.base === true)
  );
}
