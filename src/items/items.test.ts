import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { createPlayer } from '../entities/factory';
import type { Player } from '../entities/types';
import { adsActive, tickAds } from './ads';
import { adapterPrice, conflictTag, refreshCompat } from './compat';
import { fillDemoInventory } from './demo';
import { rollItem, rollTier, buildItem, TIER_WEIGHTS } from './generate';
import { INVENTORY_CAP, addItem, buyAdapter, buyOut, dropItem, equipItem, unequipSlot } from './inventory';
import { addAffix } from './rename';
import { HONEST_SPREAD, P_BOUGHT, P_UNDERRATED, TRIAL_KILLS, advanceTrial, formatRating, reviewLine, rollTruth } from './reviews';
import { FREE_PENALTY, effectiveStats, recomputeStats } from './stats';
import { UNWANTED_FEATURES } from './affixes';
import { BASES_BY_ID } from './bases';
import { createBus } from '../core/events';
import { ITEM_TIERS, SLOTS, STAT_KEYS, type Item, type ItemTier } from './types';
import { UNIQUES } from './uniques';

const newPlayer = (): Player => createPlayer(1, 0, 0);

function item(baseId: string, tier: ItemTier, affixes: string[], seed = 1): Item {
  const base = BASES_BY_ID.get(baseId);
  if (!base) throw new Error(baseId);
  return buildItem(createRng(seed), base, tier, 1, affixes);
}

