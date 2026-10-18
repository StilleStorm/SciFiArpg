/** Passive quirks that react to events. Pure functions on the run state; heroes/layer.ts wires them to the bus. */
import type { Bus } from '../core/events';
import { t } from '../i18n';
import type { RunState } from '../world/run';
import { recomputeStats } from '../items/stats';
import { castSkill } from './skills';

/** Every 10th hit on a Pralka is a "blad programu": a random skill fires for free. Returns true if it fired. */
export const HITS_PER_ERROR = 10;

export function onPlayerHit(s: RunState, bus: Bus): boolean {
  if (s.status !== 'running' || s.player.heroId !== 'pralka') return false;
  s.hero.hitsTaken++;
  if (s.hero.hitsTaken % HITS_PER_ERROR !== 0) return false;
  bus.emit('footnote', { text: t('heroes.pralka.quirkNote') });
  const slot = s.rngs.combat.int(0, 2) as 0 | 1 | 2;
  return castSkill(s, bus, slot, true);
}

/** Nalesnik, rownowaga hydrostatyczna: below this share of racja it rounds up (DESIGN 10, item 5). */
export const ROUND_BELOW = 1 / 3;
export const ROUND_S = 5;
export const ROUND_COOLDOWN_S = 20;
export const ROUND_UPOR = 20;

/**
 * Below a third of racja the pancake rounds up for 5 s: +20 upor (taken back when it flattens again), the figure drawn rounder
 * (`player.round`), and the Asystent notes that the application is being reconsidered. 20 s after it began it may do it again.
 * Nothing in the game moves the player by force, so the immunity to knockback is only the flag.
 */
export function tickRound(s: RunState, bus: Bus): void {
  const p = s.player;
  if (p.heroId !== 'nalesnik') return;
  const h = s.hero;
  if (p.round) {
    if (s.time < h.roundUntil) return;
    p.round = false;
    p.baseStats.stats.upor -= h.roundUpor;
    h.roundUpor = 0;
    recomputeStats(p);
    return;
  }
  if (p.hp <= 0 || p.hp >= p.hpMax * ROUND_BELOW || s.time < h.roundReadyAt) return;
  p.round = true;
  h.roundUntil = s.time + ROUND_S;
  h.roundReadyAt = s.time + ROUND_COOLDOWN_S;
  h.roundUpor = ROUND_UPOR;
  p.baseStats.stats.upor += ROUND_UPOR;
  recomputeStats(p);
  bus.emit('footnote', { text: t('heroes.nalesnik.quirkNote') });
}
