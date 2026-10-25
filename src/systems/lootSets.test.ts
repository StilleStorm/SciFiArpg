/** S17: the three loot seams closed — the hosting planet's boss drops its set piece, the Sklep offers one, a won Spór lifts the best drop. */
import { describe, expect, it } from 'vitest';
import { createBus } from '../core/events';
import { planetDef, PLANETS, type PriorityId, type TicketPlan } from '../world/campaign';
import { restock } from '../economy/sklep';
import { createSklep } from '../economy/sklep';
import type { Item } from '../items/types';
import { createRun, type RunState } from '../world/run';
import { BOSS_SET_CHANCE, BOSS_UNIQUE_CHANCE, SHOP_SET_CHANCE } from '../balance/loot';
import { bindLoot, dropLoot } from './loot';

const plan = (planet: number, priority: PriorityId = 'normalny'): TicketPlan => ({ kind: 'campaign', planet, priority, lawId: 'ciasteczka' });

function bossDrop(seed: number, planet: number, priority: PriorityId = 'normalny', won = false): Item[] {
  const s = createRun(seed, { plan: plan(planet, priority), pageCount: 5 });
  if (won) s.sporWon = true;
  return dropsOf(s);
}

/** One boss death on a run: the items it left. The run's loot stream goes on, so calling it again is a new roll. */
function dropsOf(s: RunState): Item[] {
  s.pickups.length = 0;
  dropLoot(s, 10, 10, 'boss');
  return s.pickups.flatMap((k) => (k.item ? [k.item] : []));
}

const RANK: Record<string, number> = { zwykly: 0, nietypowy: 1, rzadki: 2, unikatowy: 4 };
/** The tier order of ITEMS 4: a set piece sits between rzadki and unikatowy. */
const rank = (i: Item): number => (i.setId ? 3 : (RANK[i.tier] ?? 0));

describe('the planets host the sets (ITEMS 12.6)', () => {
  it('the first planet of each act hosts none; 2 Obieg, 3 Serwis, 5 Ostatnia mila, 6 Infolinia, 8 Domniemanie, 9 Awaria', () => {
    expect(PLANETS.map((p) => p.hostedSet)).toEqual([null, 'obieg', 'serwis', null, 'ostatnia-mila', 'infolinia', null, 'domniemanie', 'awaria']);
    expect(planetDef(4).hostedSet).toBe('ostatnia-mila');
  });
});

describe('the planet boss drops its set piece', () => {
  it('about 35% of first items on a hosting planet are a piece of its set, 12% a unique, the rest rzadki; a piece is rzadki with the set tag', () => {
    const n = 1200;
    let sets = 0;
    let uniques = 0;
    const run = createRun(11, { plan: plan(1), pageCount: 5 });
    for (let k = 0; k < n; k++) {
      const first = dropsOf(run)[0];
      expect(first).toBeDefined();
      if (!first) continue;
      if (first.setId) {
        sets++;
        expect(first.setId).toBe('obieg');
        expect(first.tier).toBe('rzadki');
        expect(first.likes).toBe('papier');
      } else if (first.uniqueId) uniques++;
      else expect(first.tier).toBe('rzadki');
    }
    expect(sets / n).toBeGreaterThan(BOSS_SET_CHANCE * (1 - BOSS_UNIQUE_CHANCE) - 0.06);
    expect(sets / n).toBeLessThan(BOSS_SET_CHANCE * (1 - BOSS_UNIQUE_CHANCE) + 0.06);
    expect(uniques / n).toBeGreaterThan(BOSS_UNIQUE_CHANCE - 0.05);
    expect(uniques / n).toBeLessThan(BOSS_UNIQUE_CHANCE + 0.05);
  });

  it('is the set of the planet whatever the planet is, and a planet without a set never drops a piece', () => {
    for (const [planet, def] of PLANETS.entries()) {
      const run = createRun(20 + planet, { plan: plan(planet), pageCount: 5 });
      for (let k = 0; k < 40; k++) {
        for (const item of dropsOf(run)) {
          if (def.hostedSet === null) expect(item.setId).toBeUndefined();
          else if (item.setId) expect(item.setId).toBe(def.hostedSet);
        }
      }
    }
  });

  it('Krytyczny doubles the chance', () => {
    let normal = 0;
    let critical = 0;
    const plain = createRun(12, { plan: plan(2), pageCount: 5 });
    const hard = createRun(12, { plan: plan(2, 'krytyczny'), pageCount: 5 });
    for (let k = 0; k < 600; k++) {
      if (dropsOf(plain)[0]?.setId) normal++;
      if (dropsOf(hard)[0]?.setId) critical++;
    }
    expect(critical).toBeGreaterThan(normal * 1.4);
  });

  it('is decided by the seed: the same ticket drops the same pieces', () => {
    for (let seed = 1; seed <= 12; seed++) {
      expect(bossDrop(seed, 4).map((i) => [i.uid, i.baseId, i.setId])).toEqual(bossDrop(seed, 4).map((i) => [i.uid, i.baseId, i.setId]));
    }
  });
});

