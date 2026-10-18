/** Ranged auto-attacks: the hero throws or shoots a projectile that rolls its hit when it lands. */
import type { Bus } from '../core/events';
import type { Enemy, Player } from '../entities/types';
import { attack } from '../systems/combat';
import { nextId, type RunState } from '../world/run';
import { heroDef } from './defs';

const SPEED = 520;
/**
 * The Konsultant's auto-attack is a lash of his headset cable (render/attackFx.ts draws it: tip out in 90 ms). The hit is
 * rolled when the tip arrives, so it flies as an invisible projectile that reaches the target's edge in exactly that time,
 * with a wide hit circle so that even at this speed (up to ~30 units per step) it cannot pass through a small enemy.
 */
const LASH_S = 0.09;
const LASH_R = 12;

/**
 * Where the Kartograf's range pole sights from, relative to the hero: this far toward the target's side and up (figure units
 * 15 and 22 at the page scale of the figure, render/heroFigures.ts HERO_SCALE x the figure's own 1.25).
 */
const SIGHT_SCALE = 1.25 * 1.15;
export const SIGHT_DX = 15 * SIGHT_SCALE;
export const SIGHT_DY = 22 * SIGHT_SCALE;
/** Half the width of the ruled line, for what it passes through on a crit. */
const LINE_HALF = 3;

export interface Laser {
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  crit: boolean;
  metres: number;
  /** Ids of the enemies that were struck, the target first. */
  struck: number[];
}

/**
 * The Kartograf's measuring laser (hitscan): one ordinary `attack()` on the target at once. On a crit the line runs on past the
 * target to the range limit and every enemy on it takes an `attack()` of its own (claims, rebuttals and existence apply as
 * for any auto-attack). Announced afterwards, so the picture knows whether it was a crit.
 */
export function fireLaser(s: RunState, p: Player, target: Enemy, bus: Bus): Laser {
  const def = heroDef(p.heroId);
  const tx = target.x;
  const ty = target.y;
  const side = tx < p.x ? -1 : 1;
  const sx = p.x + side * SIGHT_DX;
  const sy = p.y - SIGHT_DY;
  const dx = tx - sx;
  const dy = ty - sy;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  const metres = Math.hypot(tx - p.x, ty - p.y) / 10;
  const struck: number[] = [target.id];
  let crit = false;
  const off = bus.on('enemy:hit', (ev) => {
    if (ev.id === target.id) crit = ev.crit;
  });
  attack(s, bus, p, target);
  off();
  let ex = tx;
  let ey = ty;
  if (crit && def.auto.pierceOnCrit) {
    const reach = Math.max(p.attackRange, dist + 24);
    ex = sx + ux * reach;
    ey = sy + uy * reach;
    const on: { e: Enemy; along: number }[] = [];
    for (const e of s.enemies) {
      if (e === target) continue;
      const along = (e.x - sx) * ux + (e.y - sy) * uy;
      if (along < 0 || along > reach + e.r) continue;
      if (Math.abs((e.x - sx) * uy - (e.y - sy) * ux) <= e.r + LINE_HALF) on.push({ e, along });
    }
    on.sort((a, b) => a.along - b.along);
    for (const { e } of on) {
      attack(s, bus, p, e);
      struck.push(e.id);
    }
  }
  p.attackTimer = p.attackCooldown;
  return { sx, sy, ex, ey, crit, metres, struck };
}

/** Returns true if the attack was made (a projectile fired, or the laser struck); the caller then skips the instant attack. */
export function fireAuto(s: RunState, p: Player, target: Enemy, bus?: Bus): boolean {
  const def = heroDef(p.heroId);
  if (!def.auto.projectile) return false;
  if (def.auto.hitscan) {
    if (!bus) return false;
    if (Math.hypot(target.x - p.x, target.y - p.y) > p.attackRange + target.r + 40) return true; // out of reach: nothing is fired
    const tx = target.x;
    const ty = target.y;
    const { sx, sy, ex, ey, crit, metres } = fireLaser(s, p, target, bus);
    if (!p.moving && Math.abs(tx - p.x) > 1) p.facing = tx > p.x ? 1 : -1;
    bus.emit('attack:started', { attackerId: p.id, attacker: 'player', x: p.x, y: p.y, tx, ty, ranged: true, laser: { sx, sy, ex, ey, crit, metres } });
    return true;
  }
  const d = Math.hypot(target.x - p.x, target.y - p.y) || 1;
  const reach = p.attackRange + 40;
  const lash = p.heroId === 'konsultant';
  // lash: the distance to where the hit circle touches the target, covered in LASH_S; then a few steps of grace
  const speed = lash ? Math.max(40, d - LASH_R - target.r) / LASH_S : SPEED;
  s.projectiles.push({
    kind: 'projectile',
    id: nextId(s),
    x: p.x,
    y: p.y - 6,
    r: lash ? LASH_R : 5,
    vx: ((target.x - p.x) / d) * speed,
    vy: ((target.y - p.y) / d) * speed,
    ttl: lash ? LASH_S + 0.06 : reach / SPEED,
    damage: 0,
    damageType: p.damageType,
    owner: 'player',
    roll: true,
    pierceOnCrit: def.auto.pierceOnCrit,
    pierce: 0,
    passed: [],
  });
  p.attackTimer = p.attackCooldown;
  if (!p.moving && Math.abs(target.x - p.x) > 1) p.facing = target.x > p.x ? 1 : -1;
  bus?.emit('attack:started', { attackerId: p.id, attacker: 'player', x: p.x, y: p.y, tx: target.x, ty: target.y, ranged: true });
  return true;
}
