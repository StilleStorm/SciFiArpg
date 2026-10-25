import type { DamageType } from '../combat/damage';
import type { Gender } from '../i18n';

export type Slot = 'bron' | 'nakrycie' | 'odziez' | 'przyrzad' | 'dokument';
export const SLOTS: readonly Slot[] = ['bron', 'nakrycie', 'odziez', 'przyrzad', 'dokument'];

export type ItemTier = 'zwykly' | 'nietypowy' | 'rzadki' | 'unikatowy';
export const ITEM_TIERS: readonly ItemTier[] = ['zwykly', 'nietypowy', 'rzadki', 'unikatowy'];

/** The six sets (ITEMS 4.1); a set piece is a rzadki item with `setId` (S17), wearing the paperclip. */
export type SetId = 'obieg' | 'ostatnia-mila' | 'serwis' | 'infolinia' | 'domniemanie' | 'awaria';

/** What a worn unique gives its hero (ITEMS 4.2, 12.2): ranks on one skill and the paragraph of that skill. Resolved by heroes/grants.ts. */
export interface ItemGrant {
  uid: number;
  uniqueId: string;
  /** The skill id (`SkillDef.id`), not a hero id: the hero it concerns is the one that owns the skill. */
  skill: string;
  para: 2 | 3;
  ranks: 1 | 2;
}

/** Where a drop came from; decides the tier weights. */
export type DropSource = 'common' | 'elite' | 'boss';

export type Tag = 'papier' | 'metal' | 'watpliwosc' | 'halas' | 'porzadek' | 'chaos';
export const TAGS: readonly Tag[] = ['papier', 'metal', 'watpliwosc', 'halas', 'porzadek', 'chaos'];

export const STAT_KEYS = [
  'dmgMin',
  'dmgMax',
  'pewnosc',
  'upor',
  'racja',
  'crit',
  'resMechaniczny',
  'resRegulaminowy',
  'resEgzystencjalny',
  // S8: percentage stats (zasieg +%, tempo -% cooldown, gwiazdki +%, proba -% trial kills).
  'zasieg',
  'tempo',
  'gwiazdki',
  'proba',
] as const;
export type StatKey = (typeof STAT_KEYS)[number];
/** Flat numbers an item can carry. crit is in percentage points; res* are percent. */
export type StatBlock = Record<StatKey, number>;

export const RESIST_KEY: Record<DamageType, StatKey> = {
  mechaniczny: 'resMechaniczny',
  regulaminowy: 'resRegulaminowy',
  egzystencjalny: 'resEgzystencjalny',
};

/** What the reviews said versus what the trial found. */
export type ReviewTruth = 'honest' | 'bought' | 'niedoceniony';

export interface Review {
  /** 1.0 .. 5.0, one decimal. */
  rating: number;
  count: number;
  truth: ReviewTruth;
}

/** Why an equipped item does nothing: it clashes with an earlier one. */
export interface Blocked {
  uid: number;
  number: number;
  tag: Tag;
}

export interface Item {
  /** Identity (random, from the seeded stream). */
  uid: number;
  /** The plate number ("Ryc. N", "Przedmiot nr N"). 0 until picked up or bought. */
  number: number;
  /** Polish name, resolved at creation and refreshed by renameItem. */
  name: string;
  slot: Slot;
  baseId: string;
  gender: Gender;
  tier: ItemTier;
  level: number;
  /** Affix ids (see affixes.ts), in name order. */
  affixes: string[];
  /** Drawing id (render/itemDrawings.ts). */
  drawing: string;
  /** What the listing says. Used until the trial ends. */
  claimed: StatBlock;
  /** What it really does. Used after the trial ends. */
  actual: StatBlock;
  revealed: boolean;
  trialKills: number;
  trialTarget: number;
  /** Absent on uniques. */
  review?: Review;
  likes?: Tag;
  dislikes?: Tag;
  /** Weapons only. */
  damageType?: DamageType;
  range?: number;
  cooldownMul?: number;
  /** The rare affix "w wersji darmowej". */
  freeVersion?: boolean;
  /** Free version bought out: no ads, no penalty. */
  bought?: boolean;
  /** An adapter was bought: compatibility is ignored. */
  adapter?: boolean;
  /** Set while equipped; later equip = larger. */
  equippedAt?: number;
  /** Set by refreshCompat while this item clashes with an earlier one. */
  blockedBy?: Blocked;
  /** A shop lie: same base, different roll. */
  variant?: boolean;
  uniqueId?: string;
  /** S17: the set this piece belongs to (items/sets.ts); tier is rzadki. */
  setId?: SetId;
  /** S17 «Awaria»: the factor (0.85..1.15) the worn piece's numbers are scaled by until the next page entry (items/setFx.ts); dropped as soon as the set is no longer complete. */
  rollMul?: number;
  /** S18 Reklamacja (items/reklamacja.ts): the planets (0-based) this item was reclaimed on, one entry per reclaim, and the struck lines. */
  reklamacje?: { planet: number; struck: string; typed: string; mod: number }[];
  /** S8: tier I-V of the affix magnitudes (ITEMS 3.2); absent on older items = I. */
  modTier?: 1 | 2 | 3 | 4 | 5;
  /** S8: stats without the +20% of "w wersji próbnej", restored when the trial period ends. */
  plain?: { claimed: StatBlock; actual: StatBlock };
  /** S8: runtime state of the absurd affixes (items/absurd.ts). */
  absurd?: { pagesWorn?: number; trialEnded?: boolean; ewentNominal?: number; ewentNow?: number };
}

/**
 * S18 przesyłka (ITEMS 6.4, 8): a delivery notice. The item waits in a paczkomat; `page` is the 1-based page of the run whose paczkomat
 * holds it, 0 once it is at the base paczkomat. `age` counts the runs that ended while it waited at the base (items/delivery.ts).
 */
export interface Awizo {
  /** The parcel's own number: the plate number the item carries ("Awizo nr 14"). */
  n: number;
  item: Item;
  page: number;
  age: number;
  /** The seed of the run that sent it: an awizo of a ticket that was given up (a later run started with another seed) goes to the base. */
  seed?: number;
  /** Sent by the Komisja (a side ticket's reward). */
  komisja?: boolean;
}

export const emptyStats = (): StatBlock => ({
  dmgMin: 0,
  dmgMax: 0,
  pewnosc: 0,
  upor: 0,
  racja: 0,
  crit: 0,
  resMechaniczny: 0,
  resRegulaminowy: 0,
  resEgzystencjalny: 0,
  zasieg: 0,
  tempo: 0,
  gwiazdki: 0,
  proba: 0,
});

export function addStats(a: StatBlock, b: Partial<StatBlock>): StatBlock {
  const out = { ...a };
  for (const k of STAT_KEYS) out[k] = (out[k] ?? 0) + (b[k] ?? 0);
  return out;
}

export function mapStats(a: StatBlock, fn: (v: number, k: StatKey) => number): StatBlock {
  const out = emptyStats();
  for (const k of STAT_KEYS) out[k] = fn(a[k] ?? 0, k);
  return out;
}
