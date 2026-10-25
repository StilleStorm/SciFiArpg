/**
 * What the Kartograf's new skills and passives leave running. Kept beside the hero, not in `HeroRun`, so that the other heroes'
 * runs (and the contract snapshot) are untouched: one record per live `RunState`, made on first use. Nothing here is saved.
 */
import type { DamageType } from '../../combat/damage';
import type { StatusKind } from '../../combat/status';
import type { FamilyId } from '../../enemies/ids';
import type { RunState } from '../../world/run';

/** A survey line of Przekroj that stays on the page (§ 3 warstwowy): whoever stands on it is held by do_weryfikacji while it lasts. */
export interface SurveyLine {
  x: number;
  y: number;
  dx: number;
  dy: number;
  reach: number;
  half: number;
  until: number;
  /** Id of the zone that draws it. */
  zone: number;
}

/** Granica: the border across the aim. `n` points away from him; `u` runs along it. Whoever changes side inside its length is a crosser. */
export interface Border {
  zone: number;
  x: number;
  y: number;
  ux: number;
  uy: number;
  nx: number;
  ny: number;
  half: number;
  until: number;
  /** How far a crosser is pushed back (0: not at all), the damage multiplier of a crosser (0: none), its type, and the status laid. */
  push: number;
  dmg: number;
  type: DamageType;
  status: { kind: StatusKind; seconds: number };
  /** Enemy id -> the side (-1 or 1) it was on at the last step. */
  sides: Map<number, number>;
}

/** A Punkt odniesienia (a summon): § 3 pulls the eyes of the near every few seconds. */
export interface Bench {
  pull: boolean;
  next: number;
}

export interface KartState {
  lines: SurveyLine[];
  borders: Border[];
  benches: Map<number, Bench>;
  /** Pomiar: the enemy measured last and how many times running (the third marks it). */
  measured: { id: number; n: number } | null;
  /** Passive 10, Trzeci punkt: enemy id -> hits of a survey line on it, and the run time of the last. */
  threes: Map<number, { n: number; at: number }>;
  /** Passive 9, Blad pomiaru: decoy id -> run time of its next blow. */
  decoyNext: Map<number, number>;
  /** The rule, Mapa z gory: the page it was last looked at on, the families named on it, the enemies named (id -> family). */
  page: number;
  /** Run time of the next look at the names. */
  nameAt: number;
  named: Set<FamilyId>;
  misnamed: Map<number, FamilyId>;
  /** The enemy ids alive at the last step and the kill count then: a vanished id with a kill behind it is a death. */
  alive: Set<number>;
  kills: number;
}

const states = new WeakMap<RunState, KartState>();

export function kartState(s: RunState): KartState {
  let k = states.get(s);
  if (!k) {
    k = {
      lines: [],
      borders: [],
      benches: new Map(),
      measured: null,
      threes: new Map(),
      decoyNext: new Map(),
      page: -1,
      nameAt: 0,
      named: new Set(),
      misnamed: new Map(),
      alive: new Set(),
      kills: 0,
    };
    states.set(s, k);
  }
  return k;
}

/** The record if one was ever made (a hook that must not create it). */
export const kartStateIfAny = (s: RunState): KartState | undefined => states.get(s);
