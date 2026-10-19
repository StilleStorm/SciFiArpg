import { t, type Gender } from '../i18n';
import { AFFIXES_BY_ID, affixForm, modelToken, type Affix } from './affixes';
import type { BaseItem } from './bases';

export type Lang = 'pl';

/** Polish puts the adjective after the noun ("pieczątka serwisowa"). Per-language setting. */
export const ADJECTIVE_AFTER: Record<Lang, boolean> = { pl: true };

export function baseNoun(baseId: string): string {
  return t(`items.base.${baseId}.noun`);
}

export interface NameParts {
  adjectives: Affix[];
  phrases: Affix[];
  model: Affix | null;
  /** Unwanted features with a preposition: appended last. */
  tail: Affix[];
}

/**
 * Split affixes into the places of the name (ITEMS 3.1):
 * `{noun} {adj1} {adj2} {phrase}, model «Model»` and the unwanted feature last.
 * With three regular affixes the one of the highest grade (the later on a tie) that can be a
 * model goes to the model slot, because the register prints the model large. Fewer: no model.
 */
export function nameParts(affixes: readonly Affix[]): NameParts {
  const regular = affixes.filter((a) => !a.unwanted);
  let model: Affix | null = null;
  if (regular.length >= 3) {
    for (const a of regular) if (a.model && !a.phrase && (!model || a.grade >= model.grade)) model = a;
  }
  const rest = regular.filter((a) => a !== model);
  const unwanted = affixes.filter((a) => a.unwanted);
  return {
    adjectives: [...rest.filter((a) => !a.phrase), ...unwanted.filter((a) => !a.phrase)],
    phrases: rest.filter((a) => a.phrase),
    model,
    tail: unwanted.filter((a) => a.phrase),
  };
}

/**
 * Join a head noun and affixes with agreement by gender: adjectives after the noun, then the
 * phrase, then ", model «…»", then an unwanted feature phrase.
 */
export function joinName(head: string, gender: Gender, affixes: readonly Affix[], lang: Lang = 'pl'): string {
  void lang;
  const parts = nameParts(affixes);
  const form = (a: Affix): string => affixForm(a.id, gender);
  let out = [head, ...parts.adjectives.map(form), ...parts.phrases.map(form)].join(' ');
  if (parts.model) out += `, ${t('items.name.model', { model: modelToken(parts.model.id) })}`;
  if (parts.tail.length) out += ` ${parts.tail.map(form).join(' ')}`;
  return out;
}

/**
 * The register mark ("(III)") goes right after the model, before an unwanted feature phrase that the
 * name ends with ("…, model «Zasięg» (III) z asystentem głosowym"). No tail: at the end. Empty mark: the name.
 */
export function withRegisterMark(name: string, gender: Gender, affixIds: readonly string[], mark: string): string {
  if (!mark) return name;
  const tail = nameParts(affixesOf(affixIds)).tail.map((a) => affixForm(a.id, gender)).join(' ');
  if (tail && name.endsWith(` ${tail}`)) return `${name.slice(0, name.length - tail.length - 1)} ${mark} ${tail}`;
  return `${name} ${mark}`;
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
