/**
 * Odrzuć do kosza (ITEMS 8): the bin. An item leaves the player for 10% of its list price in gwiazdki, without the service fee.
 * Rzadki and up ask once first (the sheet's job: `needsAsk`). A withdrawn item (wycofany z obiegu) can only be dropped, so the bin
 * refuses it through `disposalRefusal`; a binned unique is noted by the Asystent.
 */
import type { Player } from '../entities/types';
import { t } from '../i18n';
import { disposalRefusal } from '../items/absurd';
import { itemValue } from '../items/generate';
import { dropItem } from '../items/inventory';
import type { Item } from '../items/types';
import { BIN_SHARE } from '../balance/loot';
import { addStars } from './stars';

/** What the bin pays: 10% of the list price, at least 1. */
export const binValue = (item: Pick<Item, 'baseId' | 'tier' | 'level'>): number => Math.max(1, Math.round(itemValue(item) * BIN_SHARE));

/** Rzadki, zestaw and unikatowy ask once on a one-line form. */
export const needsAsk = (item: Pick<Item, 'tier' | 'setId'>): boolean => item.tier === 'rzadki' || item.tier === 'unikatowy' || item.setId !== undefined;

export type BinResult = { ok: true; gwiazdki: number; notes: string[] } | { ok: false; message: string };

/** Throw the item into the bin: out of the bag or the slot, the money into the purse. */
export function binItem(p: Player, item: Item): BinResult {
  const refusal = disposalRefusal(item, 'bin');
  if (refusal) return { ok: false, message: refusal };
  const number = item.number;
  const price = binValue(item);
  if (!dropItem(p, item)) return { ok: false, message: t('economy.kosz.missing') };
  addStars(p, price);
  const notes = [t('economy.kosz.done', { n: number, price })];
  if (item.uniqueId) notes.push(t('economy.kosz.unique'));
  return { ok: true, gwiazdki: price, notes };
}
