/** Small pieces every skill needs: targeting, scaling by rank, typed damage that never misses. */
import { applyStatus, type StatusKind } from '../combat/status';
import { effectiveResist, type DamageType } from '../combat/damage';
import type { Bus } from '../core/events';
import type { Enemy } from '../entities/types';
import { applyDamage } from '../systems/combat';
import type { RunState } from '../world/run';
import type { SkillIndex } from './defs';
import { patchAt, rankOf } from './grants';
import { castStatus, type ParagraphPatch } from './paragraphs';
import { playerDamageMul } from './shield';

export const RANK_DAMAGE = 0.25;
export const RANK_AREA = 0.12;
export const RANK_DURATION = 0.15;
export const RANK_COOLDOWN = 0.07;

/** Damage multiplier of a skill (by SkillIndex, not pad): ranks and passives. */
export const power = (s: RunState, slot: SkillIndex): number => (1 + RANK_DAMAGE * rankOf(s, slot)) * s.hero.mods.dmg * (patchOf(s, slot)?.dmg ?? 1);
export const areaOf = (s: RunState, slot: SkillIndex): number => (1 + RANK_AREA * rankOf(s, slot)) * s.hero.mods.area * (patchOf(s, slot)?.area ?? 1);
export const durationOf = (s: RunState, slot: SkillIndex): number => (1 + RANK_DURATION * rankOf(s, slot)) * s.hero.mods.duration * (patchOf(s, slot)?.dur ?? 1);

/** The patch of the active paragraph of skill `slot` (by SkillIndex), if it is not paragraph 1 (heroes/paragraphs.ts). */
export const patchOf = (s: RunState, slot: SkillIndex): ParagraphPatch | undefined => patchAt(s, slot); // the run's paragraph plus a worn unique's and set's (heroes/grants.ts)
/** Paragraph shape fields: multiplier of the half-angle / width of a cone or line, and the extra projectiles or copies. */
export const widthOf = (s: RunState, slot: SkillIndex): number => patchOf(s, slot)?.width ?? 1;
export const countOf = (s: RunState, slot: SkillIndex): number => patchOf(s, slot)?.count ?? 0;
/** Multiplier of the length of a flight, throw or orbit that the paragraph sets (the reach of an aimed skill reads it through `SkillDef.patch`). */
export const reachMulOf = (s: RunState, slot: SkillIndex): number => patchOf(s, slot)?.reach ?? 1;
export const cooldownOf = (s: RunState, slot: SkillIndex, base: number): number =>
  Math.max(1, base * s.hero.mods.cooldown * (1 - RANK_COOLDOWN * rankOf(s, slot)));

export function avgDamage(s: RunState): number {
  return (s.player.stats.dmgMin + s.player.stats.dmgMax) / 2;
}

export function enemiesWithin(s: RunState, x: number, y: number, r: number): Enemy[] {
  return s.enemies.filter((e) => Math.hypot(e.x - x, e.y - y) <= r + e.r);
}

export function nearestEnemy(s: RunState, x: number, y: number, maxDist: number): Enemy | null {
  let best: Enemy | null = null;
  let bd = maxDist + 1e-6;
  for (const e of s.enemies) {
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

/** Unit vector toward the nearest enemy within `range`, else the way the player faces. */
export function aim(s: RunState, range: number): { dx: number; dy: number; target: Enemy | null } {
  const p = s.player;
  const target = nearestEnemy(s, p.x, p.y, range);
  if (target) {
    const d = Math.hypot(target.x - p.x, target.y - p.y) || 1;
    return { dx: (target.x - p.x) / d, dy: (target.y - p.y) / d, target };
  }
  return { dx: p.facing, dy: 0, target: null };
}

/**
 * A skill hit: rolls the player's damage range and crit, applies resist, never misses.
 * `mult` multiplies the roll (callers pass power(slot) times their own factor).
 */
export function skillDamage(s: RunState, bus: Bus, target: Enemy, type: DamageType, mult: number): boolean {
  if (s.law.botTime) return false; // Godziny konsultanta: nobody deals damage during the bot hours
  const p = s.player;
  const rng = s.rngs.combat;
  const crit = rng.chance(Math.min(0.95, p.stats.critChance));
  const raw = Math.floor(rng.range(p.stats.dmgMin, p.stats.dmgMax + 1));
  const scaled = raw * mult * playerDamageMul(p) * (crit ? 2 : 1) * (1 - effectiveResist(target.stats, type) / 100);
  const killed = applyDamage(s, bus, target, Math.max(1, Math.round(scaled)), crit, type); // the type lets claims, rebuttals and existence apply
  if (!killed) laidStatus(target); // a paragraph's status (heroes/paragraphs.ts)
  return killed;
}

/** The status of the paragraph being cast, laid on `e` (statusApply and skillDamage call it); nothing outside a cast. */
export function laidStatus(e: Enemy): void {
  const c = castStatus();
  if (c?.status) touchStatus(e, c.status.kind, c.status.seconds, c.source);
}

/** Keep a status alive without allocating every step: refresh only if it would run out. */
export function touchStatus(e: Enemy, kind: StatusKind, seconds: number, source: number | null): void {
  const st = e.statuses.find((x) => x.kind === kind);
  if (!st) applyStatus(e, kind, seconds, source);
  else if (st.remaining < seconds) st.remaining = seconds;
}

/** Existence coefficient (family Wygenerowane, set by the enemies agent); a no-op for enemies without one. */
export function setExistence(e: Enemy, value: number): void {
  const x = e as Enemy & { existence?: number };
  if (typeof x.existence === 'number') x.existence = Math.min(x.existence, value);
}
