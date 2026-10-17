import type { Player } from '../entities/types';

type Purse = Pick<Player, 'gwiazdki'>;

/** Gwiazdki are whole numbers; negative or fractional amounts are ignored. */
export function addStars(p: Purse, n: number): void {
  const k = Math.floor(n);
  if (k > 0) p.gwiazdki += k;
}

export const canAfford = (p: Purse, n: number): boolean => p.gwiazdki >= Math.ceil(n);

/** Spend n gwiazdki. Returns false and changes nothing when there are not enough. */
export function spendStars(p: Purse, n: number): boolean {
  const k = Math.ceil(n);
  if (k < 0 || p.gwiazdki < k) return false;
  p.gwiazdki -= k;
  return true;
}
