import { createRng, type Rng } from '../core/rng';
import type { Player } from '../entities/types';
import { t } from '../i18n';
import { itemValue, rollItem } from '../items/generate';
import { addItem, inventoryFull } from '../items/inventory';
import type { Item, ItemTier, Slot } from '../items/types';
import { SLOTS } from '../items/types';
import { spendStars } from './stars';

/** Added at checkout, not shown in the price (footnote "Cena nie zawiera opłaty serwisowej."). */
export const FEE_RATE = 0.2;
/** Lie rate by number of store updates: 1 in 6 at first, then whatever the update decided. */
export const LIE_RATES: readonly number[] = [1 / 6, 1 / 3, 1 / 12, 1 / 4];
export const REPORTS_TO_UPDATE = 3;
export const STOCK_SIZE = 6;

export type Lie = 'wariant' | 'cena';

export interface Listing {
  id: number;
  /** The item as advertised. */
  item: Item;
  /** What is actually handed over (a different roll of the same base when lie = wariant). */
  delivered: Item;
  /** The price shown, without the fee. */
  price: number;
  /** The price charged, without the fee (differs when lie = cena). */
  truePrice: number;
  lie?: Lie;
  sold: boolean;
}

export interface SklepState {
  stock: Listing[];
  reports: number;
  updates: number;
  /** runsCompleted when the stock was made (a new visit = new stock). */
  stockFor: number;
  nextListingId: number;
}

export function createSklep(): SklepState {
  return { stock: [], reports: 0, updates: 0, stockFor: -1, nextListingId: 1 };
}

export const lieRate = (updates: number): number => LIE_RATES[updates % LIE_RATES.length] ?? 1 / 6;

export const feeOf = (price: number): number => Math.ceil(price * FEE_RATE);
export const totalOf = (price: number): number => price + feeOf(price);

/** The shop sells ordinary things: no uniques, mostly low tiers. */
const SHOP_WEIGHTS: readonly [number, number, number, number] = [45, 40, 15, 0];

function shopTier(rng: Rng): ItemTier {
  const r = rng.next() * 100;
  if (r < SHOP_WEIGHTS[0]) return 'zwykly';
  if (r < SHOP_WEIGHTS[0] + SHOP_WEIGHTS[1]) return 'nietypowy';
  return 'rzadki';
}

function shuffled<T>(rng: Rng, list: readonly T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const x = a[i];
    const y = a[j];
    if (x !== undefined && y !== undefined) {
      a[i] = y;
      a[j] = x;
    }
  }
  return a;
}

/** Make one listing. Whether it lies is decided here, with the current lie rate. */
export function makeListing(rng: Rng, id: number, level: number, slot: Slot, rate: number): Listing {
  const tier = shopTier(rng);
  const item = rollItem(rng, { tier, slot, level });
  const price = itemValue(item);
  const listing: Listing = { id, item, delivered: item, price, truePrice: price, sold: false };
  if (rng.chance(rate)) {
    if (rng.chance(0.5)) {
      const variant = rollItem(rng, { tier, slot, level, baseId: item.baseId });
      variant.variant = true;
      listing.delivered = variant;
      listing.lie = 'wariant';
    } else {
      listing.truePrice = price + Math.max(2, Math.round(price * rng.range(0.4, 1)));
      listing.lie = 'cena';
    }
  }
  return listing;
}

/** New stock for a visit. Deterministic from (seed, visit key, updates). */
export function restock(state: SklepState, seed: number, visitKey: number, level: number): void {
  const rng = createRng(seed).fork(`sklep:${visitKey}:${state.updates}`);
  const slots = shuffled(rng, [...SLOTS, ...SLOTS]).slice(0, STOCK_SIZE);
  const rate = lieRate(state.updates);
  state.stock = slots.map((slot) => makeListing(rng, state.nextListingId++, level, slot, rate));
  state.stockFor = visitKey;
}

export type BuyFailure = 'sold' | 'full' | 'poor';

export interface Purchase {
  ok: boolean;
  failure?: BuyFailure;
  /** Charged, with the fee. */
  total: number;
  fee: number;
  /** The item handed over. */
  item?: Item;
  lie?: Lie;
  /** The footnote that follows (the correction when the vendor lied). */
  note?: string;
}

/**
 * Pay and receive. The fee is added at checkout. If the vendor lied, the player learns it
 * only now, in the footnote; the gwiazdki are not refunded. Not enough money for the real
 * price gives a refusal that says nothing about why.
 */
export function buy(state: SklepState, p: Pick<Player, 'gwiazdki' | 'inventory'>, listingId: number, itemNumber: number): Purchase {
  const listing = state.stock.find((l) => l.id === listingId);
  if (!listing || listing.sold) return { ok: false, failure: 'sold', total: 0, fee: 0 };
  if (inventoryFull(p)) return { ok: false, failure: 'full', total: 0, fee: 0 };
  const fee = feeOf(listing.truePrice);
  const total = listing.truePrice + fee;
  if (!spendStars(p, total)) return { ok: false, failure: 'poor', total, fee };
  listing.sold = true;
  const item = listing.delivered;
  item.number = itemNumber;
  addItem(p, item);
  const res: Purchase = { ok: true, total, fee, item };
  if (listing.lie) {
    res.lie = listing.lie;
    res.note =
      listing.lie === 'wariant'
        ? t('economy.lie.wariant', { listed: listing.item.name, got: item.name })
        : t('economy.lie.cena', { listed: listing.price, charged: listing.truePrice });
  }
  return res;
}

export interface ReportResult {
  /** Reports now counted toward the next update. */
  reports: number;
  updated: boolean;
}

/** "Zgłoś problem": after 3 reports the store updates and the lie rate changes (new stock too). */
export function reportProblem(state: SklepState, seed: number, level: number): ReportResult {
  state.reports++;
  if (state.reports < REPORTS_TO_UPDATE) return { reports: state.reports, updated: false };
  state.reports = 0;
  state.updates++;
  restock(state, seed, state.stockFor, level);
  return { reports: 0, updated: true };
}

// ---------- persistence (own key; the meta schema is not ours) ----------

export const SKLEP_KEY = 'zgloszenie.sklep';

export function loadSklep(): SklepState {
  try {
    const raw = globalThis.localStorage?.getItem(SKLEP_KEY);
    if (!raw) return createSklep();
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null) return createSklep();
    const o = v as Partial<SklepState>;
    if (!Array.isArray(o.stock)) return createSklep();
    return {
      stock: o.stock,
      reports: typeof o.reports === 'number' ? o.reports : 0,
      updates: typeof o.updates === 'number' ? o.updates : 0,
      stockFor: typeof o.stockFor === 'number' ? o.stockFor : -1,
      nextListingId: typeof o.nextListingId === 'number' ? o.nextListingId : 1,
    };
  } catch {
    return createSklep();
  }
}

export function saveSklep(state: SklepState): void {
  try {
    globalThis.localStorage?.setItem(SKLEP_KEY, JSON.stringify(state));
  } catch {
    /* storage may be full or blocked; the shop simply forgets */
  }
}
