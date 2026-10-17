import { describe, expect, it } from 'vitest';
import { t } from '../i18n';
import { AFFIXES, AFFIXES_BY_ID, UNWANTED_FEATURES } from './affixes';
import { BASES, BASES_BY_ID } from './bases';
import { affixesOf, capitalize, nameItem } from './grammar';
import { UNIQUES } from './uniques';

const base = (id: string) => {
  const b = BASES_BY_ID.get(id);
  if (!b) throw new Error(id);
  return b;
};

describe('nameItem: adjective after the noun, agreement by gender', () => {
  it('feminine', () => {
    expect(nameItem(base('pieczatka'), affixesOf(['zweryfikowany']))).toBe('pieczątka serwisowa zweryfikowana');
  });
  it('masculine', () => {
    expect(nameItem(base('kask'), affixesOf(['odnowiony']))).toBe('kask kurierski odnowiony');
  });
  it('neuter', () => {
    expect(nameItem(base('urzadzenie'), affixesOf(['sponsorowany']))).toBe('urządzenie sponsorowane');
  });
  it('plural', () => {
    expect(nameItem(base('sluchawki'), affixesOf(['certyfikowany']))).toBe('słuchawki douszne certyfikowane');
  });
  it('no affixes gives the bare noun', () => {
    expect(nameItem(base('ladowarka'), [])).toBe('ładowarka');
  });
  it('several affixes: first after a space, the rest after commas, phrases last', () => {
    expect(nameItem(base('kask'), affixesOf(['darmowy', 'gwarancyjny', 'domniemany']))).toBe('kask kurierski gwarancyjny, domniemany, w wersji darmowej');
    expect(nameItem(base('pieczatka'), affixesOf(['fabrycznienowy', 'gwarancyjny']))).toBe('pieczątka serwisowa fabrycznie nowa, gwarancyjna');
    expect(nameItem(base('zaswiadczenie'), affixesOf(['zgodny', 'uzywany']))).toBe('zaświadczenie zgodne z regulaminem, używane');
  });
  it('phrases with a preposition do not change with gender', () => {
    for (const g of ['czytnik', 'ladowarka', 'urzadzenie', 'rekawiczki']) {
      expect(nameItem(base(g), affixesOf(['asystent'])).endsWith('z asystentem głosowym')).toBe(true);
    }
  });
  it('capitalizes for captions', () => {
    expect(capitalize('łódź')).toBe('Łódź');
  });
});

describe('item data', () => {
  it('has the required amounts', () => {
    expect(BASES.length).toBeGreaterThanOrEqual(14);
    expect(AFFIXES.length + UNWANTED_FEATURES.length).toBeGreaterThanOrEqual(18);
    expect(UNIQUES.length).toBeGreaterThanOrEqual(4);
  });
  it('covers all five slots and all four genders', () => {
    expect(new Set(BASES.map((b) => b.slot)).size).toBe(5);
    expect(new Set(BASES.map((b) => b.gender))).toEqual(new Set(['m', 'f', 'n', 'pl']));
  });
  it('has at least one weapon per damage type', () => {
    const types = new Set(BASES.filter((b) => b.slot === 'bron').map((b) => b.damageType));
    expect(types).toEqual(new Set(['mechaniczny', 'regulaminowy', 'egzystencjalny']));
    for (const w of BASES.filter((b) => b.slot === 'bron')) expect(w.range).toBeGreaterThan(0);
  });
  it('has every string it refers to', () => {
    for (const b of BASES) {
      expect(t(`items.base.${b.id}.noun`)).not.toContain('items.');
      expect(t(`items.base.${b.id}.desc`)).not.toContain('items.');
    }
    for (const a of AFFIXES_BY_ID.values()) {
      for (const g of ['m', 'f', 'n', 'pl']) expect(t(`items.affix.${a.id}.${g}`)).not.toContain('items.');
    }
    for (const a of UNWANTED_FEATURES) expect(t(`items.unwanted.${a.id}`)).not.toContain('items.');
  });
  it('has a rare free-version affix and a story for every unique', () => {
    expect(AFFIXES.some((a) => a.free)).toBe(true);
    for (const u of UNIQUES) {
      for (const k of ['name', 'desc', 'story', 'note']) expect(t(`items.unique.${u.id}.${k}`)).not.toContain('items.');
      const sentences = t(`items.unique.${u.id}.story`).split('. ').length;
      expect(sentences).toBeGreaterThanOrEqual(2);
      expect(sentences).toBeLessThanOrEqual(4);
    }
  });
  it('uses no exclamation marks outside advertisements and the Nowość notes', () => {
    for (const b of BASES) expect(t(`items.base.${b.id}.desc`)).not.toContain('!');
  });
});
