/** The appeal form: dropped by the next elite while suspended; filing it lifts the shadowban. */
import type { Bus } from '../core/events';
import { createPickup } from '../entities/factory';
import type { Pickup } from '../entities/types';
import { t } from '../i18n';
import { nextId, type RunState } from '../world/run';

/** Kills without an elite after which the appeal drops anyway (used if enemy:died carries no tier). */
export const APPEAL_FALLBACK_KILLS = 12;

export function dropAppeal(s: RunState, x: number, y: number): void {
  const k = createPickup(nextId(s), x, y, s.nextItemNumber++, undefined, 0);
  s.pickups.push(k);
  s.hero.appeals.push(k.id);
  s.hero.appealOwed = false;
}

/** Called for every pickup the player touches. Returns true if it was an appeal form (and files it). */
export function takeAppeal(s: RunState, bus: Bus, k: Pickup): boolean {
  const i = s.hero.appeals.indexOf(k.id);
  if (i < 0) return false;
  s.hero.appeals.splice(i, 1);
  if (s.player.suspended) {
    s.player.suspended = false;
    bus.emit('player:unsuspended');
    bus.emit('footnote', { text: t('forms.death.zawieszenie.appealed') });
  }
  return true;
}

/** Hook for enemy:died: the next elite (or the fallback count) drops the form. */
export function maybeDropAppeal(s: RunState, x: number, y: number, tier: 'common' | 'elite' | 'boss' | undefined): void {
  if (!s.player.suspended || !s.hero.appealOwed) return;
  if (tier === 'elite' || tier === 'boss' || s.kills - s.hero.suspendedAtKills >= APPEAL_FALLBACK_KILLS) dropAppeal(s, x, y);
}
