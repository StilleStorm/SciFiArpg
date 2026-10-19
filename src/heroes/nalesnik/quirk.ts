/** The Nalesnik's quirk, rownowaga hydrostatyczna: rounds up below a third of racja (and skims projectiles at full racja: heroes/shield.ts). */
import { t } from '../../i18n';
import { recomputeStats } from '../../items/stats';
import type { HeroQuirk } from '../module';

/** Below this share of racja it rounds up (DESIGN 10, item 5). */
export const ROUND_BELOW = 1 / 3;
export const ROUND_S = 5;
export const ROUND_COOLDOWN_S = 20;
export const ROUND_UPOR = 20;

/**
 * Below a third of racja the pancake rounds up for 5 s: +20 upor (taken back when it flattens again), the figure drawn rounder
 * (`player.round`), and the Asystent notes that the application is being reconsidered. 20 s after it began it may do it again.
 * Nothing in the game moves the player by force, so the immunity to knockback is only the flag.
 */
export const quirk: HeroQuirk = {
  tick(s, bus) {
    const p = s.player;
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
  },
};
