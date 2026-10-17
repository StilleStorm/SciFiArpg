import type { Player } from '../entities/types';
import { spendStars } from '../economy/stars';
import { adapterPrice, activeSets, type SetBonus } from './compat';
import { buyOutPrice } from './generate';
import { recomputeStats } from './stats';
import { SLOTS, type Item, type Slot } from './types';

export const INVENTORY_CAP = 20;

export type Outcome = 'ok' | 'full' | 'poor' | 'invalid';

export function inventoryFull(p: Pick<Player, 'inventory'>): boolean {
  return p.inventory.length >= INVENTORY_CAP;
}

/** Put an item into the inventory. False when there is no room. */
export function addItem(p: Pick<Player, 'inventory'>, item: Item): boolean {
  if (inventoryFull(p)) return false;
  p.inventory.push(item);
  return true;
}

export function allItems(p: Pick<Player, 'inventory' | 'equipment'>): Item[] {
  const out = [...p.inventory];
  for (const s of SLOTS) {
    const e = p.equipment[s];
    if (e) out.push(e);
  }
  return out;
}

export interface EquipResult {
  outcome: Outcome;
  /** The item that went back to the inventory. */
  replaced?: Item;
  /** Set when the new item clashes with an equipped one and now does nothing. */
  clash?: { number: number; tag: string };
  /** Sets that exist after the change and did not before. */
  newSets: SetBonus[];
}

const setKey = (s: SetBonus): string => `${s.a.uid}:${s.b.uid}`;

/** Wear an item from the inventory. The old one in that slot goes back to the inventory. */
export function equipItem(p: Player, item: Item): EquipResult {
  const at = p.inventory.indexOf(item);
  if (at < 0) return { outcome: 'invalid', newSets: [] };
  const before = new Set(activeSets(p.equipment).map(setKey));
  p.inventory.splice(at, 1);
  const old = p.equipment[item.slot];
  if (old) {
    delete old.equippedAt;
    delete old.blockedBy;
    p.inventory.push(old);
  }
  const stamp = Math.max(0, ...Object.values(p.equipment).map((e) => e?.equippedAt ?? 0)) + 1;
  item.equippedAt = stamp;
  p.equipment[item.slot] = item;
  recomputeStats(p);
  const res: EquipResult = {
    outcome: 'ok',
    newSets: activeSets(p.equipment).filter((s) => !before.has(setKey(s))),
  };
  if (old) res.replaced = old;
  if (item.blockedBy) res.clash = { number: item.blockedBy.number, tag: item.blockedBy.tag };
  return res;
}

/** Take an item off. It goes to the inventory, which needs room. */
export function unequipSlot(p: Player, slot: Slot): Outcome {
  const item = p.equipment[slot];
  if (!item) return 'invalid';
  if (inventoryFull(p)) return 'full';
  delete p.equipment[slot];
  delete item.equippedAt;
  delete item.blockedBy;
  p.inventory.push(item);
  recomputeStats(p);
  return 'ok';
}

/** Throw an item away (from the inventory or from a slot). */
export function dropItem(p: Player, item: Item): boolean {
  const at = p.inventory.indexOf(item);
  if (at >= 0) {
    p.inventory.splice(at, 1);
    return true;
  }
  if (p.equipment[item.slot] === item) {
    delete p.equipment[item.slot];
    recomputeStats(p);
    return true;
  }
  return false;
}

export const canBuyAdapter = (item: Item): boolean => item.blockedBy !== undefined && !item.adapter;

export function buyAdapter(p: Player, item: Item): Outcome {
  if (!canBuyAdapter(item)) return 'invalid';
  if (!spendStars(p, adapterPrice(item))) return 'poor';
  item.adapter = true;
  recomputeStats(p);
  return 'ok';
}

export const canBuyOut = (item: Item): boolean => item.freeVersion === true && !item.bought;

/** Buying out is allowed once the trial is over; the ads only begin then. */
export function buyOut(p: Player, item: Item): Outcome {
  if (!canBuyOut(item)) return 'invalid';
  if (!spendStars(p, buyOutPrice(item))) return 'poor';
  item.bought = true;
  recomputeStats(p);
  return 'ok';
}
