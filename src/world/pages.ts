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

export type ObstacleKind = 'blot' | 'ring' | 'torn' | 'note' | 'qr' | 'sticky' | 'clip' | 'kiosk';

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

export type Corner = 'tl' | 'tr' | 'bl' | 'br';

/** The folded corner that turns to the next page: a dog-ear at `corner`; x, y is the frame corner. */
export interface PageExit {
  /** The horizontal edge the corner is on ('t' or 'b'). */
  side: Side;
  corner: Corner;
  x: number;
  y: number;
}

export interface Page {
  w: number;
  h: number;
  inset: number;
  /** Where the player stands when the page is entered (same as `entry`). */
  spawn: Vec;
  obstacles: Obstacle[];
  /** 0-based position in the run. */
  index: number;
  /** Where the player is placed on entering this page. */
  entry: Vec;
  /** Edge the player came in from (page 0: the bottom). */
  entrySide: Side;
  /** The corner the player arrived from (null on page 0). */
  entryCorner: Corner | null;
  /** The corner that is torn off (obstacle kind 'torn'). */
  torn: Corner;
  /** Null on the last page (the boss page has no way on). */
  exit: PageExit | null;
  /** True on the one page that carries the paczkomat. */
  hasKiosk: boolean;
}

/** What generatePage needs to know about the page's place in the run. */
export interface PagePlan {
  index: number;
  count: number;
  /** The corner the player arrives from; null for page 0 (bottom middle). */
  entryCorner: Corner | null;
}

/** The player turns the page when this close to the folded corner. */
export const EXIT_RADIUS = 100;
/** Size of the folded-corner flap (leg length along the frame). */
export const FOLD = 70;
export const CORNERS: readonly Corner[] = ['tl', 'tr', 'bl', 'br'];

function colliders(o: Pick<Obstacle, 'kind' | 'x' | 'y' | 'size' | 'rot'>): Circle[] {
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
    case 'qr': {
      const q = o.size * 0.25;
      return [-q, q].flatMap((dx) => [-q, q].map((dy) => ({ x: o.x + dx, y: o.y + dy, r: o.size * 0.36 })));
    }
    case 'sticky': {
      const half = o.size * 0.3;
      const dx = Math.cos(o.rot) * half;
      const dy = Math.sin(o.rot) * half;
      return [
        { x: o.x - dx, y: o.y - dy, r: o.size * 0.4 },
        { x: o.x + dx, y: o.y + dy, r: o.size * 0.4 },
      ];
    }
    case 'clip': {
      const half = o.size * 0.5;
      const dx = Math.cos(o.rot) * half;
      const dy = Math.sin(o.rot) * half;
      return [
        { x: o.x - dx, y: o.y - dy, r: 9 },
        { x: o.x, y: o.y, r: 9 },
        { x: o.x + dx, y: o.y + dy, r: 9 },
      ];
    }
    case 'kiosk':
      return [
        { x: o.x, y: o.y - o.size * 0.3, r: o.size * 0.42 },
        { x: o.x, y: o.y + o.size * 0.28, r: o.size * 0.42 },
      ];
    case 'torn': {
      const fx = o.x <= 0 ? 1 : -1;
      const fy = o.y <= 0 ? 1 : -1;
      return [
        { x: o.x + fx * o.size * 0.28, y: o.y + fy * o.size * 0.28, r: o.size * 0.4 },
        { x: o.x + fx * o.size * 0.62, y: o.y + fy * o.size * 0.1, r: o.size * 0.2 },
        { x: o.x + fx * o.size * 0.1, y: o.y + fy * o.size * 0.62, r: o.size * 0.2 },
      ];
    }
  }
}

const OPPOSITE_CORNER: Record<Corner, Corner> = { tl: 'br', tr: 'bl', bl: 'tr', br: 'tl' };

/** The frame corner a dog-ear sits in. */
export function cornerPoint(c: Corner): Vec {
  return { x: c[1] === 'l' ? PAGE_INSET : PAGE_W - PAGE_INSET, y: c[0] === 't' ? PAGE_INSET : PAGE_H - PAGE_INSET };
}

/** Where the player stands after arriving through `c` (diagonally inward from it). */
function arrivalPoint(c: Corner | null): Vec {
  if (c === null) return { x: PAGE_W / 2, y: PAGE_H - 180 };
  const p = cornerPoint(c);
  return { x: p.x + (c[1] === 'l' ? 210 : -210), y: p.y + (c[0] === 't' ? 210 : -210) };
}

/** Exit corner for a page entered through `entry`: mostly the far one, never the one we came in by. */
function pickExitCorner(r: Rng, entry: Corner | null): Corner {
  if (entry === null) return r.pick(['tl', 'tr'] as const);
  const far = OPPOSITE_CORNER[entry];
  const pool: Corner[] = [far, far, far, ...CORNERS.filter((c) => c !== entry && c !== far)];
  return r.pick(pool);
}

const DEFAULT_PLAN: PagePlan = { index: 0, count: 1, entryCorner: null };

