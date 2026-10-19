import type { DamageType } from '../combat/damage';
import type { Gender } from '../i18n';
import type { Slot, StatBlock } from './types';

export interface BaseItem {
  id: string;
  slot: Slot;
  gender: Gender;
  /** Id in render/itemDrawings.ts. */
  drawing: string;
  /** Stats at level 1, tier zwykly. */
  stats: Partial<StatBlock>;
  /** Value in gwiazdki at level 1, tier zwykly. */
  price: number;
  /** Weapons only. */
  damageType?: DamageType;
  range?: number;
  /** Multiplies the hero's attack cooldown. */
  cooldownMul?: number;
  /**
   * Odd percentage stats of ITEMS 2.4/2.5. Not scaled by level or tier: `oddStats` turns them into the
   * StatBlock keys tempo, gwiazdki and proba (trial speed +30% = proba -30), which items/generate.ts adds as is.
   */
  odd?: { tempoPct?: number; gwiazdkiPct?: number; trialSpeedPct?: number };
  /**
   * Affixes never rolled on this base because their adjective repeats a word of the noun
   * ("pieczątka serwisowa serwisowa"). bases.test.ts finds every such echo the slots allow and asks for it here.
   */
  excludeAffixes?: readonly string[];
}

/** A base's odd percentages as StatBlock keys (tempo -% cooldown, gwiazdki +%, proba -% trial kills). */
export function oddStats(base: Pick<BaseItem, 'odd'>): Partial<StatBlock> {
  const o = base.odd;
  if (!o) return {};
  return { tempo: o.tempoPct ?? 0, gwiazdki: o.gwiazdkiPct ?? 0, proba: -(o.trialSpeedPct ?? 0) };
}

