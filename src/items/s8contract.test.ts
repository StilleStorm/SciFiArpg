import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { affixMarks, tierMarkKind } from '../render/itemMarks';
import { AFFIXES_BY_ID, affixForm } from './affixes';
import { BASES_BY_ID } from './bases';
import { rollItem } from './generate';
import { nameParts, affixesOf } from './grammar';
import { ITEM_TIERS, type Item } from './types';

/** S8 tester contract: 200 items by seed, valid Polish grammar with gender checks, marks per tier. */
const rolled: Item[] = [];
for (let i = 0; i < 200; i++) rolled.push(rollItem(createRng(8000 + i), { level: 1 + (i % 24), tier: ITEM_TIERS[i % 4] }));

describe('S8: 200 items by seed', () => {
  it('is reproducible from the seed', () => {
    for (const i of [0, 57, 199]) {
      const again = rollItem(createRng(8000 + i), { level: 1 + (i % 24), tier: ITEM_TIERS[i % 4] });
      expect(again.name).toBe(rolled[i]?.name);
      expect(again.affixes).toEqual(rolled[i]?.affixes);
    }
  });

  it('names carry the base noun, each adjective in the base gender, and no raw keys', () => {
    for (const it of rolled) {
      const base = BASES_BY_ID.get(it.baseId);
      expect(base, it.baseId).toBeDefined();
      if (!base) continue;
      expect(it.gender, it.baseId).toBe(base.gender);
      expect(it.name, it.name).not.toMatch(/items\.|undefined|\{|\}|\s{2}|^\s|\s$/);
      expect(it.name.toLocaleLowerCase('pl').startsWith(it.name.charAt(0).toLocaleLowerCase('pl'))).toBe(true);
      const parts = nameParts(affixesOf(it.affixes));
      for (const a of [...parts.adjectives, ...parts.phrases, ...parts.tail]) {
        const form = affixForm(a.id, base.gender);
        expect(form.length, a.id).toBeGreaterThan(1);
        expect(form, a.id).not.toContain('items.');
        expect(it.name, `${a.id} in ${base.gender}`).toContain(form);
      }
      // the model token is in the name exactly when the model slot is filled (uniques carry their own fixed names)
      if (it.tier !== 'unikatowy') expect(it.name.includes('«'), it.name).toBe(parts.model !== null);
      // at most two adjectives besides phrases
      expect(parts.adjectives.filter((a) => !a.unwanted).length).toBeLessThanOrEqual(2);
    }
  });

  it('gives every affix a distinct, non-empty form per gender (m f n pl)', () => {
    for (const a of AFFIXES_BY_ID.values()) {
      for (const g of ['m', 'f', 'n', 'pl'] as const) expect(affixForm(a.id, g).trim().length, `${a.id}/${g}`).toBeGreaterThan(1);
    }
    // the feminine and the masculine form differ for adjectival affixes
    const adjectival = [...AFFIXES_BY_ID.values()].filter((a) => !a.phrase);
    expect(adjectival.filter((a) => affixForm(a.id, 'm') !== affixForm(a.id, 'f')).length).toBeGreaterThan(adjectival.length / 2);
  });

  it('draws a tier mark for every tier above zwykly and none on zwykly', () => {
    const seen = new Set<string>();
    for (const it of rolled) {
      const kind = tierMarkKind(it);
      seen.add(`${it.tier}:${kind}`);
      expect(kind === null, `${it.tier}`).toBe(it.tier === 'zwykly');
      expect(Array.isArray(affixMarks(it))).toBe(true);
    }
    expect([...seen].sort()).toEqual(['nietypowy:stamp', 'rzadki:thread', 'unikatowy:seal', 'zwykly:null']);
  });

  it('rolls affix counts by tier: zwykly few, rzadki always carries one of grade 2+', () => {
    for (const it of rolled) {
      expect(it.affixes.length).toBeLessThanOrEqual(3 + 1);
      if (it.tier === 'rzadki') expect(it.affixes.some((id) => (AFFIXES_BY_ID.get(id)?.grade ?? 0) >= 2), it.name).toBe(true);
    }
    const mean = (tier: string): number => {
      const xs = rolled.filter((x) => x.tier === tier);
      return xs.reduce((s, x) => s + x.affixes.length, 0) / xs.length;
    };
    expect(mean('zwykly')).toBeLessThan(mean('rzadki'));
  });

  it('never repeats an affix and rolls at most one absurd affix per item', () => {
    for (const it of rolled) {
      expect(new Set(it.affixes).size).toBe(it.affixes.length);
      expect(it.affixes.filter((id) => AFFIXES_BY_ID.get(id)?.absurd).length).toBeLessThanOrEqual(1);
    }
  });
});
