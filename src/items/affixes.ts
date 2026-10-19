import type { Gender, GenderForms } from '../i18n';
import { t } from '../i18n';
import type { Slot, StatBlock } from './types';

/** Families (ITEMS 3.3): one stat or a fixed pair. An item carries at most one affix of a family. */
export type AffixFamily =
  | 'sila'
  | 'pewnosc'
  | 'racja'
  | 'upor'
  | 'trafienie'
  | 'odpMech'
  | 'odpReg'
  | 'odpEgz'
  | 'zasieg'
  | 'tempo'
  | 'gwiazdki'
  | 'proba'
  | 'absurd'
  | 'rare'
  | 'unwanted';

/** The six affixes that carry a mechanic beyond the stat (mechanics in items/absurd.ts). */
export type AbsurdKind = 'ewentualny' | 'sponsorowany' | 'domniemany' | 'probny' | 'rzekomy' | 'wycofany';

export interface Affix {
  id: string;
  family: AffixFamily;
  /** 1 can appear on every tier, 2 from nietypowy, 3 from rzadki. */
  grade: 1 | 2 | 3;
  /** Added to the item's stats at tier I (scaled by the magnitude tier, see tiers.ts). */
  effect: Partial<StatBlock>;
  /** Replaces `effect` on the listed slots (wycofany z obiegu: damage or a resist by slot). */
  effectBySlot?: Partial<Record<Slot, Partial<StatBlock>>>;
  /** Selection weight among the random affixes. */
  weight: number;
  /** Only on these slots (all when absent). */
  slots?: readonly Slot[];
  /** The rare affix: free version with ads (DESIGN section 7). */
  free?: boolean;
  /** Comic downside installed by the "Wymagana aktualizacja" clause. */
  unwanted?: boolean;
  /** Goes after the adjectives ("w wersji darmowej"). Counts as the one phrase an item may carry. */
  phrase?: boolean;
  /** Absurd mechanic, if any. */
  absurd?: AbsurdKind;
  /** The affix has a model token «…» (items.model.<id>); phrases never do. */
  model?: boolean;
}

const WEAPONISH: readonly Slot[] = ['bron', 'przyrzad'];
const BODY: readonly Slot[] = ['nakrycie', 'odziez'];

/** Forms live in i18n: items.affix.<id>.{m,f,n,pl}; the model token in items.model.<id>. 32 affixes, ITEMS 3.3. */
export const AFFIXES: readonly Affix[] = [
  // sila
  { id: 'poleasingowy', family: 'sila', grade: 1, effect: { dmgMin: 1, dmgMax: 2 }, weight: 8, slots: WEAPONISH, model: true },
  { id: 'sluzbowy', family: 'sila', grade: 2, effect: { dmgMin: 1, dmgMax: 3 }, weight: 7, slots: ['bron'], model: true },
  { id: 'nieuchronny', family: 'sila', grade: 2, effect: { dmgMax: 4 }, weight: 7, slots: WEAPONISH, model: true },
  { id: 'markowy', family: 'sila', grade: 3, effect: { dmgMin: 3, dmgMax: 5 }, weight: 6, slots: WEAPONISH, model: true },
  // pewnosc
  { id: 'zweryfikowany', family: 'pewnosc', grade: 1, effect: { pewnosc: 10 }, weight: 10, model: true },
  { id: 'ewentualny', family: 'pewnosc', grade: 2, effect: { pewnosc: 16 }, weight: 6, absurd: 'ewentualny', model: true },
  { id: 'oryginalny', family: 'pewnosc', grade: 3, effect: { pewnosc: 12, upor: 8 }, weight: 6, model: true },
  // racja
  { id: 'odnowiony', family: 'racja', grade: 1, effect: { racja: 8 }, weight: 10, model: true },
  { id: 'zapasowy', family: 'racja', grade: 2, effect: { racja: 10, upor: 3 }, weight: 7, slots: ['nakrycie', 'odziez', 'dokument'], model: true },
  { id: 'fabrycznienowy', family: 'racja', grade: 3, effect: { racja: 22 }, weight: 5, model: true },
  // upor
  { id: 'gwarancyjny', family: 'upor', grade: 1, effect: { upor: 6 }, weight: 10, model: true },
  { id: 'przemyslowy', family: 'upor', grade: 2, effect: { upor: 10 }, weight: 7, slots: BODY, model: true },
  { id: 'certyfikowany', family: 'upor', grade: 3, effect: { upor: 12, racja: 10 }, weight: 6, model: true },
  // trafienie
  { id: 'kolekcjonerski', family: 'trafienie', grade: 2, effect: { crit: 4 }, weight: 7, slots: ['przyrzad', 'dokument'], model: true },
  { id: 'sponsorowany', family: 'trafienie', grade: 2, effect: { crit: 3 }, weight: 6, absurd: 'sponsorowany', model: true },
  { id: 'limitowany', family: 'trafienie', grade: 3, effect: { crit: 6 }, weight: 5, model: true },
  // odporności
  { id: 'uzywany', family: 'odpMech', grade: 1, effect: { resMechaniczny: 6 }, weight: 8, model: true },
  { id: 'wzmocniony', family: 'odpMech', grade: 2, effect: { resMechaniczny: 6, racja: 6 }, weight: 8, model: true },
  { id: 'antywstrzasowy', family: 'odpMech', grade: 3, effect: { resMechaniczny: 14 }, weight: 5, slots: BODY, model: true },
  { id: 'podpisany', family: 'odpReg', grade: 1, effect: { resRegulaminowy: 5 }, weight: 8, slots: ['dokument'], model: true },
  { id: 'zgodny', family: 'odpReg', grade: 2, effect: { resRegulaminowy: 9 }, weight: 8, model: true },
  { id: 'zatwierdzony', family: 'odpReg', grade: 3, effect: { resRegulaminowy: 14, pewnosc: 4 }, weight: 5, slots: ['dokument', 'nakrycie'], model: true },
  { id: 'domniemany', family: 'odpEgz', grade: 2, effect: { resEgzystencjalny: 9 }, weight: 6, absurd: 'domniemany', model: true },
  { id: 'udokumentowany', family: 'odpEgz', grade: 3, effect: { resEgzystencjalny: 14 }, weight: 5, slots: ['dokument', 'nakrycie'], model: true },
  // one-stat families of the new tier
  { id: 'dalekosiezny', family: 'zasieg', grade: 2, effect: { zasieg: 15 }, weight: 6, slots: ['bron'], model: true },
  { id: 'serwisowy', family: 'tempo', grade: 1, effect: { tempo: -6 }, weight: 7, slots: WEAPONISH, model: true },
  { id: 'oceniany', family: 'gwiazdki', grade: 1, effect: { gwiazdki: 12 }, weight: 7, slots: ['przyrzad', 'dokument'], model: true },
  { id: 'testowany', family: 'proba', grade: 1, effect: { proba: -30 }, weight: 7, model: true },
  // absurd
  { id: 'probny', family: 'absurd', grade: 2, effect: {}, weight: 5, phrase: true, absurd: 'probny' },
  { id: 'rzekomy', family: 'absurd', grade: 2, effect: { pewnosc: 12, crit: 2 }, weight: 5, absurd: 'rzekomy', model: true },
  {
    id: 'wycofany',
    family: 'absurd',
    grade: 3,
    effect: { dmgMin: 2, dmgMax: 4 },
    effectBySlot: {
      nakrycie: { resMechaniczny: 8 },
      odziez: { resMechaniczny: 8 },
      dokument: { resRegulaminowy: 8 },
    },
    weight: 4,
    phrase: true,
    absurd: 'wycofany',
  },
  // The rare one. Strong claimed numbers; after the trial -40% and ads (see items/ads.ts).
  { id: 'darmowy', family: 'rare', grade: 3, effect: { dmgMin: 2, dmgMax: 4, pewnosc: 14, crit: 3 }, weight: 0, free: true, phrase: true },
];

