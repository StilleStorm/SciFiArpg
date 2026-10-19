/** Spawning primitives: projectile, zone, summon, decoy. */
import { createSummon, createZone } from '../../entities/factory';
import type { Projectile, Summon, Zone } from '../../entities/types';
import { resolveMove } from '../../world/pages';
import { nextId } from '../../world/run';
import type { Ctx } from './ctx';

export interface ProjectileOpts {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  ttl: number;
  /** Multiplier of the rolled hit (the system rolls it when the projectile lands). */
  damage: number;
  damageType: Projectile['damageType'];
  pierce: number;
  bonusPerPass?: number;
}

/** A player projectile that pierces `pierce` enemies and rolls its damage when it lands. */
export function projectile(c: Ctx, o: ProjectileOpts): Projectile {
  const pr: Projectile = {
    kind: 'projectile',
    id: nextId(c.s),
    x: o.x,
    y: o.y,
    r: o.r,
    vx: o.vx,
    vy: o.vy,
    ttl: o.ttl,
    damage: o.damage,
    damageType: o.damageType,
    owner: 'player',
    pierce: o.pierce,
    passed: [],
  };
  if (o.bonusPerPass !== undefined) pr.bonusPerPass = o.bonusPerPass;
  c.s.projectiles.push(pr);
  return pr;
}

/** A copy of `shot` turned by `turn` radians (a new id, nothing passed yet). */
export function forkProjectile(c: Ctx, shot: Projectile, turn: number): Projectile {
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const fork: Projectile = { ...shot, id: nextId(c.s), vx: shot.vx * cos - shot.vy * sin, vy: shot.vx * sin + shot.vy * cos, passed: [] };
  c.s.projectiles.push(fork);
  return fork;
}

export type ZoneOpts = Pick<Zone, 'variant' | 'r' | 'ttl'> &
  Partial<Zone> & {
    x: number;
    y: number;
    /** At most this many zones of the variant stay; the oldest go first. */
    max?: number;
  };

/** A zone on the page (teren, wniosek, legenda, start, numer, hourglass). */
export function zone(c: Ctx, o: ZoneOpts): Zone {
  const { s } = c;
  const { x, y, max, ...init } = o;
  if (max !== undefined) {
    const same = s.zones.filter((z) => z.variant === o.variant);
    while (same.length >= max) {
      const old = same.shift();
      if (old) s.zones.splice(s.zones.indexOf(old), 1);
    }
  }
  const z = createZone(nextId(s), x, y, init);
  s.zones.push(z);
  return z;
}

/** Remove a summon and tell the render layer. */
export function removeSummon(c: Ctx, id: number): void {
  const i = c.s.summons.findIndex((x) => x.id === id);
  if (i < 0) return;
  c.s.summons.splice(i, 1);
  c.bus.emit('summon:expired', { id });
}

export type SummonOpts = Pick<Summon, 'variant' | 'heroId' | 'ttl'> &
  Partial<Summon> & {
    x: number;
    y: number;
    /** At most this many summons of the variant stay; the oldest expire first. */
    max?: number;
    /** Keep the new summon inside the page (resolveMove). */
    settle?: boolean;
  };

/** A friendly summon (copy, decoy, moon). */
export function summon(c: Ctx, o: SummonOpts): Summon {
  const { s } = c;
  const { x, y, max, settle, ...init } = o;
  if (max !== undefined) {
    const same = s.summons.filter((m) => m.variant === o.variant);
    while (same.length >= max) {
      const old = same.shift();
      if (!old) break;
      removeSummon(c, old.id);
    }
  }
  const m = createSummon(nextId(s), x, y, init);
  if (settle) resolveMove(s.page, m, m.r);
  s.summons.push(m);
  return m;
}

export interface DecoyOpts {
  x: number;
  y: number;
  ttl: number;
}

/** A decoy of the hero: stands where it was, deals nothing, draws the attention. */
export function decoy(c: Ctx, o: DecoyOpts): Summon {
  const p = c.s.player;
  return summon(c, { variant: 'decoy', heroId: p.heroId, x: o.x, y: o.y, ttl: o.ttl, damageMul: 0, damageType: p.damageType, r: p.r, facing: p.facing });
}
