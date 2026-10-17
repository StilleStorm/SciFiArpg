/** Ranged auto-attacks: the hero throws or shoots a projectile that rolls its hit when it lands. */
import type { Enemy, Player } from '../entities/types';
import { nextId, type RunState } from '../world/run';
import { heroDef } from './defs';

const SPEED = 520;

/** Returns true if a projectile was fired (the caller then skips the instant attack). */
export function fireAuto(s: RunState, p: Player, target: Enemy): boolean {
  const def = heroDef(p.heroId);
  if (!def.auto.projectile) return false;
  const d = Math.hypot(target.x - p.x, target.y - p.y) || 1;
  const reach = p.attackRange + 40;
  s.projectiles.push({
    kind: 'projectile',
    id: nextId(s),
    x: p.x,
    y: p.y - 6,
    r: 5,
    vx: ((target.x - p.x) / d) * SPEED,
    vy: ((target.y - p.y) / d) * SPEED,
    ttl: reach / SPEED,
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
  return true;
}