/** Nouns and descriptions live in i18n: items.base.<id>.noun / .desc. */
export const BASES: readonly BaseItem[] = [
  // 40 bases, eight per slot (ITEMS 2); bron: three mechaniczny, three regulaminowy, two egzystencjalny
  { id: 'pieczatka', slot: 'bron', gender: 'f', drawing: 'pieczatka', stats: { dmgMin: 3, dmgMax: 6, pewnosc: 4 }, damageType: 'regulaminowy', range: 70, cooldownMul: 1.1, price: 5 },
  { id: 'odkurzacz', slot: 'bron', gender: 'm', drawing: 'odkurzacz', stats: { dmgMin: 4, dmgMax: 8 }, damageType: 'mechaniczny', range: 56, cooldownMul: 1.3, price: 5 },
  { id: 'wskaznik', slot: 'bron', gender: 'm', drawing: 'wskaznik', stats: { dmgMin: 2, dmgMax: 5, pewnosc: 6 }, damageType: 'egzystencjalny', range: 200, cooldownMul: 1.0, price: 6 },
  { id: 'kabel', slot: 'bron', gender: 'm', drawing: 'kabel', stats: { dmgMin: 3, dmgMax: 7 }, damageType: 'mechaniczny', range: 96, cooldownMul: 0.9, price: 5 },
  { id: 'czytnik', slot: 'bron', gender: 'm', drawing: 'czytnik', stats: { dmgMin: 2, dmgMax: 6, pewnosc: 10 }, damageType: 'regulaminowy', range: 160, cooldownMul: 0.85, price: 6 },
  { id: 'zszywacz', slot: 'bron', gender: 'm', drawing: 'zszywacz', stats: { dmgMin: 3, dmgMax: 6, pewnosc: 2 }, damageType: 'mechaniczny', range: 140, cooldownMul: 1.0, price: 5 },
  { id: 'segregator', slot: 'bron', gender: 'm', drawing: 'segregator', stats: { dmgMin: 3, dmgMax: 7 }, damageType: 'regulaminowy', range: 110, cooldownMul: 1.2, price: 5 },
  { id: 'lupa', slot: 'bron', gender: 'f', drawing: 'lupa', stats: { dmgMin: 2, dmgMax: 5, pewnosc: 4 }, damageType: 'egzystencjalny', range: 60, cooldownMul: 0.8, price: 5 },
  // nakrycie glowy
  { id: 'kask', slot: 'nakrycie', gender: 'm', drawing: 'kask', stats: { upor: 8, racja: 4 }, price: 4 },
  { id: 'sluchawki', slot: 'nakrycie', gender: 'pl', drawing: 'sluchawki', stats: { resEgzystencjalny: 6, pewnosc: 4 }, price: 4 },
  { id: 'czapka', slot: 'nakrycie', gender: 'f', drawing: 'czapka', stats: { racja: 8, crit: 1 }, price: 3 },
  { id: 'okulary', slot: 'nakrycie', gender: 'pl', drawing: 'okulary', stats: { pewnosc: 6, resMechaniczny: 4 }, price: 4 },
  { id: 'daszek', slot: 'nakrycie', gender: 'm', drawing: 'daszek', stats: { crit: 3, pewnosc: 2 }, price: 3 },
  { id: 'opaska', slot: 'nakrycie', gender: 'f', drawing: 'opaska', stats: { pewnosc: 8 }, price: 3 },
  { id: 'kaptur', slot: 'nakrycie', gender: 'm', drawing: 'kaptur', stats: { resEgzystencjalny: 8, racja: 4 }, price: 4 },
  { id: 'czepek', slot: 'nakrycie', gender: 'm', drawing: 'czepek', stats: { upor: 4, resRegulaminowy: 6 }, price: 3 },
  // odziez
  { id: 'kamizelka', slot: 'odziez', gender: 'f', drawing: 'kamizelka', stats: { upor: 6, racja: 12 }, price: 4 },
  { id: 'fartuch', slot: 'odziez', gender: 'm', drawing: 'fartuch', stats: { resMechaniczny: 6, upor: 6, racja: 6 }, price: 4 },
  { id: 'rekawiczki', slot: 'odziez', gender: 'pl', drawing: 'rekawiczki', stats: { pewnosc: 6, crit: 2, upor: 3 }, price: 4 },
  { id: 'plaszcz', slot: 'odziez', gender: 'm', drawing: 'plaszcz', stats: { racja: 16, resEgzystencjalny: 4 }, price: 5 },
  { id: 'koszulka', slot: 'odziez', gender: 'f', drawing: 'koszulka', stats: { crit: 2, racja: 8, pewnosc: 4 }, price: 4 },
  { id: 'kombinezon', slot: 'odziez', gender: 'm', drawing: 'kombinezon', stats: { upor: 10, racja: 10 }, price: 5 },
  { id: 'szelki', slot: 'odziez', gender: 'pl', drawing: 'szelki', stats: { upor: 4, racja: 6, resRegulaminowy: 4 }, price: 4 },
  { id: 'marynarka', slot: 'odziez', gender: 'f', drawing: 'marynarka', stats: { pewnosc: 8, resRegulaminowy: 6 }, price: 5 },
  // przyrzad
  { id: 'ladowarka', slot: 'przyrzad', gender: 'f', drawing: 'ladowarka', stats: { racja: 10, crit: 1 }, price: 4 },
  { id: 'dongle', slot: 'przyrzad', gender: 'm', drawing: 'dongle', stats: { pewnosc: 10, resRegulaminowy: 4 }, price: 4 },
  { id: 'karta', slot: 'przyrzad', gender: 'f', drawing: 'karta', stats: { crit: 3, pewnosc: 4 }, price: 4 },
  { id: 'urzadzenie', slot: 'przyrzad', gender: 'n', drawing: 'urzadzenie', stats: { dmgMin: 1, dmgMax: 3, upor: 4 }, price: 4 },
  { id: 'powerbank', slot: 'przyrzad', gender: 'm', drawing: 'powerbank', stats: { racja: 6, upor: 6 }, price: 4 },
  { id: 'pilot', slot: 'przyrzad', gender: 'm', drawing: 'pilot', stats: { pewnosc: 4 }, odd: { tempoPct: -5 }, price: 4 },
  { id: 'liczydlo', slot: 'przyrzad', gender: 'n', drawing: 'liczydlo', stats: { pewnosc: 4 }, odd: { gwiazdkiPct: 15 }, price: 5 },
  { id: 'zegarek', slot: 'przyrzad', gender: 'm', drawing: 'zegarek', stats: { crit: 1 }, odd: { trialSpeedPct: 30 }, price: 5 },
  // dokument
  { id: 'regulamin', slot: 'dokument', gender: 'm', drawing: 'regulamin', stats: { resRegulaminowy: 10, upor: 4 }, price: 4 },
  { id: 'certyfikat', slot: 'dokument', gender: 'm', drawing: 'certyfikat', stats: { resEgzystencjalny: 8, pewnosc: 4 }, price: 4 },
  { id: 'zrzut', slot: 'dokument', gender: 'm', drawing: 'zrzut', stats: { resEgzystencjalny: 10, crit: 1 }, price: 4 },
  { id: 'zaswiadczenie', slot: 'dokument', gender: 'n', drawing: 'zaswiadczenie', stats: { resMechaniczny: 6, racja: 6 }, price: 4 },
  { id: 'faktura', slot: 'dokument', gender: 'f', drawing: 'faktura', stats: { resRegulaminowy: 6 }, odd: { gwiazdkiPct: 10 }, price: 4 },
  { id: 'paragon', slot: 'dokument', gender: 'm', drawing: 'paragon', stats: { crit: 2, resMechaniczny: 6 }, price: 4 },
  { id: 'polisa', slot: 'dokument', gender: 'f', drawing: 'polisa', stats: { racja: 10, resMechaniczny: 6 }, price: 5 },
  { id: 'upowaznienie', slot: 'dokument', gender: 'n', drawing: 'upowaznienie', stats: { pewnosc: 6, resRegulaminowy: 8 }, price: 5 },
];

export const BASES_BY_ID: ReadonlyMap<string, BaseItem> = new Map(BASES.map((b) => [b.id, b]));

export function basesForSlot(slot: Slot): BaseItem[] {
  return BASES.filter((b) => b.slot === slot);
}
