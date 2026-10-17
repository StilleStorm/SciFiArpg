import type { Player } from '../entities/types';
import { recomputeStats } from '../items/stats';
import { SLOTS } from '../items/types';
import type { Stash } from './save';

/** Copy what the player carries into a stash (plain data, safe to JSON). */
export function takeStash(p: Pick<Player, 'inventory' | 'equipment'>): Stash {
  return JSON.parse(JSON.stringify({ inventory: p.inventory, equipment: p.equipment })) as Stash;
}

/** Highest plate number among the stashed items (the next pickup continues after it). */
export function highestNumber(stash: Stash): number {
  let top = 0;
  for (const i of stash.inventory) top = Math.max(top, i.number);
  for (const slot of SLOTS) top = Math.max(top, stash.equipment[slot]?.number ?? 0);
  return top;
}

/** Hand a stash to a fresh player and let the item code recompute the stats from the gear. Returns the next item number. */
export function giveStash(p: Player, stash: Stash): number {
  p.inventory = JSON.parse(JSON.stringify(stash.inventory)) as Stash['inventory'];
  p.equipment = JSON.parse(JSON.stringify(stash.equipment)) as Stash['equipment'];
  recomputeStats(p);
  return highestNumber(stash) + 1;
}
