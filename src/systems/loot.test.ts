import { describe, expect, it } from 'vitest';
import { createBus } from '../core/events';
import { INVENTORY_CAP } from '../items/inventory';
import { createRng } from '../core/rng';
import { ilvlFor } from '../items/level';
import { populatePage } from '../world/pageTurn';
import { defaultPlan, newCampaign, type PriorityId } from '../world/campaign';
import { createRun } from '../world/run';
import { DROPS, DROP_TIER_WEIGHTS, bindLoot, dropGuaranteed, dropLevel, dropLoot, dropPermission, rollDropTier, rollPermission, takePickup, updateLoot } from './loot';
import { POTWIERDZENIE_DROP } from './recovery';
import { recordNamed } from '../enemies/named';

describe('loot', () => {
  it('common kills drop an item about one time in eight, and stars 60% of the time', () => {
    const s = createRun(1);
    let items = 0;
    let stars = 0;
    const n = 3000;
    for (let i = 0; i < n; i++) {
      s.pickups.length = 0;
      dropLoot(s, 100, 100, 'common');
      if (s.pickups.some((k) => k.item)) items++;
      if (s.pickups.some((k) => k.gwiazdki)) stars++;
    }
    expect(items / n).toBeGreaterThan(DROPS.common.item - 0.04);
    expect(items / n).toBeLessThan(DROPS.common.item + 0.04);
    expect(stars / n).toBeGreaterThan(0.54);
    expect(stars / n).toBeLessThan(0.66);
  });
  it('bosses always drop three items and a pile of stars, and the first is rzadki or better', () => {
    const s = createRun(2);
    for (let i = 0; i < 50; i++) {
      s.pickups.length = 0;
      dropLoot(s, 0, 0, 'boss');
      const items = s.pickups.filter((k) => k.item);
      expect(items).toHaveLength(3);
      expect(['rzadki', 'unikatowy']).toContain(items[0]?.item?.tier);
      expect(s.pickups.some((k) => (k.gwiazdki ?? 0) >= 25)).toBe(true);
    }
  });
  it('drops are numbered from the run counter and reproducible from the seed', () => {
    const a = createRun(5);
    const b = createRun(5);
    for (let i = 0; i < 40; i++) {
      dropLoot(a, 1, 1, 'elite');
      dropLoot(b, 1, 1, 'elite');
    }
    expect(a.pickups.map((k) => k.item?.name)).toEqual(b.pickups.map((k) => k.item?.name));
    const numbers = a.pickups.filter((k) => k.item).map((k) => k.number);
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(a.pickups.find((k) => k.item)?.item?.number).toBe(a.pickups.find((k) => k.item)?.number);
  });
  it('the Parzystość clause doubles drops, the second a worse wariant', () => {
    const s = createRun(6);
    s.law.lootPairs = true;
    s.law.lootMul = 1;
    for (let i = 0; i < 30; i++) dropLoot(s, 0, 0, 'boss');
    const items = s.pickups.filter((k) => k.item).map((k) => k.item);
    expect(items.filter((i) => i?.variant).length).toBe(items.length / 2);
  });
  it('picking up puts the item in the inventory; a full inventory leaves it on the ground', () => {
    const s = createRun(7);
    const bus = createBus();
    const taken: number[] = [];
    const notes: string[] = [];
    bus.on('pickup:taken', (e) => taken.push(e.number));
    bus.on('footnote', (e) => notes.push(e.text));
    s.law.lootMul = 100;
    for (let i = 0; i < 60; i++) dropLoot(s, 0, 0, 'boss');
    const ground = s.pickups.filter((k) => k.item);
    let got = 0;
    for (const k of ground) if (takePickup(s, bus, k)) got++;
    expect(got).toBe(INVENTORY_CAP);
    expect(s.player.inventory).toHaveLength(INVENTORY_CAP);
    expect(taken).toHaveLength(INVENTORY_CAP);
    expect(notes.filter((n) => n.includes('pełne'))).toHaveLength(1);
    const star = createRun(8);
    dropLoot(star, 0, 0, 'boss');
    const sp = star.pickups.find((k) => k.gwiazdki);
    if (!sp) throw new Error('no star');
    expect(takePickup(star, bus, sp)).toBe(true);
    expect(star.player.gwiazdki).toBe(sp.gwiazdki);
  });
  it('a suspended player cannot pick things up', () => {
    const s = createRun(9);
    s.player.suspended = true;
    dropLoot(s, 0, 0, 'boss');
    const k = s.pickups[0];
    if (!k) throw new Error('none');
    expect(takePickup(s, createBus(), k)).toBe(false);
  });
  it('kills drive trials through the bus, and the tier on the event is read', () => {
    const s = createRun(10);
    const bus = createBus();
    bindLoot(bus, () => s);
    const notes: string[] = [];
    bus.on('footnote', (e) => notes.push(e.text));
    bus.emit('enemy:died', { id: 1, x: 5, y: 5, tier: 'boss' });
    expect(s.pickups.filter((k) => k.item)).toHaveLength(3);
    bus.emit('enemy:died', { id: 2, x: 5, y: 5 });
    updateLoot(s, bus, 1);
    expect(notes).toEqual([]);
  });
  it('a named elite leaves one extra item of nietypowy or better, once', () => {
    const plain = createRun(11);
    const named = createRun(11);
    recordNamed(named, { id: 7, name: 'x', affixes: ['pilny', 'poufny'], family: 'urzadzenia', claimed: false });
    for (const s of [plain, named]) {
      const bus = createBus();
      bindLoot(bus, () => s);
      bus.emit('enemy:died', { id: 7, x: 0, y: 0, tier: 'elite' });
      bus.emit('enemy:died', { id: 7, x: 0, y: 0, tier: 'elite' });
    }
    // S18: a zestaw piece, a unique or a rzadki of an elite may go by post (an awizo) instead of dropping, so the items are counted both ways
    const items = (s: typeof plain) => [...s.pickups.flatMap((k) => (k.item ? [k.item] : [])), ...(s.player.awizos ?? []).map((a) => a.item)];
    expect(items(named).length).toBe(items(plain).length + 1);
    expect(items(named).some((i) => i.tier !== 'zwykly')).toBe(true);
  });
});

