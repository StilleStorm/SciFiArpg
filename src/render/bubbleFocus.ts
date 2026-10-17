/**
 * Which claim bubbles are shown. A crowd of speech bubbles hides the page, so only these speak: elites, bosses,
 * the enemy nearest to the player (within 260 units) and every enemy for 1.2 s after it was drawn in.
 * The others keep their bubble in the DOM with opacity 0; nothing is rebuilt when it comes back.
 */
import type { Enemy, Player } from '../entities/types';
import { rtOf } from '../enemies/runtime';

export const BUBBLE_RADIUS = 260;
export const BUBBLE_NEW_S = 1.2;

let focusId = -1;

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

/** Call once per rendered frame before the views sync. */
export function updateBubbleFocus(enemies: readonly Enemy[], p: Pick<Player, 'x' | 'y'>): void {
  focusId = nearestBubbleEnemy(enemies, p)?.id ?? -1;
}

/** Whether this enemy's bubble is on the paper right now. */
export function bubbleShown(e: Enemy): boolean {
  return e.boss === true || e.elite !== undefined || e.id === focusId || rtOf(e).age < BUBBLE_NEW_S;
}
