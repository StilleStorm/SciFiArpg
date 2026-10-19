import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { t } from '../i18n';
import { DRAWINGS } from '../render/itemDrawings';
import { affixMarks, groundMark, tierMarkKind } from '../render/itemMarks';
import { AFFIXES, affixForm, randomAffixPool, rollsOnSlot } from './affixes';
import { BASES, basesForSlot } from './bases';
import { rollItem } from './generate';
import { ITEM_TIERS, SLOTS } from './types';

describe('the 40 bases', () => {
  it('has eight per slot and unique ids', () => {
    expect(BASES).toHaveLength(40);
    for (const slot of SLOTS) expect(basesForSlot(slot)).toHaveLength(8);
    expect(new Set(BASES.map((b) => b.id)).size).toBe(40);
  });
  it('has a drawing, a noun and a description for each, and the genders of ITEMS 2', () => {
    for (const b of BASES) {
      expect(DRAWINGS[b.drawing], b.id).toBeDefined();
      expect(DRAWINGS[b.drawing]?.d.length).toBeGreaterThan(20);
      expect(t(`items.base.${b.id}.noun`)).not.toContain('items.');
      expect(t(`items.base.${b.id}.desc`)).not.toContain('items.');
    }
    const g = Object.fromEntries(BASES.map((b) => [b.id, b.gender]));
    expect(g).toMatchObject({ okulary: 'pl', szelki: 'pl', liczydlo: 'n', upowaznienie: 'n', lupa: 'f', zszywacz: 'm', polisa: 'f' });
  });
  it('gives weapons a range and all three damage types at least two bases each', () => {
    const w = BASES.filter((b) => b.slot === 'bron');
    for (const b of w) expect(b.range).toBeGreaterThan(0);
    for (const type of ['mechaniczny', 'regulaminowy', 'egzystencjalny']) expect(w.filter((b) => b.damageType === type).length).toBeGreaterThanOrEqual(2);
  });
});

describe('rolled items by seed', () => {
  it('names 200 items without raw keys or doubled spaces, and draws a mark for every tier above zwykly', () => {
    for (let i = 0; i < 200; i++) {
      const it = rollItem(createRng(500 + i), { level: 1 + (i % 9), tier: ITEM_TIERS[i % 4] });
      expect(it.name, `${it.baseId}`).not.toMatch(/items\.|\s{2}|undefined/);
      expect(it.name.length).toBeGreaterThan(3);
      expect(tierMarkKind(it) === null).toBe(it.tier === 'zwykly');
      expect(groundMark(it) === null || affixMarks(it).length > 0).toBe(true);
    }
  });
  it('maps tiers to the marks of ITEMS 9', () => {
    expect(tierMarkKind({ tier: 'nietypowy' })).toBe('stamp');
    expect(tierMarkKind({ tier: 'rzadki' })).toBe('thread');
    expect(tierMarkKind({ tier: 'unikatowy' })).toBe('seal');
    expect(tierMarkKind({ tier: 'rzadki', set: true })).toBe('clip');
  });
  it('orders affix marks absurd first and shows one on the ground', () => {
    const item = { tier: 'zwykly' as const, affixes: ['sponsorowany', 'domniemany', 'asystent'], freeVersion: true };
    expect(affixMarks(item)).toEqual(['dotted', 'reklama', 'free', 'nowosc']);
    expect(groundMark(item)).toBe('dotted');
  });
});

describe('per-base affix exclusions (an adjective that repeats the noun)', () => {
  const words = (s: string): string[] => s.toLocaleLowerCase('pl').split(/[\s\u00a0,]+/).filter((w) => w.length > 3);
  it('every echo of a noun word by an affix that can roll on the base is excluded on that base', () => {
    const missing: string[] = [];
    for (const b of BASES) {
      const noun = new Set(words(t(`items.base.${b.id}.noun`)));
      for (const a of AFFIXES) {
        if (a.free || !rollsOnSlot(a, b.slot)) continue;
        if (words(affixForm(a.id, b.gender)).some((w) => noun.has(w)) && !b.excludeAffixes?.includes(a.id)) missing.push(`${b.id}/${a.id}`);
      }
    }
    expect(missing).toEqual([]);
  });
  it('the random pool leaves out what the base excludes', () => {
    expect(randomAffixPool(3, 'bron').some((a) => a.id === 'sluzbowy')).toBe(true);
    expect(randomAffixPool(3, 'bron', [], ['sluzbowy']).some((a) => a.id === 'sluzbowy')).toBe(false);
  });
});
