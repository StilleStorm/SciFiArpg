/** How the Kartograf's survey lines strike (S20): a line hit that counts toward Trzeci punkt, and the crit where lines cross. */
import { effectiveResist, type DamageType } from '../../combat/damage';
import type { Bus } from '../../core/events';
import type { Enemy } from '../../entities/types';
import { applyDamage } from '../../systems/combat';
import type { RunState } from '../../world/run';
import { laidStatus, skillDamage } from '../helpers';
import { playerDamageMul } from '../shield';
import { TRZECI_AT, TRZECI_FORGET_S } from './numbers';
import { kartState } from './state';

/** True when the update `passiveN` was taken this run. */
export const taken = (s: RunState, id: string): boolean => (s.hero.upgrades[id] ?? 0) > 0;

/**
 * A hit of a survey line on `e`. With Trzeci punkt (passive 10) the third line hit on the same enemy, within a few seconds of the
 * last, is a rebuttal whatever its claim: it strikes as the type of the standing claim. Returns true when the enemy fell.
 */
export function lineHit(s: RunState, bus: Bus, e: Enemy, type: DamageType, mult: number): boolean {
  if (!taken(s, 'passive10')) return skillDamage(s, bus, e, type, mult);
  const k = kartState(s);
  const rec = k.threes.get(e.id);
  const now = rec && s.time - rec.at <= TRZECI_FORGET_S ? rec : { n: 0, at: s.time };
  now.n++;
  now.at = s.time;
  k.threes.set(e.id, now);
  if (now.n >= TRZECI_AT) {
    now.n = 0;
    const claim = e.claim;
    if (claim && claim.struck !== true) return skillDamage(s, bus, e, claim.type, mult);
  }
  return skillDamage(s, bus, e, type, mult);
}

/** A hit that is always a crit (where the lines of Pomiar kontrolny cross); the same arithmetic as `skillDamage` with the crit decided. */
export function critHit(s: RunState, bus: Bus, e: Enemy, type: DamageType, mult: number): boolean {
  if (s.law.botTime) return false;
  const p = s.player;
  const raw = Math.floor(s.rngs.combat.range(p.stats.dmgMin, p.stats.dmgMax + 1));
  const scaled = raw * mult * playerDamageMul(p) * 2 * (1 - effectiveResist(e.stats, type) / 100);
  const killed = applyDamage(s, bus, e, Math.max(1, Math.round(scaled)), true, type);
  if (!killed) laidStatus(e);
  return killed;
}
