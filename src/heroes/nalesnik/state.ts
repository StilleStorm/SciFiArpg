/**
 * What the Nalesnik's skills 6 to 10, his ultimates 2 and 3 and passives 8 to 10 leave running. Kept beside the hero, not in `HeroRun`,
 * so that the other heroes' runs (and the contract snapshot) are untouched: one record per live `RunState`, made on first use.
 * Nothing here is saved. The numbers a roll or a ring strikes with are fixed at the cast (the active paragraph may change later).
 */
import type { DamageType } from '../../combat/damage';
import type { RunState } from '../../world/run';

/** Krawedz: the short roll at a target. */
export interface EdgeRoll {
  dx: number;
  dy: number;
  left: number;
  speed: number;
  /** The enemy the roll goes for (the only one struck unless `all`). */
  target: number;
  all: boolean;
  type: DamageType;
  mul: number;
  mark: boolean;
  hit: number[];
}

/** Pierscien: a band of debris round the hero; whoever enters it is struck once per crossing. */
export interface DebrisRing {
  zone: number;
  mid: number;
  half: number;
  until: number;
  type: DamageType;
  mul: number;
  existence: boolean;
  /** Enemy ids that were in the band at the last step. */
  inside: Set<number>;
}

/** Zaokraglenie (and the round of Upadek): what was laid on the hero and is taken back at `until`. */
export interface RoundBuff {
  until: number;
  upor: number;
  /** Resist added to the three types (negative: taken more), and the walking-speed factor applied (1: none). */
  resist: number;
  speed: number;
}

/** A crater on the page (Upadek § 3, Zderzenie): damage a second and/or a marker on whoever stands in it. */
export interface Crater {
  zone: number;
  x: number;
  y: number;
  r: number;
  until: number;
  type: DamageType;
  mul: number;
  mark: boolean;
  acc: number;
}

/** Zmiana orbity: the curve the hero rolls along. */
export interface Swerve {
  from: { x: number; y: number };
  ctrl: { x: number; y: number };
  to: { x: number; y: number };
  t: number;
  dur: number;
  type: DamageType;
  /** Damage of a crossed enemy (0: none, § 2) and whether § 3 lands with a ring. */
  dmg: number;
  ring: boolean;
  ringMul: number;
  ringR: number;
  hit: number[];
}

/** Zderzenie: the roll through the crowd. */
export interface Collision {
  dx: number;
  dy: number;
  left: number;
  speed: number;
  type: DamageType;
  mul: number;
  teren: boolean;
  hit: number[];
  /** Where the roll began, for the Teren zones of § 2 and the line drawn. */
  from: { x: number; y: number };
}

export interface NalState {
  edge: EdgeRoll | null;
  ring: DebrisRing | null;
  round: RoundBuff | null;
  craters: Crater[];
  swerve: Swerve | null;
  collision: Collision | null;
  /** Passive 9: the bonus gathered for the next ofensywna, the enemies pulled in the pull being counted, and that pull (to see a new one). */
  mass: number;
  massSeen: Set<number>;
  massFor: object | null;
  /** The factor Plywy's tide strikes with while it runs (the bonus of passive 9 taken at its cast). */
  tideMul: number;
  /** Passive 10: run time of the satellite's next blow. */
  satelliteAt: number;
  /** Pelnia: the upor laid on the hero while it runs (taken back at the end). */
  pelniaUpor: number;
  /** Run time of the last tick of the quirk (-1: none yet), for the seconds between two. */
  last: number;
}

const states = new WeakMap<RunState, NalState>();

export function nalState(s: RunState): NalState {
  let k = states.get(s);
  if (!k) {
    k = {
      edge: null,
      ring: null,
      round: null,
      craters: [],
      swerve: null,
      collision: null,
      mass: 0,
      massSeen: new Set(),
      massFor: null,
      tideMul: 1,
      satelliteAt: 0,
      pelniaUpor: 0,
      last: -1,
    };
    states.set(s, k);
  }
  return k;
}

/** The record if one was ever made (a hook that must not create it). */
export const nalStateIfAny = (s: RunState): NalState | undefined => states.get(s);
