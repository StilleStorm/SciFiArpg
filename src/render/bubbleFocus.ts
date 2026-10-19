/**
 * Which claim bubbles are shown, and where. A crowd of speech bubbles hides the page, so at most BUBBLE_CAP speak at
 * once: bosses, then elites, then the nearest (within 260 units, or anywhere for 1.2 s after it was drawn in: the grace
 * counts toward the cap). While a stamp is on the page every claim bubble is hidden: the stamp is the event.
 * The others keep their bubble in the DOM with opacity 0 (a strike-through stays on it); nothing is rebuilt when it comes back.
 * A shown bubble is shifted inward so it stays inside the visible rectangle (`bubbleRect`), never clipped at the edge,
 * and off the pads and margin notes (`bubbleBlocks`, render/keepOut).
 */
import type { Enemy, Player } from '../entities/types';
import { rtOf } from '../enemies/runtime';
import type { Box } from './keepOut';

export { shiftInto } from './keepOut';

export const BUBBLE_RADIUS = 260;
export const BUBBLE_NEW_S = 1.2;
export const BUBBLE_CAP = 2;
/** A bubble already shown counts as this much nearer, so two enemies at about the same distance do not swap bubbles every frame. */
const KEEP_BIAS = 30;

export interface ViewBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

let shown = new Set<number>();
let hushed = false;
let rect: ViewBox | null = null;
let blocks: readonly Box[] = [];
/** The shown bubbles placed so far this frame: a later one keeps off them as off a pad. */
const placed: Box[] = [];

const rank = (e: Enemy): number => (e.boss === true ? 0 : e.elite !== undefined ? 1 : 2);

/** The common enemy nearest to the player within BUBBLE_RADIUS, or null. */
export function nearestBubbleEnemy(enemies: readonly Enemy[], p: Pick<Player, 'x' | 'y'>, radius = BUBBLE_RADIUS): Enemy | null {
  let best: Enemy | null = null;
  let bd = radius;
  for (const e of enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d <= bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

/**
 * The ids of the enemies whose claim bubbles speak: only enemies with a claim; bosses first, then elites, then the rest
 * (within `radius` or still in the new grace) by distance; `keep` (the ones shown last frame) win a near tie. Pure.
 */
export function pickBubbles(
  enemies: readonly Enemy[],
  p: Pick<Player, 'x' | 'y'>,
  cap = BUBBLE_CAP,
  keep: ReadonlySet<number> = new Set(),
  radius = BUBBLE_RADIUS,
): number[] {
  const best: { id: number; r: number; d: number }[] = [];
  for (const e of enemies) {
    if (!e.claim) continue;
    const r = rank(e);
    const d0 = Math.hypot(e.x - p.x, e.y - p.y);
    if (r === 2 && d0 > radius && rtOf(e).age >= BUBBLE_NEW_S) continue;
    const d = keep.has(e.id) ? d0 - KEEP_BIAS : d0;
    // insertion into a list of at most `cap` (no sort, no garbage per enemy)
    let i = best.length;
    while (i > 0) {
      const b = best[i - 1];
      if (!b || b.r < r || (b.r === r && b.d <= d)) break;
      i--;
    }
    if (i >= cap) continue;
    best.splice(i, 0, { id: e.id, r, d });
    if (best.length > cap) best.pop();
  }
  return best.map((b) => b.id);
}

/**
 * Call once per rendered frame before the views sync. `view`: the world rectangle the bubbles must stay inside (the camera's
 * view minus the HUD); `blocks`: the pads and margin notes over it, in world units (`keepOutBlocks`); `hush`: a stamp is on
 * the page, so no claim bubble speaks.
 */
export function updateBubbleFocus(
  enemies: readonly Enemy[],
  p: Pick<Player, 'x' | 'y'>,
  opts: { view?: ViewBox; blocks?: readonly Box[]; hush?: boolean } = {},
): void {
  shown = new Set(pickBubbles(enemies, p, BUBBLE_CAP, shown));
  hushed = opts.hush === true;
  rect = opts.view ?? null;
  blocks = opts.blocks ?? [];
  placed.length = 0;
}

/** What a shown bubble keeps out from under (world units), as of this frame: the pads and margin notes, then the bubbles placed before it. */
export function bubbleBlocks(): readonly Box[] {
  return placed.length > 0 ? [...blocks, ...placed] : blocks;
}

/** A shown bubble took this place this frame (world units). */
export function bubblePlaced(b: Box): void {
  placed.push(b);
}

/** Whether this enemy's claim bubble is on the paper right now. */
export function bubbleShown(e: Enemy): boolean {
  return !hushed && shown.has(e.id);
}

/** The rectangle shown bubbles are kept inside, or null before the first frame (tests). */
export function bubbleRect(): ViewBox | null {
  return rect;
}
