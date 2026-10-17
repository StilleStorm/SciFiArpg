import type { Side } from '../core/events';
import type { Rng } from '../core/rng';
import { dist, type Vec } from '../core/vec';

export const PAGE_W = 1200;
export const PAGE_H = 1600;
/** The paper ends here: the wall is this far inside the page rectangle. */
export const PAGE_INSET = 18;

export interface Circle {
  x: number;
  y: number;
  r: number;
}

export type ObstacleKind = 'blot' | 'ring' | 'torn' | 'note';

export interface Obstacle {
  kind: ObstacleKind;
  x: number;
  y: number;
  /** Nominal radius (blot, ring), note half-length or torn leg length. */
  size: number;
  /** Radians. */
  rot: number;
  /** Seeds the hand-drawn irregularity (render only). */
  seed: number;
  colliders: Circle[];
}

export interface Page {
  w: number;
  h: number;
  inset: number;
  spawn: Vec;
  obstacles: Obstacle[];
}

function colliders(o: Pick<Obstacle, 'kind' | 'x' | 'y' | 'size' | 'rot'>, w: number): Circle[] {
  switch (o.kind) {
    case 'blot':
      return [{ x: o.x, y: o.y, r: o.size * 0.85 }];
    case 'ring':
      return [{ x: o.x, y: o.y, r: o.size * 0.92 }];
    case 'note': {
      const half = o.size * 0.5;
      const dx = Math.cos(o.rot) * half;
      const dy = Math.sin(o.rot) * half;
      return [
        { x: o.x - dx, y: o.y - dy, r: o.size * 0.36 },
        { x: o.x + dx, y: o.y + dy, r: o.size * 0.36 },
      ];
    }
    case 'torn':
      return [
        { x: w - o.size * 0.28, y: o.size * 0.28, r: o.size * 0.4 },
        { x: w - o.size * 0.62, y: o.size * 0.1, r: o.size * 0.2 },
        { x: w - o.size * 0.1, y: o.size * 0.62, r: o.size * 0.2 },
      ];
  }
}

/** One page for now: 6-10 inked obstacles, a torn corner, a spawn point at the bottom. */
export function generatePage(rng: Rng): Page {
  const r = rng.fork('page');
  const spawn = { x: PAGE_W / 2, y: PAGE_H - 180 };
  const obstacles: Obstacle[] = [];
  const torn: Obstacle = { kind: 'torn', x: PAGE_W, y: 0, size: 150, rot: 0, seed: r.int(1, 1e6), colliders: [] };
  torn.colliders = colliders(torn, PAGE_W);
  obstacles.push(torn);

  const kinds: ObstacleKind[] = ['ring', 'note', 'note', 'blot', 'blot', 'blot', 'blot', 'ring', 'blot'];
  const want = r.int(6, 9);
  let guard = 0;
  while (obstacles.length < want && guard++ < 400) {
    const kind = kinds[obstacles.length - 1] ?? 'blot';
    const size = kind === 'blot' ? r.range(26, 52) : kind === 'ring' ? r.range(56, 74) : r.range(84, 110);
    const o: Obstacle = {
      kind,
      x: r.range(110, PAGE_W - 110),
      y: r.range(110, PAGE_H - 110),
      size,
      rot: r.range(-0.5, 0.5),
      seed: r.int(1, 1e6),
      colliders: [],
    };
    o.colliders = colliders(o, PAGE_W);
    const clear = o.colliders.every(
      (c) =>
        dist(c, spawn) > c.r + 160 &&
        obstacles.every((p) => p.colliders.every((d) => dist(c, d) > c.r + d.r + 70)),
    );
    if (clear) obstacles.push(o);
  }
  return { w: PAGE_W, h: PAGE_H, inset: PAGE_INSET, spawn, obstacles };
}

/**
 * Push a circle out of obstacles and keep it inside the page walls. Mutates `pos`.
 * Returns the wall that was hit, if any (used for the "margines" note).
 */
export function resolveMove(page: Page, pos: Vec, r: number): Side | null {
  for (let pass = 0; pass < 2; pass++) {
    for (const o of page.obstacles) {
      for (const c of o.colliders) {
        const dx = pos.x - c.x;
        const dy = pos.y - c.y;
        const d = Math.hypot(dx, dy);
        const min = c.r + r;
        if (d >= min) continue;
        if (d < 1e-6) {
          pos.y = c.y + min;
        } else {
          pos.x = c.x + (dx / d) * min;
          pos.y = c.y + (dy / d) * min;
        }
      }
    }
  }
  let hit: Side | null = null;
  const lo = page.inset + r;
  if (pos.x < lo) {
    pos.x = lo;
    hit = 'l';
  } else if (pos.x > page.w - lo) {
    pos.x = page.w - lo;
    hit = 'r';
  }
  if (pos.y < lo) {
    pos.y = lo;
    hit = 't';
  } else if (pos.y > page.h - lo) {
    pos.y = page.h - lo;
    hit = 'b';
  }
  return hit;
}
