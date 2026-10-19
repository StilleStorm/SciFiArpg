/** Effect primitives: status apply, buff, heal, shield, cooldown reset, deferred damage, echo. */
import { applyStatus } from '../../combat/status';
import type { StatusKind } from '../../combat/status';
import type { DamageType } from '../../combat/damage';
import type { Enemy } from '../../entities/types';
import { recomputeStats } from '../../items/stats';
import { enemiesWithin, laidStatus, skillDamage, touchStatus } from '../helpers';
import type { SkillIndex } from '../defs';
import type { Ctx } from './ctx';

export interface StatusOpts {
  kind: StatusKind;
  seconds: number;
  source: number | null;
  /** Refresh a running status only if it would run out sooner (no new record per step). */
  touch?: boolean;
}

/** Put a status on each of `targets`. */
export function statusApply(targets: readonly Enemy[], o: StatusOpts): void {
  for (const e of targets) {
    if (o.touch) touchStatus(e, o.kind, o.seconds, o.source);
    else applyStatus(e, o.kind, o.seconds, o.source);
    laidStatus(e); // the status of the paragraph being cast, if it has one
  }
}

export type BuffStat = 'critChance' | 'upor';

/** Add `amount` to a stat of the hero's own base stats (the gear stays on top) and recompute. Take it back with a negative amount. */
export function buff(c: Ctx, stat: BuffStat, amount: number): void {
  const p = c.s.player;
  p.baseStats.stats[stat] += amount;
  recomputeStats(p);
}

export interface HealOpts {
  /** Add this much racja (capped at the maximum). */
  amount?: number;
  /** Raise racja to at least this much (capped at the maximum); never lowers it. */
  atLeast?: number;
}

export function heal(c: Ctx, o: HealOpts): void {
  const p = c.s.player;
  if (o.amount !== undefined) p.hp = Math.min(p.hpMax, p.hp + o.amount);
  if (o.atLeast !== undefined) p.hp = Math.min(p.hpMax, Math.max(p.hp, o.atLeast));
}

/** A soaking shield of `amount` for `seconds` (heroes/system.ts drops it when the time is up). */
export function shield(c: Ctx, amount: number, seconds: number): void {
  c.s.player.shield = Math.round(amount);
  c.s.hero.shieldUntil = c.s.time + seconds;
}

/** Make skill `which` (or every skill) ready at once. `except` keeps one skill's cooldown (the skill doing the resetting). */
export function cooldownReset(c: Ctx, which: SkillIndex | 'all', except?: SkillIndex): void {
  const cd = c.s.hero.cd;
  for (let i = 0; i < cd.length; i++) if ((which === 'all' || which === i) && i !== except) cd[i] = 0;
}

export interface DeferredOpts {
  /** Seconds from now. */
  delay: number;
  x: number;
  y: number;
  r: number;
  type: DamageType;
  /** Multiplier of the rolled hit, as for skillDamage. */
  mult: number;
}

/** Damage that lands later: every enemy within `r` of (x, y) at that moment takes a skill hit. Stepped by `stepDeferred`. */
export function deferredDamage(c: Ctx, o: DeferredOpts): void {
  const list = c.s.hero.deferred ?? [];
  list.push({ at: c.s.time + o.delay, x: o.x, y: o.y, r: o.r, type: o.type, mult: o.mult });
  c.s.hero.deferred = list;
}

export interface EchoOpts extends Omit<DeferredOpts, 'delay'> {
  /** How many repeats, the gap between them (seconds), and the factor each repeat is weaker by. */
  times: number;
  every: number;
  decay: number;
}

/** The same hit again and again, each weaker: `times` deferred hits `every` seconds apart. */
export function echo(c: Ctx, o: EchoOpts): void {
  for (let i = 1; i <= o.times; i++) deferredDamage(c, { delay: o.every * i, x: o.x, y: o.y, r: o.r, type: o.type, mult: o.mult * o.decay ** i });
}

/** Land the deferred hits that are due. Called once per step by the hero system; does nothing when none were ever queued. */
export function stepDeferred(c: Ctx): void {
  const list = c.s.hero.deferred;
  if (!list || list.length === 0) return;
  const due = list.filter((d) => d.at <= c.s.time);
  if (due.length === 0) return;
  c.s.hero.deferred = list.filter((d) => d.at > c.s.time);
  for (const d of due) for (const e of enemiesWithin(c.s, d.x, d.y, d.r)) skillDamage(c.s, c.bus, e, d.type, d.mult);
}
