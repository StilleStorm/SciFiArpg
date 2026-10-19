import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { PRIORITY_IDS } from '../world/campaign';
import { rollItem } from './generate';
import { ILVL_CAP, LIE_MAGNITUDE, TIER_BASE_MUL, actualOverClaim, clampIlvl, ilvlFor, ilvlScale, listPrice, pageOffset, shopIlvl } from './level';
import { actualFrom } from './reviews';
import { emptyStats } from './types';

describe('item level (ITEMS 5.1)', () => {
  it('page offset runs 0..2 over the pages and ends on 2', () => {
    for (const count of [4, 5, 6]) {
      const offsets = Array.from({ length: count }, (_, i) => pageOffset(i, count));
      expect(offsets[0]).toBe(0);
      expect(offsets[count - 1]).toBe(2);
      expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);
    }
  });
  it('planet 1 Normalny drops 1-5, planet 5 Krytyczny up to 32', () => {
    const range = (planet: number, priority: (typeof PRIORITY_IDS)[number]): [number, number] => {
      const all: number[] = [];
      for (let pageIndex = 0; pageIndex < 5; pageIndex++) for (const boss of [false, true]) all.push(ilvlFor({ planet, priority, pageIndex, pageCount: 5, boss }));
      return [Math.min(...all), Math.max(...all)];
    };
    expect(range(0, 'normalny')[0]).toBe(1);
    expect(range(0, 'normalny')[1]).toBeLessThanOrEqual(5);
    expect(range(4, 'krytyczny')[1]).toBe(31); // 21 + page 2 + boss 2 + priority 6; ITEMS rounds to 32
    expect(range(7, 'krytyczny')[1]).toBe(40);
  });
  it('priority moves the level by -2, 0, 3, 6 and the cap holds', () => {
    const at = (p: (typeof PRIORITY_IDS)[number]): number => ilvlFor({ planet: 3, priority: p, pageIndex: 0, pageCount: 5 });
    expect(PRIORITY_IDS.map(at)).toEqual([14, 16, 19, 22]);
    expect(ilvlFor({ planet: 8, priority: 'krytyczny', pageIndex: 5, pageCount: 6, boss: true })).toBe(ILVL_CAP);
    expect(clampIlvl(-4)).toBe(1);
  });
  it('the Sklep stocks the planet band at offset 1', () => {
    expect([0, 1, 4, 8].map(shopIlvl)).toEqual([2, 7, 22, 40]);
  });
});

describe('budgets (ITEMS 5.2)', () => {
  it('stats scale 6% per level and tier multiplies the base', () => {
    expect(ilvlScale(1)).toBe(1);
    expect(ilvlScale(11)).toBeCloseTo(1.6);
    expect(TIER_BASE_MUL.nietypowy).toBe(1.1);
    expect(TIER_BASE_MUL.rzadki).toBe(1.2);
  });
  it('a rolled weapon grows with the item level, and higher tiers are not weaker', () => {
    const dmg = (level: number, tier: 'zwykly' | 'rzadki'): number => {
      let sum = 0;
      for (let i = 0; i < 60; i++) sum += rollItem(createRng(i + 1), { level, tier, slot: 'bron' }).claimed.dmgMax;
      return sum / 60;
    };
    expect(dmg(20, 'zwykly')).toBeGreaterThan(dmg(1, 'zwykly') * 1.5);
    expect(dmg(10, 'rzadki')).toBeGreaterThan(dmg(10, 'zwykly'));
  });
  it('prices follow price1 * (1 + 0.1 ilvl) * tier', () => {
    expect(listPrice(10, 10, 'zwykly')).toBe(20);
    expect(listPrice(10, 10, 'nietypowy')).toBe(50);
    expect(listPrice(10, 10, 'rzadki')).toBe(120);
  });
});

describe('lies by tier (ITEMS 5.3)', () => {
  it('magnitudes are 15/25/35 over and 10/15/20 under', () => {
    expect([LIE_MAGNITUDE.zwykly, LIE_MAGNITUDE.nietypowy, LIE_MAGNITUDE.rzadki].map((m) => m.bought)).toEqual([0.15, 0.25, 0.35]);
    expect([LIE_MAGNITUDE.zwykly, LIE_MAGNITUDE.nietypowy, LIE_MAGNITUDE.rzadki].map((m) => m.underrated)).toEqual([0.1, 0.15, 0.2]);
    expect(1 / actualOverClaim('rzadki', 'bought')).toBeCloseTo(1.35);
    expect(actualOverClaim('nietypowy', 'niedoceniony')).toBeCloseTo(1.15);
    expect(actualOverClaim('rzadki', 'honest')).toBe(1);
  });
  it('the actual stats of a liar are the claim divided by the tier magnitude, within noise', () => {
    const claimed = { ...emptyStats(), dmgMin: 100, dmgMax: 200 };
    for (const tier of ['zwykly', 'nietypowy', 'rzadki'] as const) {
      const rng = createRng(3);
      for (let i = 0; i < 40; i++) {
        const bought = actualFrom(rng, claimed, 'bought', tier);
        const ratio = bought.dmgMax / 200;
        const want = actualOverClaim(tier, 'bought');
        expect(ratio).toBeGreaterThan(want * 0.9);
        expect(ratio).toBeLessThan(want * 1.1);
        const under = actualFrom(rng, claimed, 'niedoceniony', tier).dmgMax / 200;
        expect(under).toBeGreaterThan(actualOverClaim(tier, 'niedoceniony') * 0.9);
        expect(under).toBeLessThan(actualOverClaim(tier, 'niedoceniony') * 1.1);
      }
    }
  });
});
