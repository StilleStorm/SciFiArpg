import { createRng, type Rng } from '../core/rng';
import type { Player } from '../entities/types';
import { t } from '../i18n';
import { AFFIXES_BY_ID } from '../items/affixes';
import { adapterPrice } from '../items/compat';
import { itemValue, rollItem } from '../items/generate';
import { addItem, inventoryFull } from '../items/inventory';
import type { Item, ItemTier, Slot } from '../items/types';
import { SLOTS } from '../items/types';
import { makeSetPiece } from '../items/setPieces';
import { BASES_BY_ID } from '../items/bases';
import { SETS_BY_ID } from '../items/sets';
import type { SetId } from '../items/types';
import { SHOP_SET_CHANCE } from '../balance/loot';
import { planetDef } from '../world/campaign';
import { spendStars } from './stars';

/** Added at checkout, not shown in the price (footnote "Cena nie zawiera opłaty serwisowej."). */
export const FEE_RATE = 0.2;
/** Lie rate: 1 in 6 at first; every store update then decides 1 in 4 or 1 in 10 at random (ITEMS 7.1). */
export const FIRST_LIE_RATE = 1 / 6;
export const UPDATED_LIE_RATES: readonly number[] = [1 / 4, 1 / 10];
export const LIE_RATES: readonly number[] = [FIRST_LIE_RATE, ...UPDATED_LIE_RATES];
export const REPORTS_TO_UPDATE = 3;
export const STOCK_SIZE = 6;

export type Lie = 'wariant' | 'cena';

/** plate: an ordinary plate; oferta: the planet's special offer; adapter: a plate sold with its adapter (the compatibility clash is ignored). */
export type ListingKind = 'plate' | 'oferta' | 'adapter';

export interface Listing {
  id: number;
  /** Absent in stock saved before S9 (= plate). */
  kind?: ListingKind;
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

/** The lie rate after `updates` store updates; the choice after an update is a pure function of the seed and the update count. */
export function lieRate(updates: number, seed = 0): number {
  if (updates <= 0) return FIRST_LIE_RATE;
  return createRng(seed).fork(`sklep-rate:${updates}`).pick(UPDATED_LIE_RATES);
}

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

export interface ListingOptions {
  /** Force the tier (stock rules); otherwise the shop's weights. */
  tier?: ItemTier;
  kind?: ListingKind;
  /** The offer is a zestaw piece of this set (ITEMS 7.1); the piece whose slot is the listing's slot when the set has one. */
  set?: SetId;
}

/** A piece of the set for the offer: the piece that goes in `slot` if the set has one, otherwise one at random. */
function setOffer(rng: Rng, set: SetId, level: number, slot: Slot): Item | null {
  const def = SETS_BY_ID.get(set);
  const at = def?.pieces.findIndex((p) => BASES_BY_ID.get(p.baseId)?.slot === slot) ?? -1;
  return makeSetPiece(rng, set, level, at >= 0 ? (at as 0 | 1 | 2) : undefined);
}

/** Make one listing. Whether it lies is decided here, with the current lie rate. */
export function makeListing(rng: Rng, id: number, level: number, slot: Slot, rate: number, opts: ListingOptions = {}): Listing {
  const tier = opts.tier ?? shopTier(rng);
  const kind = opts.kind ?? 'plate';
  let item = (opts.set ? setOffer(rng, opts.set, level, slot) : null) ?? rollItem(rng, { tier, slot, level, shop: true });
  if (kind === 'oferta' && !item.setId) {
    // "A rzadki with a g3 affix": reroll a few times until one of the lines is grade 3.
    for (let i = 0; i < 12 && !item.affixes.some((a) => AFFIXES_BY_ID.get(a)?.grade === 3); i++) item = rollItem(rng, { tier, slot, level, shop: true });
  }
  if (kind === 'adapter') item.adapter = true;
  const price = itemValue(item) + (kind === 'adapter' ? adapterPrice(item) : 0);
  const listing: Listing = { id, kind, item, delivered: item, price, truePrice: price, sold: false };
  if (rng.chance(rate)) {
    if (rng.chance(0.5)) {
      const variant = rollItem(rng, { tier, slot, level, baseId: item.baseId, shop: true });
      variant.variant = true;
      if (kind === 'adapter') variant.adapter = true;
      listing.delivered = variant;
      listing.lie = 'wariant';
    } else {
      listing.truePrice = price + Math.max(2, Math.round(price * rng.range(0.4, 1)));
      listing.lie = 'cena';
    }
  }
  return listing;
}

/** The six plates of ITEMS 7.1: three zwykły or nietypowy in different slots, one rzadki, one oferta, one adapter (see `restock`). */
/**
 * New stock for a visit. Deterministic from (seed, visit key, updates). `level` is the item level of the band
 * (items/level.ts shopIlvl: the planet's band at page offset 1); ui/sklep.ts and economy/kiosk.ts pass shopIlvl(planet).
 */
export function restock(state: SklepState, seed: number, visitKey: number, level: number, planet = 0): void {
  const rng = createRng(seed).fork(`sklep:${visitKey}:${state.updates}`);
  const slots = shuffled(rng, SLOTS);
  const rate = lieRate(state.updates, seed);
  const hosted = planetDef(planet).hostedSet;
  const lowTiers = (): ItemTier => (rng.chance(0.5) ? 'zwykly' : 'nietypowy');
  const at = (i: number): Slot => slots[i % slots.length] ?? 'bron';
  const specs: { slot: Slot; opts: ListingOptions }[] = [
    { slot: at(0), opts: { tier: lowTiers() } },
    { slot: at(1), opts: { tier: lowTiers() } },
    { slot: at(2), opts: { tier: lowTiers() } },
    { slot: at(3), opts: { tier: 'rzadki' } },
    // 10% of offers are a zestaw piece of the planet's set (ITEMS 7.1); a planet without a set rolls nothing, so its stock is unchanged
    { slot: at(4), opts: { tier: 'rzadki', kind: 'oferta', ...(hosted && rng.chance(SHOP_SET_CHANCE) ? { set: hosted } : {}) } },
    { slot: at(0), opts: { tier: lowTiers(), kind: 'adapter' } },
  ];
  state.stock = specs.map((sp) => makeListing(rng, state.nextListingId++, level, sp.slot, rate, sp.opts));
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
export function reportProblem(state: SklepState, seed: number, level: number, planet = 0): ReportResult {
  state.reports++;
  if (state.reports < REPORTS_TO_UPDATE) return { reports: state.reports, updated: false };
  state.reports = 0;
  state.updates++;
  restock(state, seed, state.stockFor, level, planet);
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