describe('permission cards', () => {
  it('a boss always drops its family card, a common enemy never, an elite about one time in five', () => {
    const s = createRun(9);
    for (let i = 0; i < 20; i++) expect(rollPermission(s, 'boss', 'wygenerowane')).toBe('wygenerowane');
    for (let i = 0; i < 200; i++) expect(rollPermission(s, 'common', 'urzadzenia')).toBeNull();
    let n = 0;
    for (let i = 0; i < 3000; i++) if (rollPermission(s, 'elite', 'powiadomienia')) n++;
    expect(n / 3000).toBeGreaterThan(0.17);
    expect(n / 3000).toBeLessThan(0.23);
    s.player.permissions.push('powiadomienia');
    for (let i = 0; i < 300; i++) expect(rollPermission(s, 'elite', 'powiadomienia')).toBeNull();
  });
  it('taking the card grants the permission, footnotes it and never fills the inventory', () => {
    const s = createRun(9);
    const bus = createBus();
    const notes: string[] = [];
    bus.on('footnote', (e) => notes.push(e.text));
    const k = dropPermission(s, 10, 10, 'urzadzenia');
    expect(takePickup(s, bus, k)).toBe(true);
    expect(s.player.permissions).toEqual(['urzadzenia']);
    expect(s.player.inventory).toHaveLength(0);
    expect(notes).toHaveLength(1);
    takePickup(s, bus, k);
    expect(s.player.permissions).toEqual(['urzadzenia']);
  });
  it('dying bosses and elites put the card on the page through the bus', () => {
    const s = createRun(9);
    const bus = createBus();
    bindLoot(bus, () => s);
    bus.emit('enemy:died', { id: 99, x: 50, y: 50, tier: 'boss', family: 'powiadomienia' });
    expect(s.pickups.some((k) => k.permission === 'powiadomienia')).toBe(true);
  });
  it('the update form unlocks an entry once the permission is held', async () => {
    const { hasPermission } = await import('../progression/update');
    const s = createRun(9);
    expect(hasPermission(s, 'wygenerowane')).toBe(false);
    takePickup(s, createBus(), dropPermission(s, 1, 1, 'wygenerowane'));
    expect(hasPermission(s, 'wygenerowane')).toBe(true);
  });
});

