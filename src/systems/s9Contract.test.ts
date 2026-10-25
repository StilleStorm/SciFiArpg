import { describe, expect, it } from 'vitest';
import { createBus } from '../core/events';
import { ilvlFor } from '../items/level';
import { bindEliteDeaths, spawnElite, trackElite } from '../enemies/spawn';
import { rtOf } from '../enemies/runtime';
import { createRun } from '../world/run';
import type { TicketPlan } from '../world/campaign';
import { bindLoot, dropLoot } from './loot';
const TIER_ORDER = ['zwykly', 'nietypowy', 'rzadki', 'unikatowy'];

// S9 contract: planet 3 at Wysoki -> item level band 14..18 -> a pack and a named elite -> the named drop is guaranteed.
const PLAN: TicketPlan = { kind: 'campaign', planet: 2, priority: 'wysoki', lawId: 'ciasteczka' };
const LOW = ilvlFor({ planet: 2, priority: 'wysoki', pageIndex: 0, pageCount: 5 });
const HIGH = ilvlFor({ planet: 2, priority: 'wysoki', pageIndex: 4, pageCount: 5, boss: true });

describe('S9 flow on planet 3 at Wysoki', () => {
  it('the item level band is 14 to 18', () => {
    expect([LOW, HIGH]).toEqual([14, 18]);
  });
  it('every source drops items inside the band across seeds', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const s = createRun(seed, { plan: PLAN, pageCount: 5 });
      for (const source of ['common', 'elite', 'boss'] as const) {
        s.pickups.length = 0;
        for (let i = 0; i < 20; i++) dropLoot(s, 10, 10, source);
        for (const k of s.pickups) if (k.item) {
          expect(k.item.level).toBeGreaterThanOrEqual(LOW);
          expect(k.item.level).toBeLessThanOrEqual(HIGH);
        }
      }
    }
  });
  it('a pack spawns with its leader and shared aura, a named elite drops one guaranteed nietypowy+ item in band, once', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const s = createRun(seed, { plan: PLAN, pageCount: 5 });
      const bus = createBus();
      bindLoot(bus, () => s);
      bindEliteDeaths(s, bus);
      s.enemies.length = 0;
      const pack = spawnElite(s, 'urzadzenia', { x: 600, y: 600 }, 'pilny', { pack: true, makeNamed: false });
      expect(pack).not.toBeNull();
      const members = s.enemies.filter((e) => e.id === pack?.id || rtOf(e).packOf === pack?.id);
      expect(members.length).toBeGreaterThanOrEqual(3);
      s.enemies.length = 0;
      const named = spawnElite(s, 'urzadzenia', { x: 600, y: 600 }, 'pilny', { makeNamed: true, pack: false });
      expect(named).not.toBeNull();
      if (!named) continue;
      trackElite(s, named);
      expect(rtOf(named).named).toBeTruthy();
      expect(rtOf(named).affixes.length).toBeGreaterThanOrEqual(2);
      expect(rtOf(named).affixes.length).toBeLessThanOrEqual(3);
      s.pickups.length = 0;
      bus.emit('enemy:died', { id: named.id, x: 5, y: 5, tier: 'elite' });
      // S18: an elite's zestaw piece, unique or (30%) rzadki arrives by post, so the items are the pickups and the awizos
      const heldItems = (st: typeof s) => [...st.pickups.flatMap((k) => (k.item ? [k.item] : [])), ...(st.player.awizos ?? []).map((a) => a.item)];
      const firstItems = heldItems(s);
      const first = firstItems.length;
      // the guaranteed item is among them: nietypowy or better, in the band of the page
      const guaranteed = firstItems.find((i) => TIER_ORDER.indexOf(i.tier) >= TIER_ORDER.indexOf('nietypowy') && i.level >= LOW && i.level <= HIGH);
      expect(guaranteed).toBeDefined();
      // the same seed and plan without the record: the named kill leaves exactly one item more
      const plain = createRun(seed, { plan: PLAN, pageCount: 5 });
      const pbus = createBus();
      bindLoot(pbus, () => plain);
      pbus.emit('enemy:died', { id: named.id, x: 5, y: 5, tier: 'elite' });
      expect(first).toBe(heldItems(plain).length + 1);
      // a repeated death event never pays the guarantee twice
      const [before, plainBefore] = [heldItems(s).length, heldItems(plain).length];
      bus.emit('enemy:died', { id: named.id, x: 5, y: 5, tier: 'elite' });
      pbus.emit('enemy:died', { id: named.id, x: 5, y: 5, tier: 'elite' });
      expect(heldItems(s).length - before).toBe(heldItems(plain).length - plainBefore);
    }
  });
});
