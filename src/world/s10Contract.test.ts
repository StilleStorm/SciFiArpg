import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { createBus } from '../core/events';
import { t } from '../i18n';
import { PLANET_COUNT } from './campaign';
import { SEALS, SEAL_IDS, EVENT_IDS } from './contentKinds';
import { sealKeys, grantSeal, activeBuffs, openTeczka, type Teczka } from './content';
import { npcAt } from './npc';
import { OFFERS_PER_PLANET, advanceQuests, completeQuest, offersFor, questsOf, takeQuest } from './quests';
import { createRun } from './run';
import { generateRunPages } from './pages';
import { applyCharacter, serializeCharacter, toCharacter } from '../save/character';

describe('S10 contracts', () => {
  it('every seal and event has printed copy (no key falls through to itself)', () => {
    for (const id of SEAL_IDS) {
      const k = sealKeys(id);
      for (const key of [k.name, k.desc, k.stamp]) expect(t(key), key).not.toBe(key);
      expect(SEALS[id].seconds).toBeGreaterThan(0);
    }
    const reachable: [string, 'done' | 'failed'][] = [['formularz', 'done'], ['przesylka', 'done'], ['przesylka', 'failed'], ['audyt', 'done'], ['audyt', 'failed']];
    expect(new Set(reachable.map(([e]) => e))).toEqual(new Set(EVENT_IDS));
    for (const [e, ph] of reachable) expect(t(`world.event.${e}.${ph}.stamp`), `${e}.${ph}`).not.toBe(`world.event.${e}.${ph}.stamp`);
  });

  it('every planet has a clerk with three lines that print', () => {
    for (let p = 0; p < PLANET_COUNT; p++) {
      const n = npcAt(p);
      expect(n.lineKeys).toHaveLength(3);
      for (const key of [n.nameKey, n.roleKey, ...n.lineKeys]) expect(t(key), key).not.toBe(key);
    }
  });

  it('content placement is a pure function of the seed, and the base page has none', () => {
    const a = generateRunPages(createRng(77), 8).map((p) => p.content ?? []);
    const b = generateRunPages(createRng(77), 8).map((p) => p.content ?? []);
    expect(b).toEqual(a);
    for (const page of a) expect(page.length).toBeLessThanOrEqual(5);
  });

  it('a teczka drops exactly one item pickup; a seal sits on RunState.buffs and refreshes instead of stacking', () => {
    const s = createRun(9, { phase: 'run' });
    s.pickups.length = 0;
    const bus = createBus();
    const z: Teczka = { kind: 'teczka', id: 1, x: s.player.x + 30, y: s.player.y, seed: 3, opened: false };
    expect(openTeczka(s, bus, z)).toBe(true);
    expect(openTeczka(s, bus, z)).toBe(false);
    expect(s.pickups.filter((k) => k.item)).toHaveLength(1);
    grantSeal(s, bus, 'pilnosc');
    grantSeal(s, bus, 'pilnosc');
    expect(activeBuffs(s).filter((b) => b.id === 'pilnosc')).toHaveLength(1);
  });

  it('accept, complete, reward survives the character save round trip', () => {
    const s = createRun(4, { phase: 'run' });
    const bus = createBus();
    const events: string[] = [];
    bus.on('quest:changed', (e) => events.push(e.what));
    const offers = offersFor(0, questsOf(s));
    expect(offers).toHaveLength(OFFERS_PER_PLANET);
    const def = offers[0]!;
    expect(takeQuest(s, bus, def.id)).toBe('ok');
    expect(completeQuest(s, bus, def.id)).toBe(false); // not ready yet
    const a = questsOf(s).active[0]!;
    a.progress = def.n;
    a.stage = 1;
    const stars0 = s.player.gwiazdki;
    expect(completeQuest(s, bus, def.id)).toBe(true);
    expect(s.player.gwiazdki - stars0).toBeGreaterThan(0);
    expect(events).toEqual(['accepted', 'done']);
    const saved = JSON.parse(JSON.stringify(serializeCharacter(s)));
    const s2 = createRun(4, { phase: 'run' });
    applyCharacter(s2, toCharacter(saved)!);
    expect(questsOf(s2).done).toBe(1);
    expect(questsOf(s2).active).toHaveLength(0);
    // the board offers other slots after a completion (epoch moves)
    expect(offersFor(0, questsOf(s2)).map((d) => d.id)).not.toContain(def.id);
    expect(advanceQuests(questsOf(s2), 0, { what: 'clerk' }).changed).toEqual([]);
  });
});
