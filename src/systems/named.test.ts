import { describe, expect, it } from 'vitest';
import { createBus } from '../core/events';
import { createRng } from '../core/rng';
import { DROPS, DROP_TIER_WEIGHTS } from '../balance/loot';
import { recordNamed } from '../enemies/named';
import { SETS_BY_ID } from '../items/sets';
import { defaultPlan, newCampaign, planetDef, type PriorityId } from '../world/campaign';
import { createRun, type RunState } from '../world/run';
import { bindLoot, dropLoot, dropNamedItem, rollDropColumn, rollPermission } from './loot';

const planned = (seed: number, planet: number, priority: PriorityId = 'normalny'): RunState =>
  createRun(seed, { plan: { ...defaultPlan(newCampaign(), priority, seed), planet }, pageCount: 5 });

const allItems = (s: RunState) => [...s.pickups.flatMap((k) => (k.item ? [k.item] : [])), ...(s.player.awizos ?? []).map((a) => a.item)];

describe('the zestaw column (ITEMS 6.1)', () => {
  it('the rows are 75/22/3/0/0, 35/45/17/2/1 and 0/55/40/4/1 and sum to 100', () => {
    expect(DROP_TIER_WEIGHTS.common).toEqual([75, 22, 3, 0, 0]);
    expect(DROP_TIER_WEIGHTS.elite).toEqual([35, 45, 17, 2, 1]);
    expect(DROP_TIER_WEIGHTS.named).toEqual([0, 55, 40, 4, 1]);
    for (const w of Object.values(DROP_TIER_WEIGHTS)) expect(w.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('rolls zestaw 2% of an elite\'s drops and 4% of a named elite\'s', () => {
    const rng = createRng(3);
    const share = (w: readonly number[]): number => Array.from({ length: 40000 }, () => rollDropColumn(rng, w, 'normalny')).filter((c) => c === 'zestaw').length / 40000;
    expect(share(DROP_TIER_WEIGHTS.elite)).toBeCloseTo(0.02, 2);
    expect(share(DROP_TIER_WEIGHTS.named)).toBeCloseTo(0.04, 2);
    expect(share(DROP_TIER_WEIGHTS.common)).toBe(0);
  });

  it('the piece is of the planet\'s hosted set; where none is hosted that share rolls rzadki', () => {
    const hosted = planned(4, 1);
    expect(planetDef(1).hostedSet).toBe('obieg');
    for (let i = 0; i < 3000; i++) {
      hosted.pageIndex = i % 5;
      dropLoot(hosted, 0, 0, 'elite');
    }
    const pieces = allItems(hosted).filter((i) => i.setId);
    expect(pieces.length).toBeGreaterThan(30);
    for (const p of pieces) {
      expect(p.setId).toBe('obieg');
      expect(p.tier).toBe('rzadki');
      expect(SETS_BY_ID.get('obieg')?.pieces.some((x) => x.baseId === p.baseId)).toBe(true);
    }
    const bare = planned(5, 0);
    for (let i = 0; i < 3000; i++) {
      bare.pageIndex = i % 5;
      dropLoot(bare, 0, 0, 'elite');
    }
    expect(allItems(bare).some((i) => i.setId)).toBe(false);
  });

  it('every zestaw piece of an elite arrives through przesyłka while the page is free', () => {
    const s = planned(6, 1);
    for (let page = 0; page < 5; page++) {
      s.pageIndex = page;
      for (let i = 0; i < 200; i++) dropLoot(s, 0, 0, 'elite');
    }
    expect((s.player.awizos ?? []).length).toBe(5); // one per page
    expect(s.player.awizos?.every((a) => a.item.setId !== undefined || a.item.uniqueId !== undefined || a.item.tier === 'rzadki')).toBe(true);
  });
});

describe('the named rank (ITEMS 6.3, 6.5)', () => {
  it('gives 12-18 gwiazdki, always', () => {
    expect(DROPS.named.starMin).toBe(12);
    expect(DROPS.named.starMax).toBe(18);
    const s = planned(7, 0);
    for (let i = 0; i < 60; i++) {
      s.pickups.length = 0;
      dropLoot(s, 0, 0, 'named');
      const stars = s.pickups.filter((k) => !k.item && k.gwiazdki).map((k) => k.gwiazdki ?? 0);
      expect(stars).toHaveLength(1);
      expect(stars[0]).toBeGreaterThanOrEqual(12);
      expect(stars[0]).toBeLessThanOrEqual(18);
    }
  });

  it('the family\'s permission card every time the hero does not hold it, and none when held', () => {
    const s = planned(8, 0);
    for (let i = 0; i < 50; i++) expect(rollPermission(s, 'named', 'urzadzenia')).toBe('urzadzenia');
    s.player.permissions.push('urzadzenia');
    expect(rollPermission(s, 'named', 'urzadzenia')).toBeNull();
    expect(rollPermission(s, 'named', undefined)).toBeNull();
  });

  it('a named elite\'s death pays 12-18 stars, its item and the extra one, and the card; a plain elite pays 5-8', () => {
    for (const named of [true, false]) {
      const s = planned(9, 0);
      const bus = createBus();
      bindLoot(bus, () => s);
      if (named) recordNamed(s, { id: 7, name: 'x', affixes: ['pilny', 'poufny'], family: 'urzadzenia', claimed: false });
      bus.emit('enemy:died', { id: 7, x: 0, y: 0, tier: 'elite', family: 'urzadzenia' });
      const stars = s.pickups.find((k) => !k.item && k.gwiazdki && !k.permission)?.gwiazdki ?? 0;
      expect(stars).toBeGreaterThanOrEqual(named ? 12 : 5);
      expect(stars).toBeLessThanOrEqual(named ? 18 : 8);
      expect(s.pickups.some((k) => k.permission === 'urzadzenia')).toBe(named);
      expect(allItems(s).length).toBe(named ? 2 : 1);
    }
  });

  it('its extra item is nietypowy or better; zestaw in the fourth column', () => {
    const s = planned(10, 1);
    for (let page = 0; page < 5; page++) {
      s.pageIndex = page;
      for (let i = 0; i < 400; i++) dropNamedItem(s, 0, 0, 'nietypowy');
    }
    const items = allItems(s);
    expect(items.every((i) => i.tier !== 'zwykly')).toBe(true);
    const zestaw = items.filter((i) => i.setId).length / items.length;
    expect(zestaw).toBeGreaterThan(0.02);
    expect(zestaw).toBeLessThan(0.07);
  });
});
