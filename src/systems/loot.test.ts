import { describe, expect, it } from 'vitest';
import { createBus } from '../core/events';
import { INVENTORY_CAP } from '../items/inventory';
import { createRun } from '../world/run';
import { DROPS, bindLoot, dropLoot, dropPermission, rollPermission, takePickup, updateLoot } from './loot';

describe('loot', () => {
  it('common kills drop an item about one time in five, and stars about half the time', () => {
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
    expect(stars / n).toBeGreaterThan(0.38);
    expect(stars / n).toBeLessThan(0.52);
  });
  it('bosses always drop three items and a pile of stars, and the first is rzadki or better', () => {
    const s = createRun(2);
    for (let i = 0; i < 50; i++) {
      s.pickups.length = 0;
      dropLoot(s, 0, 0, 'boss');
      const items = s.pickups.filter((k) => k.item);
      expect(items).toHaveLength(3);
      expect(['rzadki', 'unikatowy']).toContain(items[0]?.item?.tier);
      expect(s.pickups.some((k) => (k.gwiazdki ?? 0) >= 8)).toBe(true);
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
});

describe('permission cards', () => {
  it('a boss always drops its family card, a common enemy never, an elite about one time in three', () => {
    const s = createRun(9);
    for (let i = 0; i < 20; i++) expect(rollPermission(s, 'boss', 'wygenerowane')).toBe('wygenerowane');
    for (let i = 0; i < 200; i++) expect(rollPermission(s, 'common', 'urzadzenia')).toBeNull();
    let n = 0;
    for (let i = 0; i < 3000; i++) if (rollPermission(s, 'elite', 'powiadomienia')) n++;
    expect(n / 3000).toBeGreaterThan(0.29);
    expect(n / 3000).toBeLessThan(0.37);
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
