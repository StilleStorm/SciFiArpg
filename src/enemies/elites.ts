/**
 * Elite affixes as mechanics (DESIGN 6, PLAN 8). An enemy carries `rt.affixes` (one for an elite, two or three for a
 * named elite); pack minions borrow the tempo affixes of a living leader (`rt.shared`). Everything here is pure
 * lookups; the per-step work lives in ai.ts, the damage rules in hooks.ts.
 */
import type { Enemy } from '../entities/types';
import { rtOf } from './runtime';
import type { EliteId } from './ids';

/** Affixes a pack leader shares with its minions: the aura and the tempo ones. */
export const SHARED_AFFIXES: readonly EliteId[] = ['zweryfikowany', 'sponsorowany', 'pilny', 'nadgorliwy'];

/** pilny: attacks this much more often. */
export const PILNY_ATTACK_MUL = 1.5;
/** odnawialny: share of max racja regained per second after QUIET_S without a hit. */
export const ODNAWIALNY_RATE = 0.04;
export const ODNAWIALNY_QUIET_S = 3;
/** powielony: copies left behind on death, and their tier. */
export const POWIELONY_COPIES = 2;
/** poufny: damage taken unless the hit answers the claim. */
export const POUFNY_DMG_MUL = 0.7;
/** nadgorliwy: speed gained per second alive, and the ceiling. */
export const NADGORLIWY_RATE = 0.015;
export const NADGORLIWY_CAP = 0.6;
/** wielokrotny: shots per volley (ranged) and reach multiplier (melee). */
export const WIELOKROTNY_SHOTS = 3;
export const WIELOKROTNY_REACH = 1.5;

/** Own affixes of an enemy: the list in its runtime, or the single `elite.affix`. */
export function ownAffixes(e: Enemy): readonly EliteId[] {
  const own = e.rt?.affixes;
  if (own && own.length > 0) return own;
  return e.elite ? [e.elite.affix] : [];
}

/** True when the enemy has the affix itself or borrows it from its pack leader. */
export function hasAffix(e: Enemy, id: EliteId): boolean {
  return ownAffixes(e).includes(id) || (e.rt?.shared.includes(id) ?? false);
}

/** Only the enemy's own affixes (auras are emitted by their bearer, not by a minion that merely borrows them). */
export function ownsAffix(e: Enemy, id: EliteId): boolean {
  return ownAffixes(e).includes(id);
}

/** Give an enemy its affix list (first one is the display affix). */
export function setAffixes(e: Enemy, list: readonly EliteId[]): void {
  const first = list[0];
  if (!first) return;
  rtOf(e).affixes = [...list];
  e.elite = { affix: first };
}

/** Speed factor from the affixes that move: sponsorowany (flat) and nadgorliwy (grows with age). */
export function affixSpeedMul(e: Enemy, sponsorMul: number): number {
  let m = 1;
  if (hasAffix(e, 'sponsorowany')) m *= sponsorMul;
  if (hasAffix(e, 'nadgorliwy')) m *= 1 + Math.min(NADGORLIWY_CAP, rtOf(e).age * NADGORLIWY_RATE);
  return m;
}

/** Attack-rate factor (pilny). */
export const affixTempoMul = (e: Enemy): number => (hasAffix(e, 'pilny') ? PILNY_ATTACK_MUL : 1);