describe('rollItem', () => {
  it('is deterministic by seed', () => {
    const a = Array.from({ length: 30 }, (_, i) => rollItem(createRng(100 + i), { level: 3 }));
    const b = Array.from({ length: 30 }, (_, i) => rollItem(createRng(100 + i), { level: 3 }));
    expect(b).toEqual(a);
    expect(rollItem(createRng(1), { level: 3 })).not.toEqual(rollItem(createRng(2), { level: 3 }));
  });
  it('respects slot and tier options', () => {
    const rng = createRng(9);
    for (const slot of SLOTS) {
      for (const tier of ['zwykly', 'nietypowy', 'rzadki'] as const) {
        const it = rollItem(rng, { level: 2, slot, tier });
        expect(it.slot).toBe(slot);
        expect(it.tier).toBe(tier);
      }
    }
  });
  it('gives affix counts by tier and tags to rzadki only', () => {
    const rng = createRng(5);
    for (let i = 0; i < 100; i++) {
      const z = rollItem(rng, { level: 1, tier: 'zwykly' });
      const n = rollItem(rng, { level: 1, tier: 'nietypowy' });
      const r = rollItem(rng, { level: 1, tier: 'rzadki' });
      expect(z.affixes.length).toBeLessThanOrEqual(1);
      expect(n.affixes.length).toBeGreaterThanOrEqual(1);
      expect(n.affixes.length).toBeLessThanOrEqual(2);
      expect(r.affixes.length).toBeGreaterThanOrEqual(2);
      expect(r.affixes.length).toBeLessThanOrEqual(3);
      expect(z.likes).toBeUndefined();
      expect(n.likes).toBeUndefined();
      expect(r.likes).toBeDefined();
      expect(r.dislikes).toBeDefined();
      expect(r.likes).not.toBe(r.dislikes);
      expect(new Set(r.affixes).size).toBe(r.affixes.length);
    }
  });
  it('makes weapons with a damage type and range, and sane numbers', () => {
    const rng = createRng(3);
    for (let i = 0; i < 100; i++) {
      const w = rollItem(rng, { level: 1 + (i % 6), slot: 'bron' });
      if (w.uniqueId) continue;
      expect(w.damageType).toBeDefined();
      expect(w.range).toBeGreaterThan(0);
      expect(w.claimed.dmgMax).toBeGreaterThanOrEqual(w.claimed.dmgMin);
      expect(w.claimed.dmgMax).toBeGreaterThan(0);
      for (const k of STAT_KEYS) expect(Number.isInteger(w.claimed[k])).toBe(true);
    }
  });
  it('scales with level', () => {
    const lo = item('pieczatka', 'zwykly', []);
    const base = BASES_BY_ID.get('pieczatka');
    if (!base) throw new Error('x');
    const hi = buildItem(createRng(1), base, 'zwykly', 10, []);
    expect(hi.claimed.dmgMax).toBeGreaterThan(lo.claimed.dmgMax);
  });
  it('rolls tiers by source weights', () => {
    const rng = createRng(77);
    const count = (src: 'common' | 'elite' | 'boss'): Record<ItemTier, number> => {
      const c: Record<ItemTier, number> = { zwykly: 0, nietypowy: 0, rzadki: 0, unikatowy: 0 };
      for (let i = 0; i < 6000; i++) c[rollTier(rng, src)]++;
      return c;
    };
    const common = count('common');
    const elite = count('elite');
    const boss = count('boss');
    expect(common.zwykly).toBeGreaterThan(common.nietypowy);
    expect(common.unikatowy).toBeLessThan(80);
    expect(elite.rzadki).toBeGreaterThan(common.rzadki * 2);
    expect(boss.zwykly).toBe(0);
    expect(boss.rzadki).toBeGreaterThan(boss.nietypowy);
    expect(boss.unikatowy).toBeGreaterThan(elite.unikatowy);
    expect(TIER_WEIGHTS.boss[0]).toBe(0);
  });
  it('the tier bonus moves ordinary drops up but does not make uniques common', () => {
    const rng = createRng(4);
    let uniques = 0;
    for (let i = 0; i < 3000; i++) if (rollTier(rng, 'common', 1) === 'unikatowy') uniques++;
    expect(uniques).toBeLessThan(45);
    const rng2 = createRng(4);
    const plain = Array.from({ length: 300 }, () => rollTier(rng2, 'common', 0)).filter((x) => x === 'zwykly').length;
    const rng3 = createRng(4);
    const bonus = Array.from({ length: 300 }, () => rollTier(rng3, 'common', 1)).filter((x) => x === 'zwykly').length;
    expect(bonus).toBeLessThan(plain);
  });
  it('rolls uniques when asked, with a story and no reviews', () => {
    const u = rollItem(createRng(1), { level: 2, tier: 'unikatowy' });
    expect(u.uniqueId).toBeDefined();
    expect(u.tier).toBe('unikatowy');
    expect(u.review).toBeUndefined();
    expect(u.revealed).toBe(true);
    expect(UNIQUES.map((x) => x.id)).toContain(u.uniqueId);
    const w = rollItem(createRng(1), { level: 2, tier: 'unikatowy', slot: 'bron' });
    expect(w.slot).toBe('bron');
  });
  it('the free version only appears on rzadki and is rare', () => {
    const rng = createRng(12);
    let free = 0;
    let rare = 0;
    for (let i = 0; i < 2000; i++) {
      const z = rollItem(rng, { level: 1, tier: 'nietypowy' });
      expect(z.freeVersion).toBeUndefined();
      const r = rollItem(rng, { level: 1, tier: 'rzadki' });
      rare++;
      if (r.freeVersion) {
        free++;
        expect(r.name).toContain('w\u00a0wersji darmowej');
      }
    }
    expect(free / rare).toBeGreaterThan(0.06);
    expect(free / rare).toBeLessThan(0.2);
  });
});

