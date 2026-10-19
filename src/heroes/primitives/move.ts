/** Movement primitives: dash, teleport, pull, push. */
import type { Enemy } from '../../entities/types';
import { resolveMove } from '../../world/pages';
import type { Ctx, Point } from './ctx';
import { fx } from './ctx';

export interface DashOpts {
  /** Unit direction. */
  dx: number;
  dy: number;
  /** Length covered, units, and the time it takes, seconds. */
  len: number;
  time: number;
  /** 'dash' = heroes/system.ts stepDash (drags one enemy along); 'roll' = heroes/nalesnik.ts stepRoll (catches a satellite). */
  kind: 'dash' | 'roll';
  /** Dash only: id of the enemy dragged along. */
  drag?: number | null;
  /** The rank of the skill, kept for the per-step code. */
  rank: number;
  /** Roll only: face the way it rolls. */
  face?: boolean;
}

/** Start a dash or a roll: the hero moves `len` units along (dx, dy) over `time` seconds, stepped by the hero system. */
export function dash(c: Ctx, o: DashOpts): void {
  const { s } = c;
  const p = s.player;
  const speed = o.len / o.time;
  if (o.kind === 'dash') s.hero.dash = { dx: o.dx, dy: o.dy, left: o.time, speed, drag: o.drag ?? null, rank: o.rank };
  else {
    s.hero.roll = { dx: o.dx, dy: o.dy, left: o.time, speed, hit: [], rank: o.rank };
    p.target = null;
    if (o.face && Math.abs(o.dx) > 0.2) p.facing = o.dx > 0 ? 1 : -1;
  }
  fx(c, 'dash', p.x, p.y, 0, p.x + o.dx * o.len, p.y + o.dy * o.len);
}

export interface TeleportOpts {
  x: number;
  y: number;
  /** Keep the hero inside the page and out of obstacles (resolveMove). */
  resolve?: boolean;
  /** The sketch drawn from where the hero was to where it lands. */
  sketch?: boolean;
}

/** Put the hero at (x, y) at once; the auto target is dropped. Returns where it was. */
export function teleport(c: Ctx, o: TeleportOpts): Point {
  const p = c.s.player;
  const from = { x: p.x, y: p.y };
  p.x = o.x;
  p.y = o.y;
  if (o.resolve) resolveMove(c.s.page, p, p.r);
  p.target = null;
  if (o.sketch !== false) fx(c, 'blink', from.x, from.y, 0, p.x, p.y);
  return from;
}

/**
 * Pull `e` toward (x, y) by `amount` units, but never closer than `gap` to the point. Resolved against the page.
 * Returns the distance moved.
 */
export function pull(c: Ctx, e: Enemy, at: Point, amount: number, gap: number): number {
  const d = Math.hypot(e.x - at.x, e.y - at.y) || 1;
  const moved = Math.max(0, Math.min(amount, d - gap));
  e.x -= ((e.x - at.x) / d) * moved;
  e.y -= ((e.y - at.y) / d) * moved;
  resolveMove(c.s.page, e, e.r);
  return moved;
}

export interface PushOpts {
  /** 'jump' = displace at once and let the page settle it; 'sweep' = in steps of 10, stopping where a wall is in the way. */
  mode: 'jump' | 'sweep';
}

/** Push `e` `dist` units along the unit vector (dx, dy). Bosses are the caller's business. */
export function push(c: Ctx, e: Enemy, dx: number, dy: number, dist: number, o: PushOpts = { mode: 'jump' }): void {
  const { s } = c;
  if (o.mode === 'jump') {
    e.x += dx * dist;
    e.y += dy * dist;
    resolveMove(s.page, e, e.r);
    return;
  }
  const step = 10;
  let left = dist;
  while (left > 0.5) {
    const len = Math.min(step, left);
    const next = { x: e.x + dx * len, y: e.y + dy * len };
    const want = { x: next.x, y: next.y };
    resolveMove(s.page, next, e.r);
    if (Math.hypot(next.x - want.x, next.y - want.y) > 0.5) return;
    e.x = next.x;
    e.y = next.y;
    left -= len;
  }
}