/**
 * One page: 6-10 inked obstacles (a torn corner always), an entry, and (unless it is the last page)
 * an exit drawn as a folded corner at least 700 units from the entry. The kiosk page also carries a paczkomat.
 */
export function generatePage(rng: Rng, plan: PagePlan = DEFAULT_PLAN): Page {
  const r = rng.fork(`page:${plan.index}`);
  const last = plan.index >= plan.count - 1;
  const entry = arrivalPoint(plan.entryCorner);
  let exit: PageExit | null = null;
  let exitCorner: Corner | null = null;
  if (!last) {
    exitCorner = pickExitCorner(r, plan.entryCorner);
    const p = cornerPoint(exitCorner);
    exit = { side: exitCorner[0] === 't' ? 't' : 'b', corner: exitCorner, x: p.x, y: p.y };
  }
  const free = CORNERS.filter((c) => c !== plan.entryCorner && c !== exitCorner);
  const torn = r.pick(free);
  const hasKiosk = plan.count >= 3 && plan.index === Math.floor(plan.count / 2);
  const obstacles: Obstacle[] = [];
  const add = (o: Obstacle): void => {
    o.colliders = colliders(o);
    obstacles.push(o);
  };
  const tp = { x: torn[1] === 'l' ? 0 : PAGE_W, y: torn[0] === 't' ? 0 : PAGE_H };
  add({ kind: 'torn', x: tp.x, y: tp.y, size: 150, rot: 0, seed: r.int(1, 1e6), colliders: [] });

  const clearOf = (o: Obstacle, margin: number): boolean =>
    o.colliders.every(
      (c) =>
        dist(c, entry) > c.r + 160 &&
        (!exit || dist(c, exit) > c.r + 190) &&
        obstacles.every((p) => p.colliders.every((d) => dist(c, d) > c.r + d.r + margin)),
    );

  if (hasKiosk) {
    for (let tries = 0; tries < 200; tries++) {
      const k: Obstacle = {
        kind: 'kiosk',
        x: r.range(240, PAGE_W - 240),
        y: r.range(PAGE_H * 0.3, PAGE_H * 0.7),
        size: 120,
        rot: 0,
        seed: r.int(1, 1e6),
        colliders: [],
      };
      k.colliders = colliders(k);
      if (clearOf(k, 120)) {
        obstacles.push(k);
        break;
      }
    }
  }

  const kinds: ObstacleKind[] = ['ring', 'qr', 'note', 'sticky', 'blot', 'clip', 'blot', 'blot', 'ring', 'blot'];
  const want = r.int(6, 9) + (hasKiosk ? 1 : 0);
  let guard = 0;
  let n = 0;
  while (obstacles.length < want && guard++ < 500) {
    const kind = r.chance(0.8) ? (kinds[n % kinds.length] ?? 'blot') : r.pick(kinds);
    const size =
      kind === 'blot'
        ? r.range(26, 52)
        : kind === 'ring'
          ? r.range(56, 74)
          : kind === 'qr'
            ? r.range(92, 116)
            : kind === 'sticky'
              ? r.range(78, 96)
              : kind === 'clip'
                ? r.range(70, 96)
                : r.range(84, 110);
    const o: Obstacle = {
      kind,
      x: r.range(110, PAGE_W - 110),
      y: r.range(110, PAGE_H - 110),
      size,
      rot: kind === 'clip' ? r.range(-1.4, 1.4) : r.range(-0.5, 0.5),
      seed: r.int(1, 1e6),
      colliders: [],
    };
    o.colliders = colliders(o);
    if (clearOf(o, 70)) {
      obstacles.push(o);
      n++;
    }
  }
  return {
    w: PAGE_W,
    h: PAGE_H,
    inset: PAGE_INSET,
    spawn: { ...entry },
    obstacles,
    index: plan.index,
    entry,
    entrySide: plan.entryCorner ? (plan.entryCorner[0] === 't' ? 't' : 'b') : 'b',
    entryCorner: plan.entryCorner,
    torn,
    exit,
    hasKiosk,
  };
}

/** All pages of a run, linked: page i+1 is entered through the corner opposite to page i's exit. */
export function generateRunPages(rng: Rng, count: number): Page[] {
  const pages: Page[] = [];
  let entryCorner: Corner | null = null;
  for (let i = 0; i < count; i++) {
    const page = generatePage(rng, { index: i, count, entryCorner });
    pages.push(page);
    if (page.exit) entryCorner = OPPOSITE_CORNER[page.exit.corner];
  }
  return pages;
}

/** Within this distance of the corner the dog-ear is drawn in for everyone; the Kartograf sees it from the start. */
export const EXIT_SIGHT = 400;

/** Whether the exit dog-ear is on the paper yet: always for the Kartograf, else once the player is near. */
export function exitVisible(page: Page, pos: Vec, revealsPage: boolean): boolean {
  if (!page.exit) return false;
  return revealsPage || dist(pos, page.exit) <= EXIT_SIGHT;
}

/** True when `pos` stands in the exit's folded corner. */
export function atExit(page: Page, pos: Vec): boolean {
  return page.exit !== null && dist(pos, page.exit) < EXIT_RADIUS;
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
