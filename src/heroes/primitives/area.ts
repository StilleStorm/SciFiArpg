/** Selection primitives: which enemies an area, a cone, a line or a hitscan ray reaches. They damage nothing themselves. */
import type { Enemy } from '../../entities/types';
import { enemiesWithin } from '../helpers';
import type { Ctx, Point } from './ctx';

export interface AoeOpts {
  x: number;
  y: number;
  r: number;
  /** Called for each enemy inside, in enemy order, before the next one is looked at. */
  each?: (e: Enemy) => void;
}

/** The enemies within `r` of (x, y) (their own radius not counted), each handed to `each`. */
export function aoe(c: Ctx, o: AoeOpts): Enemy[] {
  const hit = enemiesWithin(c.s, o.x, o.y, o.r);
  if (o.each) for (const e of hit) o.each(e);
  return hit;
}

export interface ConeOpts {
  x: number;
  y: number;
  /** Unit direction of the axis. */
  dx: number;
  dy: number;
  reach: number;
  /** Half of the opening angle, radians. */
  half: number;
  each?: (e: Enemy) => void;
}

/** The enemies inside a cone (reach counted to the enemy's edge), chosen first, then each handed to `each`. */
export function cone(c: Ctx, o: ConeOpts): Enemy[] {
  const base = Math.atan2(o.dy, o.dx);
  const hit: Enemy[] = [];
  for (const e of c.s.enemies) {
    const dx = e.x - o.x;
    const dy = e.y - o.y;
    if (Math.hypot(dx, dy) > o.reach + e.r) continue;
    let diff = Math.atan2(dy, dx) - base;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    if (Math.abs(diff) > o.half) continue;
    hit.push(e);
  }
  if (o.each) for (const e of hit) o.each(e);
  return hit;
}

export interface LineOpts {
  x: number;
  y: number;
  /** Unit direction. */
  dx: number;
  dy: number;
  reach: number;
  /** Half the width of the line, on top of the enemy's own radius. */
  half: number;
  skip?: Enemy | null;
}

export interface OnLine {
  e: Enemy;
  /** Distance along the line from its start to the enemy's centre. */
  along: number;
}

/** The enemies on a ruled line, nearest first. */
export function line(c: Ctx, o: LineOpts): OnLine[] {
  const on: OnLine[] = [];
  for (const e of c.s.enemies) {
    if (e === o.skip) continue;
    const along = (e.x - o.x) * o.dx + (e.y - o.y) * o.dy;
    if (along < 0 || along > o.reach + e.r) continue;
    if (Math.abs((e.x - o.x) * o.dy - (e.y - o.y) * o.dx) > e.r + o.half) continue;
    on.push({ e, along });
  }
  on.sort((a, b) => a.along - b.along);
  return on;
}

export interface HitscanOpts extends LineOpts {
  /** Called for each enemy on the ray, nearest first (an instant hit, nothing flies). */
  hit: (e: Enemy) => void;
}

/** A ray that lands at once: every enemy on the line, nearest first, is handed to `hit`. Returns the end point of the ray. */
export function hitscan(c: Ctx, o: HitscanOpts): Point {
  for (const { e } of line(c, o)) o.hit(e);
  return { x: o.x + o.dx * o.reach, y: o.y + o.dy * o.reach };
}
