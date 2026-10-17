/**
 * When the AKTUALIZACJA form may open (DESIGN 8, timing). A level up only queues the update; the form opens
 * when the page is quiet, when the page turns, or when the player asks for it by tapping the HUD. Several
 * queued updates open one after another. Never while a boss is alive, never while a sheet holds the screen.
 * Pure functions on the run state; the layer (heroes/layer.ts) does the opening.
 */
import type { RunState } from '../world/run';

/** No enemy within this many units ... */
export const CALM_RADIUS = 320;
/** ... for this many seconds opens the form by itself. */
export const CALM_SECONDS = 1.5;

export const bossAlive = (s: RunState): boolean => s.enemies.some((e) => e.boss === true);

/** Nothing else holds the screen and the fight is not a boss fight: the form may open if something asks for it. */
export function canOpenUpdate(s: RunState, formOpen: boolean): boolean {
  return s.hero.pendingLevels > 0 && !formOpen && s.status === 'running' && !s.modal && !s.turning && !bossAlive(s);
}

/** The player (HUD tap) or the page turn asks for the form. Returns false if there is nothing queued. */
export function requestUpdate(s: RunState): boolean {
  if (s.hero.pendingLevels <= 0) return false;
  s.hero.updateRequested = true;
  return true;
}

/**
 * One simulation step of the queue. Counts the calm, and returns true when the form should open now
 * (the caller still checks canOpenUpdate). Resets the calm whenever an enemy is near or a boss lives.
 */
export function tickUpdateQueue(s: RunState, dt: number): boolean {
  const h = s.hero;
  if (h.pendingLevels <= 0) {
    h.calm = 0;
    h.updateRequested = false;
    return false;
  }
  if (bossAlive(s)) {
    h.calm = 0;
    return false;
  }
  const p = s.player;
  const near = s.enemies.some((e) => Math.hypot(e.x - p.x, e.y - p.y) < CALM_RADIUS);
  h.calm = near ? 0 : h.calm + dt;
  return h.updateRequested || h.calm >= CALM_SECONDS;
}
