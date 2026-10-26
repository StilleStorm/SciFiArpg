/** How the Nalesnik strikes from behind (Krawedz): a hit that is always a crit; the same arithmetic as `skillDamage` with the crit decided. */
import { effectiveResist, type DamageType } from '../../combat/damage';
import type { Bus } from '../../core/events';
import type { Enemy } from '../../entities/types';
import { applyDamage } from '../../systems/combat';
import type { RunState } from '../../world/run';
import { laidStatus } from '../helpers';
import { playerDamageMul } from '../shield';
import { MASA_MAX, MASA_STEP } from './numbers';
import { nalState } from './state';

/** True when the update `passiveN` was taken this run. */
export const taken = (s: RunState, id: string): boolean => (s.hero.upgrades[id] ?? 0) > 0;

export function critHit(s: RunState, bus: Bus, e: Enemy, type: DamageType, mult: number): boolean {
  if (s.law.botTime) return false;
  const p = s.player;
  const raw = Math.floor(s.rngs.combat.range(p.stats.dmgMin, p.stats.dmgMax + 1));
  const scaled = raw * mult * playerDamageMul(p) * 2 * (1 - effectiveResist(e.stats, type) / 100);
  const killed = applyDamage(s, bus, e, Math.max(1, Math.round(scaled)), true, type);
  if (!killed) laidStatus(e);
  return killed;
}

/**
 * Passive 9, Masa krytyczna: count `e` as pulled by the pull `token` (the running Grawitacja record); the first time in a pull it adds
 * 3% to the bonus for the next ofensywna, at most 30%. A new pull starts a new count.
 */
export function gatherMass(s: RunState, token: object, e: Enemy): void {
  if (!taken(s, 'passive9')) return;
  const k = nalState(s);
  if (k.massFor !== token) {
    k.massFor = token;
    k.massSeen.clear();
  }
  if (k.massSeen.has(e.id)) return;
  k.massSeen.add(e.id);
  k.mass = Math.min(MASA_MAX, k.mass + MASA_STEP);
}

/** The factor an ofensywna skill takes at its cast from passive 9 (1 when none is gathered); the bonus is spent. */
export function takeMass(s: RunState): number {
  if (!taken(s, 'passive9')) return 1;
  const k = nalState(s);
  const m = 1 + k.mass;
  k.mass = 0;
  return m;
}
