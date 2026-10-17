import type { Gender, GenderForms } from '../i18n';
import { t } from '../i18n';
import type { Slot, StatBlock } from './types';

export interface Affix {
  id: string;
  /** 1 can appear on every tier, 2 from nietypowy, 3 from rzadki. */
  grade: 1 | 2 | 3;
  /** Added to the item's stats at level 1 (scaled with item level). */
  effect: Partial<StatBlock>;
  /** Selection weight among the random affixes. */
  weight: number;
  /** Only on these slots (all when absent). */
  slots?: readonly Slot[];
  /** The rare affix: free version with ads (DESIGN section 7). */
  free?: boolean;
  /** Comic downside installed by the "Wymagana aktualizacja" clause. */
  unwanted?: boolean;
  /** Same form for every gender, a prepositional phrase ("w wersji darmowej"): goes after the adjectives. */
  phrase?: boolean;
}

const WEAPONISH: readonly Slot[] = ['bron', 'przyrzad'];

/** Forms live in i18n: items.affix.<id>.{m,f,n,pl}. */
export const AFFIXES: readonly Affix[] = [
  { id: 'gwarancyjny', grade: 1, effect: { upor: 6 }, weight: 10 },
  { id: 'zweryfikowany', grade: 1, effect: { pewnosc: 10 }, weight: 10 },
  { id: 'odnowiony', grade: 1, effect: { racja: 8 }, weight: 10 },
  { id: 'poleasingowy', grade: 1, effect: { dmgMin: 1, dmgMax: 2 }, weight: 8, slots: WEAPONISH },
  { id: 'uzywany', grade: 1, effect: { resMechaniczny: 6 }, weight: 8 },
  { id: 'sponsorowany', grade: 2, effect: { crit: 3 }, weight: 8 },
  { id: 'nieuchronny', grade: 2, effect: { dmgMax: 4 }, weight: 7, slots: WEAPONISH },
  { id: 'domniemany', grade: 2, effect: { resEgzystencjalny: 9 }, weight: 8 },
  { id: 'ewentualny', grade: 2, effect: { pewnosc: 16 }, weight: 8 },
  { id: 'zgodny', grade: 2, effect: { resRegulaminowy: 9 }, weight: 8 },
  { id: 'wzmocniony', grade: 2, effect: { resMechaniczny: 6, racja: 6 }, weight: 8 },
  { id: 'certyfikowany', grade: 3, effect: { upor: 12, racja: 10 }, weight: 6 },
  { id: 'markowy', grade: 3, effect: { dmgMin: 3, dmgMax: 5 }, weight: 6, slots: WEAPONISH },
  { id: 'oryginalny', grade: 3, effect: { pewnosc: 12, upor: 8 }, weight: 6 },
  { id: 'limitowany', grade: 3, effect: { crit: 6 }, weight: 5 },
  { id: 'fabrycznienowy', grade: 3, effect: { racja: 22 }, weight: 5 },
  // The rare one. Strong claimed numbers; after the trial -40% and ads (see items/ads.ts).
  { id: 'darmowy', grade: 3, effect: { dmgMin: 2, dmgMax: 4, pewnosc: 14, crit: 3 }, weight: 0, free: true, phrase: true },
];

/** Minor downsides for the "Wymagana aktualizacja" clause: pick one at random, add it, footnote "Nowość!". */
export const UNWANTED_FEATURES: readonly Affix[] = [
  { id: 'asystent', grade: 1, effect: { pewnosc: -6 }, weight: 1, unwanted: true, phrase: true },
  { id: 'powiadomienia', grade: 1, effect: { upor: -4 }, weight: 1, unwanted: true, phrase: true },
  { id: 'ciasteczka', grade: 1, effect: { racja: -6 }, weight: 1, unwanted: true, phrase: true },
  { id: 'konto', grade: 1, effect: { dmgMin: -1 }, weight: 1, unwanted: true, phrase: true },
  { id: 'inteligentny', grade: 1, effect: { pewnosc: -8 }, weight: 1, unwanted: true },
  { id: 'chmura', grade: 1, effect: { upor: -3, racja: -3 }, weight: 1, unwanted: true },
  { id: 'spersonalizowany', grade: 1, effect: { resMechaniczny: -6 }, weight: 1, unwanted: true },
  { id: 'ciemny', grade: 1, effect: { crit: -2 }, weight: 1, unwanted: true, phrase: true },
];

export const AFFIXES_BY_ID: ReadonlyMap<string, Affix> = new Map([...AFFIXES, ...UNWANTED_FEATURES].map((a) => [a.id, a]));

export function affixForms(id: string): GenderForms {
  return {
    m: t(`items.affix.${id}.m`),
    f: t(`items.affix.${id}.f`),
    n: t(`items.affix.${id}.n`),
    pl: t(`items.affix.${id}.pl`),
  };
}

export function affixForm(id: string, gender: Gender): string {
  return t(`items.affix.${id}.${gender}`);
}

/** The "Nowość!" footnote for an unwanted feature. */
export function unwantedNote(id: string): string {
  return t(`items.unwanted.${id}`);
}

export const randomAffixPool = (grade: number, slot: Slot): Affix[] =>
  AFFIXES.filter((a) => !a.free && a.weight > 0 && a.grade <= grade && (!a.slots || a.slots.includes(slot)));
