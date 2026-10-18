/** Ranged auto-attacks: the hero throws or shoots a projectile that rolls its hit when it lands. */
import type { Bus } from '../core/events';
import type { Enemy, Player } from '../entities/types';
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

/** Returns true if a projectile was fired (the caller then skips the instant attack). */
export function fireAuto(s: RunState, p: Player, target: Enemy, bus?: Bus): boolean {
  const def = heroDef(p.heroId);
  if (!def.auto.projectile) return false;
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