describe('reviews: claimed versus actual', () => {
  it('truth distribution is 80/15/5', () => {
    const rng = createRng(2024);
    const n = 20000;
    const c = { honest: 0, bought: 0, niedoceniony: 0 };
    for (let i = 0; i < n; i++) c[rollTruth(rng)]++;
    expect(c.bought / n).toBeGreaterThan(P_BOUGHT - 0.015);
    expect(c.bought / n).toBeLessThan(P_BOUGHT + 0.015);
    expect(c.niedoceniony / n).toBeGreaterThan(P_UNDERRATED - 0.01);
    expect(c.niedoceniony / n).toBeLessThan(P_UNDERRATED + 0.01);
  });
  it('honest items are within +-10%, bought are worse, niedoceniony are better', () => {
    const rng = createRng(31);
    let sawBought = 0;
    let sawUnder = 0;
    for (let i = 0; i < 1500; i++) {
      const it = rollItem(rng, { level: 4, tier: 'rzadki', slot: 'bron' });
      const truth = it.review?.truth;
      const sumC = it.claimed.dmgMin + it.claimed.dmgMax + it.claimed.pewnosc + it.claimed.upor + it.claimed.racja;
      const sumA = it.actual.dmgMin + it.actual.dmgMax + it.actual.pewnosc + it.actual.upor + it.actual.racja;
      if (truth === 'honest') {
        expect(sumA).toBeGreaterThanOrEqual(sumC * (1 - HONEST_SPREAD) - 3);
        expect(sumA).toBeLessThanOrEqual(sumC * (1 + HONEST_SPREAD) + 3);
        for (const k of STAT_KEYS) expect(Math.abs(it.actual[k] - it.claimed[k])).toBeLessThanOrEqual(Math.ceil(Math.abs(it.claimed[k]) * HONEST_SPREAD) + 1);
      } else if (truth === 'bought') {
        sawBought++;
        expect(sumA).toBeLessThan(sumC * 0.9);
        expect(it.review?.rating).toBeGreaterThanOrEqual(4.7);
      } else if (truth === 'niedoceniony') {
        sawUnder++;
        expect(sumA).toBeGreaterThan(sumC * 1.1);
        expect(it.review?.count).toBeLessThan(30);
      }
    }
    expect(sawBought).toBeGreaterThan(100);
    expect(sawUnder).toBeGreaterThan(30);
  });
  it('formats the review line in Polish', () => {
    expect(formatRating(4.8)).toBe('4,8');
    expect(reviewLine({ rating: 4.8, count: 213, truth: 'honest' })).toBe('4,8 · 213 opinii zweryfikowanych');
    expect(reviewLine({ rating: 4.1, count: 3, truth: 'honest' })).toBe('4,1 · 3 opinie zweryfikowane');
    expect(reviewLine({ rating: 4.1, count: 1, truth: 'honest' })).toBe('4,1 · 1 opinia zweryfikowana');
  });
});

describe('trial', () => {
  it('uses claimed numbers until the trial ends, then actual; 5/10/15 kills by tier', () => {
    const p = newPlayer();
    const it = item('kask', 'rzadki', ['odnowiony', 'zweryfikowany'], 5);
    it.likes = undefined;
    it.dislikes = undefined;
    it.actual = { ...it.claimed, upor: it.claimed.upor + 20 };
    addItem(p, it);
    equipItem(p, it);
    const before = p.stats.upor;
    expect(before).toBe(p.baseStats.stats.upor + it.claimed.upor);
    expect(TRIAL_KILLS).toEqual({ zwykly: 5, nietypowy: 10, rzadki: 15, unikatowy: 0 });
    let revealed = 0;
    for (let i = 0; i < 14; i++) revealed += advanceTrial(p).length;
    expect(revealed).toBe(0);
    expect(it.revealed).toBe(false);
    expect(advanceTrial(p)).toHaveLength(1);
    expect(it.revealed).toBe(true);
    expect(p.stats.upor).toBe(p.baseStats.stats.upor + it.actual.upor);
    expect(advanceTrial(p)).toHaveLength(0);
  });
  it('reads the hero trial speed (Konsultant: 2)', () => {
    const p = newPlayer();
    p.trialSpeed = 2;
    const it = item('czapka', 'zwykly', []);
    addItem(p, it);
    equipItem(p, it);
    for (let i = 0; i < 2; i++) advanceTrial(p);
    expect(it.revealed).toBe(false);
    advanceTrial(p);
    expect(it.revealed).toBe(true);
  });
  it('does not count kills for an item that is not worn', () => {
    const p = newPlayer();
    const it = item('czapka', 'zwykly', []);
    addItem(p, it);
    for (let i = 0; i < 10; i++) advanceTrial(p);
    expect(it.revealed).toBe(false);
    expect(it.trialKills).toBe(0);
  });
});

