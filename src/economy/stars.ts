import type { Player } from '../entities/types';

type Purse = Pick<Player, 'gwiazdki'>;

/** Gwiazdki are whole numbers; negative or fractional amounts are ignored. */
export function addStars(p: Purse, n: number): void {
  const k = Math.floor(n);
  if (k > 0) p.gwiazdki += k;
}

/**
 * Gwiazdki earned from a pickup, with the gear's percent bonus (starBonus). The fractional part waits in starCarry,
 * so +15% on single stars pays one extra star in about seven.
 */
export function earnStars(p: Pick<Player, 'gwiazdki' | 'starBonus' | 'starCarry'>, n: number): void {
  if (n <= 0) return;
  const total = n * (1 + Math.max(-100, p.starBonus ?? 0) / 100) + (p.starCarry ?? 0);
  const whole = Math.floor(total + 1e-9);
  p.starCarry = total - whole;
  addStars(p, whole);
}

export const canAfford = (p: Purse, n: number): boolean => p.gwiazdki >= Math.ceil(n);

/** Spend n gwiazdki. Returns false and changes nothing when there are not enough. */
export function spendStars(p: Purse, n: number): boolean {
  const k = Math.ceil(n);
  if (k < 0 || p.gwiazdki < k) return false;
  p.gwiazdki -= k;
  return true;
}