const planned = (seed: number, planet: number, priority: PriorityId) => {
  const base = defaultPlan(newCampaign(), priority, seed);
  return createRun(seed, { plan: { ...base, planet } });
};

describe('drop tables (ITEMS 6.1, 6.2, 6.5)', () => {
  const share = (rolls: string[], tier: string): number => rolls.filter((t) => t === tier).length / rolls.length;
  it('tier weights come out as the table says for common and elite kills', () => {
    const rng = createRng(11);
    const n = 20000;
    const common = Array.from({ length: n }, () => rollDropTier(rng, DROP_TIER_WEIGHTS.common, 'normalny'));
    expect(share(common, 'zwykly')).toBeCloseTo(0.75, 1);
    expect(share(common, 'nietypowy')).toBeCloseTo(0.22, 1);
    expect(share(common, 'unikatowy')).toBe(0);
    const elite = Array.from({ length: n }, () => rollDropTier(rng, DROP_TIER_WEIGHTS.elite, 'normalny'));
    expect(share(elite, 'nietypowy')).toBeCloseTo(0.45, 1);
    expect(share(elite, 'rzadki')).toBeCloseTo(0.19, 1);
  });
  it('priority moves a share of rolls one column: Niski 20% left, Wysoki 10% and Krytyczny 25% right', () => {
    const n = 40000;
    const sh = (priority: PriorityId): number => {
      const rng = createRng(12);
      let z = 0;
      for (let i = 0; i < n; i++) if (rollDropTier(rng, DROP_TIER_WEIGHTS.common, priority) === 'zwykly') z++;
      return z / n;
    };
    // zwykły 75%: it loses a quarter of what moves right (nietypowy -> zwykły comes back from Niski).
    expect(sh('wysoki')).toBeCloseTo(0.75 * 0.9, 1);
    expect(sh('krytyczny')).toBeLessThan(sh('wysoki'));
    expect(sh('niski')).toBeGreaterThan(sh('normalny'));
  });
  it('a law bonus lifts zwykły and nietypowy to rzadki at most', () => {
    const rng = createRng(13);
    for (let i = 0; i < 500; i++) expect(rollDropTier(rng, DROP_TIER_WEIGHTS.common, 'normalny', 1)).not.toBe('zwykly');
  });
  it('an elite always leaves one item; stars 5-8', () => {
    const s = createRun(21);
    for (let i = 0; i < 100; i++) {
      s.pickups.length = 0;
      dropLoot(s, 0, 0, 'elite');
      // S18: a zestaw piece, a unique or a rzadki may go by post: one item either way
      expect(s.pickups.filter((k) => k.item).length + (s.player.awizos?.length ?? 0)).toBe(1);
      delete s.player.awizos;
      const stars = s.pickups.find((k) => k.gwiazdki)?.gwiazdki ?? 0;
      expect(stars).toBeGreaterThanOrEqual(5);
      expect(stars).toBeLessThanOrEqual(8);
    }
  });
  it('gwiazdki amounts follow the priority multiplier', () => {
    const total = (priority: PriorityId): number => {
      const s = planned(22, 0, priority);
      let sum = 0;
      for (let i = 0; i < 200; i++) {
        s.pickups.length = 0;
        dropLoot(s, 0, 0, 'boss');
        sum += s.pickups.filter((k) => !k.item && k.gwiazdki).reduce((a, k) => a + (k.gwiazdki ?? 0), 0);
      }
      return sum / 200;
    };
    expect(total('normalny')).toBeGreaterThan(27);
    expect(total('normalny')).toBeLessThan(33);
    expect(total('krytyczny') / total('normalny')).toBeCloseTo(1.6, 1);
    expect(total('niski') / total('normalny')).toBeCloseTo(0.8, 1);
  });
  it('the planet boss: first item rzadki or unique (12%, doubled at Krytyczny), the final ticket always a unique', () => {
    const uniques = (priority: PriorityId): number => {
      const s = planned(23, 2, priority);
      let u = 0;
      for (let i = 0; i < 1500; i++) {
        s.pickups.length = 0;
        dropLoot(s, 0, 0, 'boss');
        const first = s.pickups.find((k) => k.item)?.item;
        expect(['rzadki', 'unikatowy']).toContain(first?.tier);
        if (first?.tier === 'unikatowy') u++;
      }
      return u / 1500;
    };
    expect(uniques('normalny')).toBeGreaterThan(0.09);
    expect(uniques('normalny')).toBeLessThan(0.17);
    expect(uniques('krytyczny')).toBeGreaterThan(0.19);
    const fin = createRun(24, { plan: { ...defaultPlan(newCampaign(), 'normalny', 24), kind: 'final' } });
    for (let i = 0; i < 20; i++) {
      fin.pickups.length = 0;
      dropLoot(fin, 0, 0, 'boss');
      expect(fin.pickups.find((k) => k.item)?.item?.tier).toBe('unikatowy');
    }
  });
  it('items drop at the item level of the planet, page and priority', () => {
    const s = planned(25, 4, 'wysoki');
    s.pageIndex = 0;
    expect(dropLevel(s)).toBe(ilvlFor({ planet: 4, priority: 'wysoki', pageIndex: 0, pageCount: s.pageCount }));
    for (let i = 0; i < 30; i++) dropLoot(s, 0, 0, 'elite');
    for (const k of s.pickups) if (k.item) expect(k.item.level).toBe(dropLevel(s));
    expect(dropLevel(s, true)).toBe(dropLevel(s) + 2);
  });
  it('the named-elite hook gives one item of at least nietypowy', () => {
    const s = createRun(26);
    for (let i = 0; i < 200; i++) expect(dropGuaranteed(s, 0, 0).item?.tier).not.toBe('zwykly');
    expect(s.pickups).toHaveLength(200);
  });
});

describe('potwierdzenia per page (S5 rates, S9 target)', () => {
  it('rates are .1 / .5 / 1 and a Normalny page leaves 1-2 slips', () => {
    expect(POTWIERDZENIE_DROP).toEqual({ common: 0.1, elite: 0.5, boss: 1 });
    let slips = 0;
    let pages = 0;
    const TRICKLE = 4; // kills beyond the first population: one spawn per 10 s while the page is thin
    for (let seed = 1; seed <= 60; seed++) {
      const s = planned(seed, 0, 'normalny');
      for (let pi = 0; pi < s.pageCount - 1; pi++) {
        s.pageIndex = pi;
        const page = s.pages[pi];
        if (page) s.page = page;
        s.enemies.length = 0;
        s.pickups.length = 0;
        populatePage(s, createBus());
        for (const e of s.enemies) dropLoot(s, e.x, e.y, e.elite ? 'elite' : 'common');
        for (let i = 0; i < TRICKLE; i++) dropLoot(s, 0, 0, 'common');
        slips += s.pickups.filter((k) => k.potwierdzenie).length;
        pages++;
      }
    }
    expect(slips / pages).toBeGreaterThanOrEqual(1);
    expect(slips / pages).toBeLessThanOrEqual(2);
  });
});
