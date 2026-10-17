/** Leaf helpers that systems/combat.ts calls; imports nothing but types so there is no import cycle. */
import type { Player } from '../entities/types';

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
