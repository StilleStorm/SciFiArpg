/**
 * What the Pętlowiec's later skills and passives leave running. Kept beside the hero, not in `HeroRun`, so that the other heroes'
 * runs (and the contract snapshot) are untouched: one record per live `RunState`, made on first use. Nothing here is saved.
 */
import type { DamageType } from '../../combat/damage';
import type { StatusKind } from '../../combat/status';
import type { Bus } from '../../core/events';
import type { RunState } from '../../world/run';

/** Something that happens at run time `at` (an echo lands). */
export interface Timer {
  at: number;
  run(s: RunState, bus: Bus): void;
}

/** Where he and every enemy stood at run time `t` on page `page` (Cofnięcie zgłoszenia withdraws to one of these). */
export interface Snap {
  t: number;
  page: number;
  x: number;
  y: number;
  hp: number;
  at: Map<number, readonly [number, number]>;
}

/** Opóźnienie while it runs: until when hits are logged, after how long they land, what share, and whether they go to an enemy (§ 3). */
export interface Delay {
  until: number;
  delay: number;
  share: number;
  toEnemy: boolean;
  type: DamageType;
}

/** A logged hit that is owed: it lands at `at`. */
export interface Owed {
  at: number;
  amount: number;
  toEnemy: boolean;
  type: DamageType;
}

/** A Paradoks on the page (by zone id): what an echo is and of which type, and the marker its paragraph lays inside. */
export interface Clock {
  share: number;
  type: DamageType;
  status?: { kind: StatusKind; seconds: number };
}

/** A line left standing by Powtórzenie § 3 (by zone id). */
export interface Written {
  x: number;
  y: number;
  dx: number;
  dy: number;
  reach: number;
  half: number;
  type: DamageType;
  /** The factor each tick of TICK_S deals. */
  tick: number;
}

export interface PetlState {
  snaps: Snap[];
  lastSnap: number;
  timers: Timer[];
  delay: Delay | null;
  owed: Owed[];
  clocks: Map<number, Clock>;
  written: Map<number, Written>;
  /** Seconds gathered towards the next tick of the standing lines. */
  acc: number;
  /** True while an echo or a delayed hit is being dealt (the events they raise are not logged or echoed again). */
  dealing: boolean;
  /** Projectiles already looked at for passive 8, so a shot is raised once. */
  seen: WeakSet<object>;
  /** Passive 9: the skill cast last (not free) and how many times in a row. */
  streak: { skill: number; n: number };
  /** Run time of the last tick (the quirk is handed no dt). */
  last: number;
}

const states = new WeakMap<RunState, PetlState>();

export function petlState(s: RunState): PetlState {
  let k = states.get(s);
  if (!k) {
    k = {
      snaps: [],
      lastSnap: -1e9,
      timers: [],
      delay: null,
      owed: [],
      clocks: new Map(),
      written: new Map(),
      acc: 0,
      dealing: false,
      seen: new WeakSet(),
      streak: { skill: -1, n: 0 },
      last: s.time,
    };
    states.set(s, k);
  }
  return k;
}

/** The record if one was ever made (a handler that must not create it). */
export const petlStateIfAny = (s: RunState): PetlState | undefined => states.get(s);
