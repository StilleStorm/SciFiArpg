/**
 * Which claim bubbles are shown, and where. A crowd of speech bubbles hides the page, so at most BUBBLE_CAP speak at
 * once: bosses, then elites, then the nearest (within 260 units, or anywhere for 1.2 s after it was drawn in: the grace
 * counts toward the cap). While a stamp is on the page every claim bubble is hidden: the stamp is the event.
 * The others keep their bubble in the DOM with opacity 0 (a strike-through stays on it); nothing is rebuilt when it comes back.
 * A shown bubble is shifted inward so it stays inside the visible rectangle (`bubbleRect`), never clipped at the edge.
 */
import type { Enemy, Player } from '../entities/types';
import { rtOf } from '../enemies/runtime';

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

/** How far to move the span [lo, hi] so it lies inside [min, max]; a span wider than the room is put at `min`. Pure. */
export function shiftInto(lo: number, hi: number, min: number, max: number): number {
  if (hi - lo >= max - min) return min - lo;
  if (lo < min) return min - lo;
  if (hi > max) return max - hi;
  return 0;
}

/**
 * Call once per rendered frame before the views sync. `view`: the world rectangle the bubbles must stay inside (the camera's
 * view minus the HUD); `hush`: a stamp is on the page, so no claim bubble speaks.
 */
export function updateBubbleFocus(enemies: readonly Enemy[], p: Pick<Player, 'x' | 'y'>, opts: { view?: ViewBox; hush?: boolean } = {}): void {
  shown = new Set(pickBubbles(enemies, p, BUBBLE_CAP, shown));
  hushed = opts.hush === true;
  rect = opts.view ?? null;
}

/** Whether this enemy's claim bubble is on the paper right now. */
export function bubbleShown(e: Enemy): boolean {
  return !hushed && shown.has(e.id);
}

/** The rectangle shown bubbles are kept inside, or null before the first frame (tests). */
export function bubbleRect(): ViewBox | null {
  return rect;
}