/** Minor downsides for the "Wymagana aktualizacja" clause: pick one at random, add it, footnote "Nowość!". */
export const UNWANTED_FEATURES: readonly Affix[] = [
  { id: 'asystent', grade: 1, effect: { pewnosc: -6 }, family: 'unwanted', weight: 1, unwanted: true, phrase: true },
  { id: 'powiadomienia', grade: 1, effect: { upor: -4 }, family: 'unwanted', weight: 1, unwanted: true, phrase: true },
  { id: 'ciasteczka', grade: 1, effect: { racja: -6 }, family: 'unwanted', weight: 1, unwanted: true, phrase: true },
  { id: 'konto', grade: 1, effect: { dmgMin: -1 }, family: 'unwanted', weight: 1, unwanted: true, phrase: true },
  { id: 'inteligentny', grade: 1, effect: { pewnosc: -8 }, family: 'unwanted', weight: 1, unwanted: true },
  { id: 'chmura', grade: 1, effect: { upor: -3, racja: -3 }, family: 'unwanted', weight: 1, unwanted: true },
  { id: 'spersonalizowany', grade: 1, effect: { resMechaniczny: -6 }, family: 'unwanted', weight: 1, unwanted: true },
  { id: 'ciemny', grade: 1, effect: { crit: -2 }, family: 'unwanted', weight: 1, unwanted: true, phrase: true },
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

/** The effect of an affix on a slot (wycofany z obiegu differs by slot). */
export const effectFor = (a: Affix, slot: Slot): Partial<StatBlock> => a.effectBySlot?.[slot] ?? a.effect;

/** The model token «…» of an affix; empty for a phrase. */
export const modelToken = (id: string): string => t(`items.model.${id}`);

const RESIST_FAMILIES: readonly AffixFamily[] = ['odpMech', 'odpReg', 'odpEgz'];

/**
 * Roll exclusions (ITEMS 3.4) for adding `next` to `chosen`: one affix per family; at most two of
 * the three resist families; one absurd affix; one phrase; rzekomy and testowany exclude each other.
 * Sets are not rolled here, so "w wersji próbnej never on zestaw" holds by construction.
 */
export function canCombine(chosen: readonly Affix[], next: Affix): boolean {
  if (chosen.some((a) => a.family === next.family)) return false;
  if (RESIST_FAMILIES.includes(next.family) && chosen.filter((a) => RESIST_FAMILIES.includes(a.family)).length >= 2) return false;
  if (next.absurd && chosen.some((a) => a.absurd)) return false;
  if (next.phrase && chosen.some((a) => a.phrase && !a.unwanted)) return false;
  const ids = new Set(chosen.map((a) => a.id));
  if (next.id === 'rzekomy' && ids.has('testowany')) return false;
  if (next.id === 'testowany' && ids.has('rzekomy')) return false;
  return true;
}

/** The random pool for an item grade and slot, without what cannot sit next to `chosen`. */
export const randomAffixPool = (grade: number, slot: Slot, chosen: readonly Affix[] = []): Affix[] =>
  AFFIXES.filter(
    (a) => !a.free && a.weight > 0 && a.grade <= grade && (!a.slots || a.slots.includes(slot)) && canCombine(chosen, a),
  );
