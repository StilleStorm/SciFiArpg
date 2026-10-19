import type { DamageType } from '../combat/damage';
import type { Gender } from '../i18n';

export type Slot = 'bron' | 'nakrycie' | 'odziez' | 'przyrzad' | 'dokument';
export const SLOTS: readonly Slot[] = ['bron', 'nakrycie', 'odziez', 'przyrzad', 'dokument'];

export type ItemTier = 'zwykly' | 'nietypowy' | 'rzadki' | 'unikatowy';
export const ITEM_TIERS: readonly ItemTier[] = ['zwykly', 'nietypowy', 'rzadki', 'unikatowy'];

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
  /** S8: tier I-V of the affix magnitudes (ITEMS 3.2); absent on older items = I. */
  modTier?: 1 | 2 | 3 | 4 | 5;
  /** S8: stats without the +20% of "w wersji próbnej", restored when the trial period ends. */
  plain?: { claimed: StatBlock; actual: StatBlock };
  /** S8: runtime state of the absurd affixes (items/absurd.ts). */
  absurd?: { pagesWorn?: number; trialEnded?: boolean; ewentNominal?: number; ewentNow?: number };
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
