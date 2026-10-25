/** Leaf helpers that systems/combat.ts calls; imports only types and items/sets.ts (pure data, no systems) so there is no import cycle. */
import type { Player } from '../entities/types';
import { hasEffect } from '../items/sets';

/** Suspended players deal 30% less damage (DESIGN 9.1). */
export const SUSPENDED_DAMAGE = 0.7;

export function playerDamageMul(p: Pick<Player, 'suspended'>): number {
  return p.suspended ? SUSPENDED_DAMAGE : 1;
}

/** The foam shield soaks damage first. Returns what is left for racja. */
export function absorbShield(p: Pick<Player, 'shield'>, amount: number): number {
  if (p.shield <= 0) return amount;
  const soaked = Math.min(p.shield, amount);
  p.shield -= soaked;
  return amount - soaked;
}

/** A hero with the `skim` trait (Nalesnik, rownowaga hydrostatyczna): at full racja it lies flat and projectiles skim off it (-30%). Everything else: 1. */
export const SKIM = 0.7;
/** The disc counts as flat (projectiles skim off) from this share of racja; a standing trait, not a first-hit bonus. */
export const SKIM_FROM = 0.9;
export const SKIM_FROM_AWARIA = 0.8;

export function projectileDamageMul(p: Pick<Player, 'hp' | 'hpMax' | 'skim' | 'sets'>): number {
  const from = hasEffect(p, 'regula-podwojona') ? SKIM_FROM_AWARIA : SKIM_FROM; // «Awaria», three pieces: flat from 80%
  return p.skim === true && p.hp >= p.hpMax * from ? SKIM : 1;
}
