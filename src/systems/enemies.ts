/** PLACEHOLDER enemy AI: wander near home, chase within 250 units. The enemies agent replaces this. */
import type { Enemy, Grid } from '../entities';
import { createEnemy } from '../entities/factory';
import { resolveMove } from '../world/pages';
import { nextId, type RunState } from '../world/run';

const CHASE_START = 250;
const CHASE_STOP = 320;
const WANDER_RADIUS = 120;
const MIN_SPAWN_DISTANCE = 320;
export const ENEMY_COUNT = 5;

export function spawnEnemy(s: RunState, minDistance = MIN_SPAWN_DISTANCE): Enemy | null {
  const r = s.rngs.spawn;
  for (let tries = 0; tries < 40; tries++) {
    const x = r.range(80, s.page.w - 80);
    const y = r.range(80, s.page.h - 80);
    if (Math.hypot(x - s.player.x, y - s.player.y) < minDistance) continue;
    const e = createEnemy(nextId(s), x, y, r.int(1, 1e6));
    const before = { x: e.x, y: e.y };
    resolveMove(s.page, e, e.r);
    if (Math.hypot(e.x - before.x, e.y - before.y) > 1) continue;
    e.home = { x: e.x, y: e.y };
    s.enemies.push(e);
    return e;
  }
  return null;
}

export function updateEnemies(s: RunState, grid: Grid<Enemy>, dt: number): void {
  const p = s.player;
  const ai = s.rngs.ai;
  const near: Enemy[] = [];
  for (const e of s.enemies) {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dp = Math.hypot(dx, dy);
    const alive = s.status === 'running';
    e.mode = alive && dp < (e.mode === 'chase' ? CHASE_STOP : CHASE_START) ? 'chase' : 'wander';

    let tx = e.x;
    let ty = e.y;
    let speed = 0;
    if (e.mode === 'chase') {
      if (dp > e.attackRange * 0.75) {
        tx = p.x;
        ty = p.y;
        speed = e.speed;
      }
    } else {
      e.wanderTimer -= dt;
      if (e.wanderTimer <= 0) {
        e.wanderTimer = ai.range(1.5, 3.5);
        e.wanderTarget = ai.chance(0.3)
          ? null
          : { x: e.home.x + ai.range(-WANDER_RADIUS, WANDER_RADIUS), y: e.home.y + ai.range(-WANDER_RADIUS, WANDER_RADIUS) };
      }
      if (e.wanderTarget) {
        tx = e.wanderTarget.x;
        ty = e.wanderTarget.y;
        speed = e.speed * 0.4;
        if (Math.hypot(tx - e.x, ty - e.y) < 4) e.wanderTarget = null;
      }
    }

    const mx = tx - e.x;
    const my = ty - e.y;
    const md = Math.hypot(mx, my);
    e.moving = speed > 0 && md > 1;
    if (e.moving) {
      e.x += (mx / md) * speed * dt;
      e.y += (my / md) * speed * dt;
      if (Math.abs(mx) > 0.5) e.facing = mx > 0 ? 1 : -1;
    }
    // keep apart from neighbors
    near.length = 0;
    for (const o of grid.query(e.x, e.y, e.r * 2, near)) {
      if (o === e) continue;
      const ox = e.x - o.x;
      const oy = e.y - o.y;
      const od = Math.hypot(ox, oy) || 1;
      const push = ((e.r * 2 - od) / 2) * 0.5;
      e.x += (ox / od) * push;
      e.y += (oy / od) * push;
    }
    resolveMove(s.page, e, e.r);
  }
}

/** Keep a few enemies around while this is a sandbox. */
export function trickleSpawn(s: RunState, dt: number): void {
  s.spawnTimer -= dt;
  if (s.spawnTimer > 0) return;
  s.spawnTimer = 10;
  if (s.enemies.length < ENEMY_COUNT) spawnEnemy(s);
}
