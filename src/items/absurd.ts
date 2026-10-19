import type { Rng } from '../core/rng';
import { t } from '../i18n';
import { AD_COUNT } from './ads';
import type { Player } from '../entities/types';
import { SLOTS, type Item } from './types';

/** Mechanics of the six absurd affixes (ITEMS 3.3). Pure functions over an item and an rng; wiring is the integrator's. */

/** "Domniemany": one hit in five on the wearer ignores the item (e = 0.8). */
export const DOMNIEMANY_E = 0.8;
/** "W wersji próbnej" lasts this many pages from the first equip. */
export const TRIAL_PAGES = 2;
/** "Ewentualny" is re-rolled between these fractions of its nominal value. */
export const EWENTUALNY_RANGE: readonly [number, number] = [0.5, 1.5];

const has = (item: Pick<Item, 'affixes'>, id: string): boolean => item.affixes.includes(id);

/** "Wycofany z obiegu": cannot be sold, reclaimed or binned; only dropped. The Sklep refuses it by footnote. */
export const isWithdrawn = (item: Pick<Item, 'affixes'>): boolean => has(item, 'wycofany');

/** The Sklep footnote refusing a withdrawn item. */
export const withdrawnNote = (): string => t('items.absurd.wycofany');

/** Ways an item can leave the player (ITEMS 7.2, 7.3, 8). */
export type Disposal = 'sell' | 'bin' | 'reklamacja' | 'drop';

/**
 * The one guard every way of getting rid of an item calls: null when allowed, otherwise the refusal text.
 * A withdrawn item may only be dropped; the Sklep refuses a sale by its footnote, the bag and the kiosk by the own-bag line.
 */
export function disposalRefusal(item: Pick<Item, 'affixes'>, how: Disposal): string | null {
  if (how === 'drop' || !isWithdrawn(item)) return null;
  return how === 'sell' ? withdrawnNote() : t('items.absurd.wycofanyOwn');
}

/** "Domniemany": does this hit on the wearer ignore the item entirely? Rolls on the combat stream. */
export function hitIgnoresItem(item: Pick<Item, 'affixes'>, rng: Rng): boolean {
  return has(item, 'domniemany') && rng.chance(1 - DOMNIEMANY_E);
}

/** "Ewentualny" and "rzekomy" want a prefix on the card number: "ok. 16" / the Asystent's "(wg relacji)". */
export const showsApproximately = (item: Pick<Item, 'affixes'>): boolean => has(item, 'ewentualny');
export const claimIsHearsay = (item: Pick<Item, 'affixes'>): boolean => has(item, 'rzekomy');

export interface PageEntryResult {
  /** The numbers changed: call recomputeStats on the wearer. */
  changed: boolean;
  /** Footnotes to show, already in Polish. */
  notes: string[];
}

/**
 * Page entry for one item. Call for every item in the bag and on the body when a page begins,
 * with `equipped` telling which. Rolls on `rng` (use the loot stream).
 * - ewentualny: the pewność is re-rolled between 50% and 150% of its nominal value.
 * - sponsorowany: once per page, equipped, an advertisement footnote.
 * - w wersji próbnej: counts pages worn; after two, back to the plain numbers with a footnote.
 */
export function onPageEntry(item: Item, rng: Rng, equipped: boolean): PageEntryResult {
  const out: PageEntryResult = { changed: false, notes: [] };
  const st = item.absurd;
  if (st && st.ewentNominal !== undefined && st.ewentNow !== undefined) {
    const next = Math.round(st.ewentNominal * rng.range(EWENTUALNY_RANGE[0], EWENTUALNY_RANGE[1]));
    const delta = next - st.ewentNow;
    if (delta !== 0) {
      item.claimed.pewnosc += delta;
      item.actual.pewnosc += delta;
      st.ewentNow = next;
      out.changed = true;
    }
  }
  if (equipped && has(item, 'sponsorowany')) out.notes.push(t(`items.ads.a${rng.int(1, AD_COUNT)}`));
  if (equipped && has(item, 'probny') && item.plain && !item.absurd?.trialEnded) {
    const st2 = (item.absurd ??= {});
    st2.pagesWorn = (st2.pagesWorn ?? 0) + 1;
    if (st2.pagesWorn >= TRIAL_PAGES) {
      st2.trialEnded = true;
      item.claimed = { ...item.plain.claimed };
      item.actual = { ...item.plain.actual };
      out.changed = true;
      out.notes.push(t('items.absurd.probny'));
    }
  }
  return out;
}

/**
 * Page entry for the whole character (world/pageTurn.ts enterPage calls it): every worn item with equipped = true,
 * then the bag. `changed` = call recomputeStats; `notes` = footnotes in order.
 */
export function pageEntryAll(p: Pick<Player, 'equipment' | 'inventory'>, rng: Rng): PageEntryResult {
  const out: PageEntryResult = { changed: false, notes: [] };
  const take = (item: Item, equipped: boolean): void => {
    const r = onPageEntry(item, rng, equipped);
    if (r.changed && equipped) out.changed = true;
    out.notes.push(...r.notes);
  };
  for (const slot of SLOTS) {
    const item = p.equipment[slot];
    if (item) take(item, true);
  }
  for (const item of p.inventory) take(item, false);
  return out;
}