describe('compatibility', () => {
  const pair = (): [Item, Item] => {
    const a = item('pieczatka', 'rzadki', ['zweryfikowany', 'odnowiony'], 11);
    const b = item('certyfikat', 'rzadki', ['domniemany', 'gwarancyjny'], 12);
    a.likes = 'papier';
    a.dislikes = 'halas';
    b.likes = 'halas';
    b.dislikes = 'chaos';
    a.number = 9;
    b.number = 14;
    return [a, b];
  };
  it('detects a clash when one dislikes what the other likes', () => {
    const [a, b] = pair();
    expect(conflictTag(a, b)).toBe('halas');
    expect(conflictTag(b, a)).toBe('halas');
  });
  it('the newer item is niekompatybilny, does nothing, and says why', () => {
    const p = newPlayer();
    const [a, b] = pair();
    p.inventory.push(a, b);
    equipItem(p, a);
    const res = equipItem(p, b);
    expect(res.clash).toEqual({ number: 9, tag: 'halas' });
    expect(b.blockedBy).toEqual({ uid: a.uid, number: 9, tag: 'halas' });
    expect(a.blockedBy).toBeUndefined();
    const withB = { ...p.stats };
    expect(effectiveStats(b).upor).toBe(0);
    // b adds nothing
    p.equipment = { bron: a };
    recomputeStats(p);
    expect(p.stats).toEqual(withB);
  });
  it('is lifted by removing the other item or by buying an adapter', () => {
    const p = newPlayer();
    const [a, b] = pair();
    p.inventory.push(a, b);
    equipItem(p, a);
    equipItem(p, b);
    expect(b.blockedBy).toBeDefined();
    expect(buyAdapter(p, b)).toBe('poor');
    p.gwiazdki = 100;
    const price = adapterPrice(b);
    expect(buyAdapter(p, b)).toBe('ok');
    expect(p.gwiazdki).toBe(100 - price);
    expect(b.blockedBy).toBeUndefined();
    expect(effectiveStats(b).pewnosc).toBe(b.claimed.pewnosc);
    // without the adapter, removing the old item also lifts the block
    const p2 = newPlayer();
    const [c, d] = pair();
    p2.inventory.push(c, d);
    equipItem(p2, c);
    equipItem(p2, d);
    expect(d.blockedBy).toBeDefined();
    unequipSlot(p2, 'bron');
    expect(d.blockedBy).toBeUndefined();
  });
  it('a pair that shares a like forms a set with a bonus', () => {
    const p = newPlayer();
    const a = item('pieczatka', 'rzadki', ['zweryfikowany', 'odnowiony'], 21);
    const b = item('certyfikat', 'rzadki', ['domniemany', 'gwarancyjny'], 22);
    a.likes = 'papier';
    a.dislikes = 'chaos';
    b.likes = 'papier';
    b.dislikes = 'metal';
    p.inventory.push(a, b);
    equipItem(p, a);
    const before = p.stats.upor;
    const res = equipItem(p, b);
    expect(res.newSets).toHaveLength(1);
    expect(res.clash).toBeUndefined();
    expect(p.stats.upor).toBe(before + b.claimed.upor + 6);
  });
  it('unequipped tagless items never clash', () => {
    const eq = { bron: item('pieczatka', 'zwykly', []), kask: undefined };
    expect(refreshCompat({ bron: eq.bron }).length).toBe(1);
  });
});

