/**
 * What the Konsultant's new skills and passives leave running. Kept beside the hero, not in `HeroRun`, so that the other heroes'
 * runs (and the contract snapshot) are untouched: one record per live `RunState`, made on first use. Nothing here is saved.
 */
import type { Claim } from '../../combat/claims';
import type { DamageType } from '../../combat/damage';
import type { StatusKind } from '../../combat/status';
import type { Bus } from '../../core/events';
import type { Enemy } from '../../entities/types';
import type { RunState } from '../../world/run';

/** Something that happens at run time `at` (the phone rings, the blow lands). */
export interface Timer {
  at: number;
  run(s: RunState, bus: Bus): void;
}

/** A Formularz kontaktowy on the page: what it deals each second and of which type. */
export interface FormInfo {
  dmg: number;
  type: DamageType;
}

/** "Pole obowiazkowe": the ones inside at the cast may not leave the circle until `until`. */
export interface Cage {
  x: number;
  y: number;
  r: number;
  until: number;
  ids: number[];
}

/** Muzyka w sluchawce while it plays: the resist points added to every type, the circle round him, a status the paragraph lays. */
export interface Aura {
  until: number;
  r: number;
  added: number;
  status?: { kind: StatusKind; seconds: number };
}

/** A chair left behind by Przerwa techniczna: how far it pulls, how hard it strikes back (0: not at all) and when it may strike next. */
export interface Chair {
  pullR: number;
  strike: number;
  type: DamageType;
  next: number;
}

export interface KonsState {
  timers: Timer[];
  forms: Map<number, FormInfo>;
  cages: Cage[];
  aura: Aura | null;
  chairs: Map<number, Chair>;
  /** Ids of the zones and summons that are his: a status with such a source is "his" (Numerek, Koniec kolejki). */
  owned: Set<number>;
  /** Passive 8: enemy id -> its number in the queue; the next number; the chain of kills in order; the crit it added and until when. */
  numbered: Map<number, number>;
  nextNumber: number;
  chain: number;
  critAdded: number;
  critUntil: number;
  /** The enemy ids alive at the last step, and the kill count then: a vanished id with a kill behind it is a death. */
  alive: Set<number>;
  kills: number;
  /** Passive 9: the blocked enemies' last place and claim; the claim each bubble on the floor (zone id) carries. */
  blocked: Map<number, { x: number; y: number; claim: Claim }>;
  tapes: Map<number, Claim>;
  /** Koniec kolejki: the direction of the line and the seconds between two disconnected calls. */
  queue: { dx: number; dy: number; gap: number };
  /** Run time of the last tick (the quirk is handed no dt). */
  last: number;
  /** Passive 10: how many times Czy moge jeszcze w czyms pomoc was asked this run. */
  asked: number;
}

const states = new WeakMap<RunState, KonsState>();

export function konsState(s: RunState): KonsState {
  let k = states.get(s);
  if (!k) {
    k = {
      timers: [],
      forms: new Map(),
      cages: [],
      aura: null,
      chairs: new Map(),
      owned: new Set(),
      numbered: new Map(),
      nextNumber: 1,
      chain: 0,
      critAdded: 0,
      critUntil: 0,
      alive: new Set(),
      kills: 0,
      blocked: new Map(),
      tapes: new Map(),
      queue: { dx: 1, dy: 0, gap: 1 },
      last: s.time,
      asked: 0,
    };
    states.set(s, k);
  }
  return k;
}

/** The record if one was ever made (a test or a tick that must not create it). */
export const konsStateIfAny = (s: RunState): KonsState | undefined => states.get(s);

/** True when the enemy carries a status the Konsultant laid (from him, or from one of his chairs, forms and phones). */
export const carriesHis = (s: RunState, k: KonsState, e: Enemy): boolean => e.statuses.some((st) => st.source !== null && (st.source === s.player.id || k.owned.has(st.source)));