describe('Komisja przychyliła się: a won Spór lifts the best drop one tier', () => {
  it('on a hosting planet the first item is never a plain rzadki, and never lower than without the Spór', () => {
    let lifted = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const plain = bossDrop(seed, 1)[0];
      const won = bossDrop(seed, 1, 'normalny', true)[0];
      if (!plain || !won) throw new Error('no drop');
      expect(won.setId !== undefined || won.tier === 'unikatowy').toBe(true);
      expect(rank(won)).toBeGreaterThanOrEqual(rank(plain));
      if (rank(won) > rank(plain)) lifted++;
    }
    expect(lifted).toBeGreaterThan(30);
  });

  it('on a planet without a set the second item rises a tier instead (to rzadki at most) and the first is unchanged', () => {
    let lifted = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const plain = bossDrop(seed, 0);
      const won = bossDrop(seed, 0, 'normalny', true);
      expect(won[0]?.baseId).toBe(plain[0]?.baseId);
      const a = plain[1];
      const b = won[1];
      if (!a || !b) throw new Error('no second drop');
      expect(RANK[b.tier] ?? 0).toBeGreaterThanOrEqual(RANK[a.tier] ?? 0);
      expect(RANK[b.tier] ?? 0).toBeLessThanOrEqual(Math.max(2, RANK[a.tier] ?? 0));
      if ((RANK[b.tier] ?? 0) > (RANK[a.tier] ?? 0)) lifted++;
    }
    expect(lifted).toBeGreaterThan(30);
  });

  it('a right reply in the Spór sets the flag and the dead boss says so; a wrong one does not', () => {
    const s: RunState = createRun(3, { plan: plan(1), pageCount: 5 });
    const bus = createBus();
    bindLoot(bus, () => s);
    const notes: string[] = [];
    bus.on('footnote', (e) => notes.push(e.text));
    bus.emit('spor:answered', { id: 1, index: 0, right: false });
    expect(s.sporWon).toBeUndefined();
    bus.emit('spor:answered', { id: 1, index: 1, right: true });
    expect(s.sporWon).toBe(true);
    bus.emit('enemy:died', { id: 99, x: 5, y: 5, tier: 'boss', family: 'urzadzenia' });
    expect(notes.some((x) => x.includes('Komisja przychyliła się'))).toBe(true);
  });
});

describe('the Sklep offers a piece of the planet\'s set', () => {
  const offers = (planet: number, visits: number): Item[] => {
    const out: Item[] = [];
    for (let visit = 1; visit <= visits; visit++) {
      const state = createSklep();
      restock(state, 99, visit, 12, planet);
      const offer = state.stock.find((l) => l.kind === 'oferta');
      if (offer) out.push(offer.item);
    }
    return out;
  };

  it('about 10% of the offers on a hosting planet are a piece of its set', () => {
    const list = offers(1, 800);
    const sets = list.filter((i) => i.setId);
    expect(list).toHaveLength(800);
    expect(sets.length / list.length).toBeGreaterThan(SHOP_SET_CHANCE - 0.04);
    expect(sets.length / list.length).toBeLessThan(SHOP_SET_CHANCE + 0.04);
    for (const i of sets) expect(i.setId).toBe('obieg');
  });

  it('a planet without a set always sells the plain offer: a rzadki with a grade 3 affix when it could be made', () => {
    const list = offers(0, 200);
    expect(list.some((i) => i.setId)).toBe(false);
    expect(list.every((i) => i.tier === 'rzadki')).toBe(true);
  });

  it('stock is a function of seed, visit and planet', () => {
    const a = createSklep();
    const b = createSklep();
    restock(a, 5, 3, 12, 1);
    restock(b, 5, 3, 12, 1);
    expect(a.stock.map((l) => [l.item.baseId, l.item.setId, l.price])).toEqual(b.stock.map((l) => [l.item.baseId, l.item.setId, l.price]));
  });
});