describe('recomputeStats and the inventory', () => {
  it('adds equipment on top of the hero base, takes damage type and range from the weapon', () => {
    const p = newPlayer();
    p.baseStats = { ...p.baseStats, damageType: 'egzystencjalny', attackRange: 50, attackCooldown: 1 };
    recomputeStats(p);
    expect(p.damageType).toBe('egzystencjalny');
    expect(p.attackRange).toBe(50);
    const w = item('wskaznik', 'zwykly', []);
    w.damageType = 'regulaminowy';
    addItem(p, w);
    equipItem(p, w);
    expect(p.damageType).toBe('regulaminowy');
    expect(p.attackRange).toBe(w.range);
    expect(p.attackCooldown).toBeCloseTo(1 * (w.cooldownMul ?? 1));
    expect(p.stats.dmgMax).toBe(p.baseStats.stats.dmgMax + w.claimed.dmgMax);
    unequipSlot(p, 'bron');
    expect(p.damageType).toBe('egzystencjalny');
    expect(p.attackRange).toBe(50);
    expect(p.stats.dmgMax).toBe(p.baseStats.stats.dmgMax);
  });
  it('racja grows with armor and never exceeds the new maximum', () => {
    const p = newPlayer();
    const k = item('kamizelka', 'zwykly', []);
    addItem(p, k);
    equipItem(p, k);
    expect(p.hpMax).toBe(p.baseStats.hpMax + k.claimed.racja);
    expect(p.hp).toBe(p.hpMax);
    unequipSlot(p, 'odziez');
    expect(p.hpMax).toBe(p.baseStats.hpMax);
    expect(p.hp).toBe(p.hpMax);
  });
  it('swaps the item in a slot and keeps the old one in the bag', () => {
    const p = newPlayer();
    const a = item('kask', 'zwykly', [], 1);
    const b = item('czapka', 'zwykly', [], 2);
    p.inventory.push(a, b);
    equipItem(p, a);
    const res = equipItem(p, b);
    expect(res.replaced).toBe(a);
    expect(p.equipment.nakrycie).toBe(b);
    expect(p.inventory).toEqual([a]);
  });
  it('caps the inventory at 20 and drops items', () => {
    const p = newPlayer();
    for (let i = 0; i < INVENTORY_CAP; i++) expect(addItem(p, item('kask', 'zwykly', [], i + 1))).toBe(true);
    expect(addItem(p, item('kask', 'zwykly', [], 99))).toBe(false);
    const first = p.inventory[0];
    if (!first) throw new Error('x');
    expect(dropItem(p, first)).toBe(true);
    expect(p.inventory).toHaveLength(INVENTORY_CAP - 1);
  });
  it('the demo inventory has six items, one unique, one niekompatybilny', () => {
    const p = newPlayer();
    fillDemoInventory(p);
    const all = [...p.inventory, ...Object.values(p.equipment)];
    expect(all).toHaveLength(6);
    expect(all.some((i) => i?.uniqueId)).toBe(true);
    expect(Object.values(p.equipment).some((i) => i?.blockedBy)).toBe(true);
  });
  it('an unwanted feature changes the numbers and the name', () => {
    const w = item('pieczatka', 'zwykly', []);
    const before = w.name;
    const f = UNWANTED_FEATURES.find((a) => a.id === 'inteligentny');
    if (!f) throw new Error('x');
    const pew = w.claimed.pewnosc;
    addAffix(w, f);
    expect(w.name).toBe(`${before} inteligentna`);
    expect(w.claimed.pewnosc).toBe(pew - 8);
  });
});

describe('free version', () => {
  const freeItem = (): Item => item('wskaznik', 'rzadki', ['ewentualny', 'darmowy'], 40);
  it('is strong during the trial, -40% after it, and shows ads every 30 s until bought out', () => {
    const p = newPlayer();
    const bus = createBus();
    const ads: string[] = [];
    bus.on('footnote', (e) => ads.push(e.text));
    const f = freeItem();
    f.likes = undefined;
    f.dislikes = undefined;
    f.actual = { ...f.claimed };
    expect(f.freeVersion).toBe(true);
    expect(f.trialTarget).toBe(20);
    addItem(p, f);
    equipItem(p, f);
    const strong = effectiveStats(f).dmgMax;
    expect(adsActive(p)).toBe(false);
    for (let i = 0; i < 100; i++) tickAds(p, bus, 1);
    expect(ads).toHaveLength(0);
    for (let i = 0; i < 20; i++) advanceTrial(p);
    expect(f.revealed).toBe(true);
    expect(adsActive(p)).toBe(true);
    expect(effectiveStats(f).dmgMax).toBe(Math.round(strong * FREE_PENALTY));
    for (let i = 0; i < 95; i++) tickAds(p, bus, 1);
    expect(ads).toHaveLength(3);
    expect(ads[0]).toContain('Reklama');
    expect(buyOut(p, f)).toBe('poor');
    p.gwiazdki = 500;
    expect(buyOut(p, f)).toBe('ok');
    expect(adsActive(p)).toBe(false);
    expect(effectiveStats(f).dmgMax).toBe(strong);
    for (let i = 0; i < 100; i++) tickAds(p, bus, 1);
    expect(ads).toHaveLength(3);
  });
});

describe('tiers list', () => {
  it('has four tiers', () => {
    expect(ITEM_TIERS).toHaveLength(4);
  });
});
