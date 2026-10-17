import type { Player } from '../entities/types';
import { SLOTS, type Blocked, type Item, type StatBlock, type Tag } from './types';

/** A pair of items that like the same thing grants this, once per pair (at most MAX_SETS pairs). */
export const SET_BONUS: Partial<StatBlock> = { pewnosc: 6, upor: 6 };
export const MAX_SETS = 3;

export interface SetBonus {
  a: Item;
  b: Item;
  tag: Tag;
}

type Equipment = Player['equipment'];

/** Why A and B cannot be worn together: one likes what the other dislikes. */
export function conflictTag(a: Item, b: Item): Tag | null {
  if (a.dislikes && a.dislikes === b.likes) return a.dislikes;
  if (b.dislikes && b.dislikes === a.likes) return b.dislikes;
  return null;
}

/** Items that share a like (and do not clash) form a set. */
export function setTag(a: Item, b: Item): Tag | null {
  if (a.likes && a.likes === b.likes && !conflictTag(a, b)) return a.likes;
  return null;
}

function equippedList(eq: Equipment): Item[] {
  const list: Item[] = [];
  for (const slot of SLOTS) {
    const item = eq[slot];
    if (item) list.push(item);
  }
  return list.sort((x, y) => (x.equippedAt ?? 0) - (y.equippedAt ?? 0));
}

/**
 * Walk the equipped items oldest first. A newer item that clashes with an active one is
 * niekompatybilny (blockedBy is set) and does nothing, unless it has an adapter.
 * Returns the active items.
 */
export function refreshCompat(eq: Equipment): Item[] {
  const active: Item[] = [];
  for (const item of equippedList(eq)) {
    let blocked: Blocked | undefined;
    if (!item.adapter) {
      for (const other of active) {
        const tag = conflictTag(item, other);
        if (tag) {
          blocked = { uid: other.uid, number: other.number, tag };
          break;
        }
      }
    }
    if (blocked) item.blockedBy = blocked;
    else delete item.blockedBy;
    if (!blocked) active.push(item);
  }
  return active;
}

/** Active pairs that form a set. Call after refreshCompat. */
export function activeSets(eq: Equipment): SetBonus[] {
  const active = equippedList(eq).filter((i) => !i.blockedBy);
  const sets: SetBonus[] = [];
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      if (!a || !b) continue;
      const tag = setTag(a, b);
      if (tag) sets.push({ a, b, tag });
    }
  }
  return sets.slice(0, MAX_SETS);
}

/** Adapter price in gwiazdki (a dongle, drawn on the card). */
export function adapterPrice(item: Item): number {
  const byTier = { zwykly: 6, nietypowy: 8, rzadki: 12, unikatowy: 20 } as const;
  return byTier[item.tier] + Math.floor(item.level / 2);
}

export const isBlocked = (item: Item): boolean => item.blockedBy !== undefined && !item.adapter;
