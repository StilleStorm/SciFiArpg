import { t, type Gender } from '../i18n';
import { AFFIXES_BY_ID, affixForm, type Affix } from './affixes';
import type { BaseItem } from './bases';

export type Lang = 'pl';

/** Polish puts the adjective after the noun ("pieczątka serwisowa"). Per-language setting. */
export const ADJECTIVE_AFTER: Record<Lang, boolean> = { pl: true };

export function baseNoun(baseId: string): string {
  return t(`items.base.${baseId}.noun`);
}

/**
 * Join a head noun and affixes with agreement by gender.
 * Adjectives come first (first one after a space, the rest after commas, like a listing),
 * prepositional phrases ("w wersji darmowej") come last.
 */
export function joinName(head: string, gender: Gender, affixes: readonly Affix[], lang: Lang = 'pl'): string {
  void lang;
  const adjectives = affixes.filter((a) => !a.phrase).map((a) => affixForm(a.id, gender));
  const phrases = affixes.filter((a) => a.phrase).map((a) => affixForm(a.id, gender));
  const parts = [...adjectives, ...phrases];
  const [first, ...rest] = parts;
  if (first === undefined) return head;
  return `${head} ${first}${rest.map((p) => `, ${p}`).join('')}`;
}

/** Name of a generated item: base noun + affixes in the base's grammatical gender. */
export function nameItem(base: BaseItem, affixes: readonly Affix[], lang: Lang = 'pl'): string {
  return joinName(baseNoun(base.id), base.gender, affixes, lang);
}

export const capitalize = (s: string): string => (s ? s.charAt(0).toLocaleUpperCase('pl') + s.slice(1) : s);

export function affixesOf(ids: readonly string[]): Affix[] {
  const out: Affix[] = [];
  for (const id of ids) {
    const a = AFFIXES_BY_ID.get(id);
    if (a) out.push(a);
  }
  return out;
}
