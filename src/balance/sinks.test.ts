import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { binValue } from '../economy/kosz';
import { reklamacjaCost } from '../economy/reklamacja';
import { feeOf } from '../economy/sklep';
import { itemValue, rollItem } from '../items/generate';
import { shopIlvl } from '../items/level';
import { dropLoot } from '../systems/loot';
import { defaultPlan, newCampaign } from '../world/campaign';
import { proceduralOffer } from '../world/quests';
import { createRun } from '../world/run';
import { PACZKOMAT_FEE } from './loot';

/** The S16 bot finished 2.7 side tickets and met 3.6 elites per planet-1 run (ITEMS 7.4). */
const SIDE_TICKETS = 2.7;

interface Planet {
  kills: number;
  named: number;
  bin: number;
}

/** The kills of one planet-1 Normalny run: 60 commons, 4 elites, 2 named elites, the planet boss; the bin takes every zwykły and nietypowy item. */
function planetRun(seed: number): Planet {
  const base = defaultPlan(newCampaign(), 'normalny', seed);
  const s = createRun(seed, { plan: { ...base, planet: 0 }, pageCount: 5 });
  const spread = (n: number, rank: 'common' | 'elite' | 'named'): void => {
    for (let i = 0; i < n; i++) {
      s.pageIndex = Math.floor((i * (s.pageCount - 1)) / n);
      dropLoot(s, 0, 0, rank);
    }
  };
  spread(60, 'common');
  spread(4, 'elite');
  const before = s.pickups.reduce((a, k) => a + (k.item ? 0 : (k.gwiazdki ?? 0)), 0);
  spread(2, 'named');
  const named = s.pickups.reduce((a, k) => a + (k.item ? 0 : (k.gwiazdki ?? 0)), 0) - before;
  s.pageIndex = s.pageCount - 1;
  dropLoot(s, 0, 0, 'boss');
  let kills = 0;
  let bin = 0;
  for (const k of s.pickups) {
    if (!k.item) kills += k.gwiazdki ?? 0;
    else if (k.item.tier === 'zwykly' || k.item.tier === 'nietypowy') bin += binValue(k.item);
  }
  return { kills, named, bin };
}

describe('sinks and sources of one planet (ITEMS 7.4, seeded simulation)', () => {
  const runs = Array.from({ length: 60 }, (_, i) => planetRun(500 + i));
  const mean = (f: (p: Planet) => number): number => runs.reduce((a, p) => a + f(p), 0) / runs.length;
  const offers = Array.from({ length: 20 }, (_, i) => proceduralOffer(0, i >> 1, i & 1).reward.stars);
  const sides = SIDE_TICKETS * (offers.reduce((a, b) => a + b, 0) / offers.length);

  it('the kills pay what the rows say: commons 55, elites 26, named 30, boss 30', () => {
    expect(mean((p) => p.kills)).toBeGreaterThan(125);
    expect(mean((p) => p.kills)).toBeLessThan(150);
    // two named elites at 12-18 each (the S16 baseline had 5-8 for them as plain elites)
    expect(mean((p) => p.named)).toBeGreaterThan(26);
    expect(mean((p) => p.named)).toBeLessThan(34);
  });

  it('the bin returns about 15', () => {
    expect(mean((p) => p.bin)).toBeGreaterThan(8);
    expect(mean((p) => p.bin)).toBeLessThan(25);
  });

  it('a planet pays about 200 in all, and the sinks do not drain it in one visit nor leave it idle', () => {
    const total = mean((p) => p.kills + p.bin) + sides;
    // the table says ~200; the side tickets pay 22 on average as the table does (QUEST_STARS.base 8 since S18)
    expect(sides / SIDE_TICKETS).toBeGreaterThan(19);
    expect(sides / SIDE_TICKETS).toBeLessThan(26);
    expect(total).toBeGreaterThan(180);
    expect(total).toBeLessThan(225);
    const rng = createRng(31);
    const level = shopIlvl(0);
    const nietypowy = Array.from({ length: 100 }, () => itemValue(rollItem(rng, { level, tier: 'nietypowy', shop: true })));
    const shop = nietypowy.reduce((a, v) => a + v + feeOf(v), 0) / nietypowy.length;
    const rare = rollItem(rng, { level, tier: 'rzadki' });
    // one Reklamacja on a rzadki, one Sklep plate, one pickup: under a planet's income, and not a trifle
    const visit = reklamacjaCost(rare) + shop + PACZKOMAT_FEE;
    expect(visit).toBeLessThan(total);
    expect(visit).toBeGreaterThan(total * 0.25);
  });
});
