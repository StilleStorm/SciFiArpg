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
}

/** Nouns and descriptions live in i18n: items.base.<id>.noun / .desc. */
export const BASES: readonly BaseItem[] = [
  // bron: two regulaminowy, two mechaniczny, one egzystencjalny
  { id: 'pieczatka', slot: 'bron', gender: 'f', drawing: 'pieczatka', stats: { dmgMin: 3, dmgMax: 6, pewnosc: 4 }, damageType: 'regulaminowy', range: 70, cooldownMul: 1.1, price: 5 },
  { id: 'odkurzacz', slot: 'bron', gender: 'm', drawing: 'odkurzacz', stats: { dmgMin: 4, dmgMax: 8 }, damageType: 'mechaniczny', range: 56, cooldownMul: 1.3, price: 5 },
  { id: 'wskaznik', slot: 'bron', gender: 'm', drawing: 'wskaznik', stats: { dmgMin: 2, dmgMax: 5, pewnosc: 6 }, damageType: 'egzystencjalny', range: 200, cooldownMul: 1.0, price: 6 },
  { id: 'kabel', slot: 'bron', gender: 'm', drawing: 'kabel', stats: { dmgMin: 3, dmgMax: 7 }, damageType: 'mechaniczny', range: 96, cooldownMul: 0.9, price: 5 },
  { id: 'czytnik', slot: 'bron', gender: 'm', drawing: 'czytnik', stats: { dmgMin: 2, dmgMax: 6, pewnosc: 10 }, damageType: 'regulaminowy', range: 160, cooldownMul: 0.85, price: 6 },
  // nakrycie glowy
  { id: 'kask', slot: 'nakrycie', gender: 'm', drawing: 'kask', stats: { upor: 8, racja: 4 }, price: 4 },
  { id: 'sluchawki', slot: 'nakrycie', gender: 'pl', drawing: 'sluchawki', stats: { resEgzystencjalny: 6, pewnosc: 4 }, price: 4 },
  { id: 'czapka', slot: 'nakrycie', gender: 'f', drawing: 'czapka', stats: { racja: 8, crit: 1 }, price: 3 },
  // odziez
  { id: 'kamizelka', slot: 'odziez', gender: 'f', drawing: 'kamizelka', stats: { upor: 6, racja: 12 }, price: 4 },
  { id: 'fartuch', slot: 'odziez', gender: 'm', drawing: 'fartuch', stats: { resMechaniczny: 6, upor: 6, racja: 6 }, price: 4 },
  { id: 'rekawiczki', slot: 'odziez', gender: 'pl', drawing: 'rekawiczki', stats: { pewnosc: 6, crit: 2, upor: 3 }, price: 4 },
  // przyrzad
  { id: 'ladowarka', slot: 'przyrzad', gender: 'f', drawing: 'ladowarka', stats: { racja: 10, crit: 1 }, price: 4 },
  { id: 'dongle', slot: 'przyrzad', gender: 'm', drawing: 'dongle', stats: { pewnosc: 10, resRegulaminowy: 4 }, price: 4 },
  { id: 'karta', slot: 'przyrzad', gender: 'f', drawing: 'karta', stats: { crit: 3, pewnosc: 4 }, price: 4 },
  { id: 'urzadzenie', slot: 'przyrzad', gender: 'n', drawing: 'urzadzenie', stats: { dmgMin: 1, dmgMax: 3, upor: 4 }, price: 4 },
  // dokument
  { id: 'regulamin', slot: 'dokument', gender: 'm', drawing: 'regulamin', stats: { resRegulaminowy: 10, upor: 4 }, price: 4 },
  { id: 'certyfikat', slot: 'dokument', gender: 'm', drawing: 'certyfikat', stats: { resEgzystencjalny: 8, pewnosc: 4 }, price: 4 },
  { id: 'zrzut', slot: 'dokument', gender: 'm', drawing: 'zrzut', stats: { resEgzystencjalny: 10, crit: 1 }, price: 4 },
  { id: 'zaswiadczenie', slot: 'dokument', gender: 'n', drawing: 'zaswiadczenie', stats: { resMechaniczny: 6, racja: 6 }, price: 4 },
];

export const BASES_BY_ID: ReadonlyMap<string, BaseItem> = new Map(BASES.map((b) => [b.id, b]));

export function basesForSlot(slot: Slot): BaseItem[] {
  return BASES.filter((b) => b.slot === slot);
}
