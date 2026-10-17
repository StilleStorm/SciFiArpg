/** Shots of ranged enemies. Player shots (owner 'player') belong to heroes/system.ts and are skipped here. */
import { rollDamage } from '../combat/damage';
import type { Bus } from '../core/events';
import type { Enemy } from '../entities/types';
import { applyDamage } from '../systems/combat';
import { nextId, type RunState } from '../world/run';
import type { RangedSpec } from './partsBase';
import { enemyOutgoing } from './hooks';

/** Fire `count` shots from enemy e toward (tx, ty), fanned out by `spread` radians. */
export function fireShot(s: RunState, e: Enemy, tx: number, ty: number, spec: RangedSpec, count = 1, spread = 0.22): void {
  const base = Math.atan2(ty - e.y, tx - e.x);
  if (Math.abs(tx - e.x) > 1) e.facing = tx > e.x ? 1 : -1;
  const p = s.player;
  for (let i = 0; i < count; i++) {
    const a = base + (count > 1 ? (i - (count - 1) / 2) * spread : 0);
    const roll = rollDamage(e.stats, p.stats, spec.type, s.rngs.combat);
    const damage = roll.hit ? enemyOutgoing(e, Math.max(1, Math.round(roll.amount * spec.damageMul))) : 0;
    s.projectiles.push({
      kind: 'projectile',
      id: nextId(s),
      x: e.x,
      y: e.y - 6,
      r: 5,
      vx: Math.cos(a) * spec.speed,
      vy: Math.sin(a) * spec.speed,
      ttl: spec.range / spec.speed + 0.5,
      damage,
      damageType: spec.type,
      owner: 'enemy',
    });
  }
}

/** Move enemy shots; a shot that reaches the player lands (damage 0 = it was rolled as a miss and flies past). */
export function updateEnemyProjectiles(s: RunState, bus: Bus, dt: number): void {
  const list = s.projectiles;
  const p = s.player;
  for (let i = list.length - 1; i >= 0; i--) {
    const pr = list[i];
    if (!pr || pr.owner !== 'enemy') continue;
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    pr.ttl -= dt;
    let done = pr.ttl <= 0 || pr.x < 0 || pr.y < 0 || pr.x > s.page.w || pr.y > s.page.h;
    if (!done) {
      for (const o of s.page.obstacles) {
        if (o.colliders.some((c) => Math.hypot(c.x - pr.x, c.y - pr.y) < c.r * 0.8)) {
          done = true;
          break;
        }
      }
    }
    if (!done && pr.damage > 0 && !p.suspended && !s.law.botTime && s.status === 'running' && Math.hypot(p.x - pr.x, p.y - pr.y) < p.r + pr.r) {
      applyDamage(s, bus, p, pr.damage, false, pr.damageType);
      done = true;
    }
    if (done) list.splice(i, 1);
  }
}
