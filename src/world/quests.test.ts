import { describe, expect, it } from 'vitest';
import { createBus } from '../core/events';
import { applyCharacter, serializeCharacter, toCharacter } from '../save/character';
import { createPotwierdzeniePickup } from '../entities/factory';
import { takePickup } from '../systems/loot';
import { HELD_CAP } from '../systems/recovery';
import { PLANET_COUNT } from './campaign';
import {
  MAX_ACTIVE,
  OFFERS_PER_PLANET,
  QUEST_KINDS,
  abandonQuest,
  acceptQuest,
  advanceQuests,
  bindQuests,
  completeQuest,
  isReady,
  newQuests,
  offersFor,
  payReward,
  proceduralOffer,
  questById,
  questPlanet,
  questsOf,
  registerSideTickets,
  takeQuest,
  toQuests,
  visitClerk,
  type QuestDef,
} from './quests';
import { createRun, nextId, type RunState } from './run';

const runState = (seed = 3): RunState => {
  const s = createRun(seed, { phase: 'run' });
  s.enemies.length = 0;
  s.pickups.length = 0;
  return s;
};

describe('the offers', () => {
  it('are a pure function of planet, epoch and slot, and the id names the definition', () => {
    for (let p = 0; p < PLANET_COUNT; p++) {
      for (let epoch = 0; epoch < 4; epoch++) {
        for (let slot = 0; slot < OFFERS_PER_PLANET; slot++) {
          const a = proceduralOffer(p, epoch, slot);
          expect(proceduralOffer(p, epoch, slot)).toEqual(a);
          expect(questById(a.id)).toEqual(a);
          expect(a.planet).toBe(p);
          expect(a.n).toBeGreaterThanOrEqual(1);
          expect(a.reward.stars).toBeGreaterThan(0);
        }
      }
    }
  });

  it('give two different templates per planet and cover all four over a few epochs', () => {
    const seen = new Set<string>();
    for (let p = 0; p < PLANET_COUNT; p++) {
      for (let epoch = 0; epoch < 6; epoch++) {
        const [a, b] = [proceduralOffer(p, epoch, 0), proceduralOffer(p, epoch, 1)];
        expect(a.kind).not.toBe(b.kind);
        seen.add(a.kind);
        seen.add(b.kind);
      }
    }
    expect([...seen].sort()).toEqual([...QUEST_KINDS].sort());
  });

  it('scale with the planet and change when a ticket is done', () => {
    const early = proceduralOffer(0, 0, 0);
    const late = proceduralOffer(8, 0, 0);
    expect(late.reward.stars).toBeGreaterThan(early.reward.stars);
    const q = newQuests();
    const before = offersFor(2, q).map((d) => d.id);
    expect(before).toHaveLength(OFFERS_PER_PLANET);
    q.done = 1;
    expect(offersFor(2, q).map((d) => d.id)).not.toEqual(before);
  });

  it('hold back a taken ticket and show hand-written ones first', () => {
    const q = newQuests();
    const first = offersFor(1, q)[0];
    expect(first).toBeDefined();
    if (!first) return;
    acceptQuest(q, first.id);
    expect(offersFor(1, q).some((d) => d.id === first.id)).toBe(false);
    const hand: QuestDef = { id: 'h:test:1', kind: 'kill', planet: 1, n: 2, titleKey: 'screens.quests.kill.0.title', textKey: 'screens.quests.kill.0.text', reward: { stars: 10 } };
    registerSideTickets([hand]);
    expect(offersFor(1, q)[0]?.id).toBe('h:test:1');
    expect(offersFor(0, q).some((d) => d.id === 'h:test:1')).toBe(false);
  });
});

describe('accepting and counting', () => {
  it('limits the active tickets and refuses duplicates and strangers', () => {
    const q = newQuests();
    const ids = [0, 1].flatMap((e) => [proceduralOffer(0, e, 0).id, proceduralOffer(0, e, 1).id]);
    expect(acceptQuest(q, ids[0] ?? '')).toBe('ok');
    expect(acceptQuest(q, ids[0] ?? '')).toBe('active');
    expect(acceptQuest(q, 'nonsense')).toBe('unknown');
    expect(acceptQuest(q, ids[1] ?? '')).toBe('ok');
    expect(acceptQuest(q, ids[2] ?? '')).toBe('ok');
    expect(q.active).toHaveLength(MAX_ACTIVE);
    expect(acceptQuest(q, ids[3] ?? '')).toBe('full');
    expect(abandonQuest(q, ids[0] ?? '')).toBe(true);
    expect(abandonQuest(q, ids[0] ?? '')).toBe(false);
  });

  const find = (kind: string, planet = 0): QuestDef => {
    for (let e = 0; e < 40; e++) for (let slot = 0; slot < 2; slot++) {
      const d = proceduralOffer(planet, e, slot);
      if (d.kind === kind) return d;
    }
    throw new Error(`no ${kind}`);
  };

  it('kill counts the family it names, only on its planet, and gets ready at n', () => {
    const q = newQuests();
    let def = find('kill');
    for (let e = 0; e < 40 && !def.family; e++) def = proceduralOffer(0, e, 0).kind === 'kill' ? proceduralOffer(0, e, 0) : def;
    acceptQuest(q, def.id);
    const other = def.family === 'urzadzenia' ? 'powiadomienia' : 'urzadzenia';
    expect(advanceQuests(q, 0, { what: 'kill', family: other }).changed).toEqual([]);
    expect(advanceQuests(q, 1, { what: 'kill', ...(def.family ? { family: def.family } : {}) }).changed).toEqual([]);
    let ready: string[] = [];
    for (let i = 0; i < def.n; i++) ready = advanceQuests(q, 0, { what: 'kill', ...(def.family ? { family: def.family } : {}) }).ready;
    expect(ready).toEqual([def.id]);
    expect(isReady(q, def.id)).toBe(true);
    expect(advanceQuests(q, 0, { what: 'kill', ...(def.family ? { family: def.family } : {}) }).changed).toEqual([]);
  });

  it('fetch counts finds, reach keeps the highest page, deliver needs the carry and then the clerk', () => {
    const q = newQuests();
    const fetch = find('fetch');
    const reach = find('reach');
    const deliver = find('deliver');
    for (const d of [fetch, reach, deliver]) acceptQuest(q, d.id);
    for (let i = 0; i < fetch.n; i++) advanceQuests(q, 0, { what: 'find' });
    expect(isReady(q, fetch.id)).toBe(true);
    advanceQuests(q, 0, { what: 'page', page: 2 });
    advanceQuests(q, 0, { what: 'page', page: 1 });
    expect(q.active.find((a) => a.id === reach.id)?.progress).toBe(Math.min(2, reach.n));
    advanceQuests(q, 0, { what: 'page', page: reach.n });
    expect(isReady(q, reach.id)).toBe(true);
    // the clerk before the carry does nothing; after it the parcel is handed over
    expect(advanceQuests(q, 0, { what: 'clerk' }).ready).toEqual([]);
    expect(advanceQuests(q, 0, { what: 'carry' }).changed).toEqual([deliver.id]);
    expect(isReady(q, deliver.id)).toBe(false);
    expect(advanceQuests(q, 0, { what: 'clerk' }).ready).toEqual([deliver.id]);
  });
});

describe('the quest state', () => {
  it('survives the character round trip and ignores what it does not know', () => {
    const s = runState();
    const id = proceduralOffer(0, 0, 0).id;
    expect(takeQuest(s, createBus(), id)).toBe('ok');
    questsOf(s).done = 3;
    const saved = JSON.parse(JSON.stringify(serializeCharacter(s)));
    const back = toCharacter(saved);
    expect(back?.quests?.active.map((a) => a.id)).toEqual([id]);
    expect(back?.quests?.done).toBe(3);
    const fresh = runState(5);
    if (back) applyCharacter(fresh, back);
    expect(fresh.quests?.active[0]?.id).toBe(id);
    expect(toQuests({ active: [{ id: 'junk', progress: 4 }, { id }], done: -4, log: [1, 'x'] })).toEqual({ active: [{ id, progress: 0, stage: 0 }], done: 0, log: ['x'] });
    expect(toQuests(null)).toEqual(newQuests());
  });

  it('is absent from the record of a character that never touched a board', () => {
    expect(serializeCharacter(runState()).quests).toBeUndefined();
  });
});

describe('rewards', () => {
  it('pay stars, a permission once, and potwierdzenia up to the cap', () => {
    const s = runState();
    const got = payReward(s, { stars: 40, permission: 'powiadomienia', potwierdzenia: 2 });
    expect(got).toMatchObject({ stars: 40, permission: 'powiadomienia', potwierdzenia: 2 });
    expect(s.player.permissions).toContain('powiadomienia');
    expect(payReward(s, { stars: 5, permission: 'powiadomienia' }).permission).toBeNull();
    s.player.potwierdzenia = HELD_CAP - 1;
    expect(payReward(s, { stars: 0, potwierdzenia: 3 }).potwierdzenia).toBe(1);
    expect(s.player.potwierdzenia).toBe(HELD_CAP);
  });

  it('are paid once, on the report, and the epoch moves on', () => {
    const s = runState();
    const bus = createBus();
    const seen: string[] = [];
    bus.on('quest:changed', (e) => seen.push(`${e.what}`));
    const def = proceduralOffer(0, 0, 0);
    takeQuest(s, bus, def.id);
    expect(completeQuest(s, bus, def.id)).toBe(false);
    const q = questsOf(s);
    const a = q.active[0];
    if (a) a.progress = def.n;
    const before = s.player.gwiazdki;
    expect(completeQuest(s, bus, def.id)).toBe(true);
    expect(s.player.gwiazdki - before).toBeGreaterThanOrEqual(def.reward.stars);
    expect(completeQuest(s, bus, def.id)).toBe(false);
    expect(q.done).toBe(1);
    expect(q.active).toHaveLength(0);
    expect(seen).toEqual(['accepted', 'done']);
  });
});

describe('on the bus', () => {
  const planetOf = (s: RunState): number => questPlanet(s);

  it('counts kills, finds and pages in the run, not in the base, and prints one note when ready', () => {
    const s = runState();
    const bus = createBus();
    bindQuests(bus, () => s);
    const notes: string[] = [];
    bus.on('footnote', (e) => notes.push(e.text));
    const p = planetOf(s);
    let def: QuestDef | undefined;
    for (let e = 0; e < 40 && !def; e++) for (let slot = 0; slot < 2; slot++) {
      const d = proceduralOffer(p, e, slot);
      if (d.kind === 'fetch') def = d;
    }
    if (!def) throw new Error('no fetch');
    takeQuest(s, bus, def.id);
    s.phase = 'base';
    bus.emit('pickup:taken', { id: 1, number: 1 });
    expect(questsOf(s).active[0]?.progress).toBe(0);
    s.phase = 'run';
    for (let i = 0; i < def.n; i++) bus.emit('pickup:taken', { id: i, number: i });
    expect(isReady(questsOf(s), def.id)).toBe(true);
    expect(notes).toHaveLength(1);
    // a real pickup goes through the same event
    const slip = createPotwierdzeniePickup(nextId(s), s.player.x, s.player.y);
    s.pickups.push(slip);
    expect(takePickup(s, bus, slip)).toBe(true);
  });

  it('hands a parcel over only after it was carried out of the base, and only on the clerk visit', () => {
    const s = runState();
    const bus = createBus();
    bindQuests(bus, () => s);
    const p = planetOf(s);
    let def: QuestDef | undefined;
    for (let e = 0; e < 40 && !def; e++) for (let slot = 0; slot < 2; slot++) {
      const d = proceduralOffer(p, e, slot);
      if (d.kind === 'deliver') def = d;
    }
    if (!def) throw new Error('no deliver');
    takeQuest(s, bus, def.id);
    s.phase = 'base';
    expect(visitClerk(s, bus)).toEqual([]);
    s.phase = 'run';
    bus.emit('page:entered', { index: 0, count: 4 });
    expect(questsOf(s).active[0]?.stage).toBe(1);
    s.phase = 'base';
    expect(visitClerk(s, bus)).toEqual([def.id]);
  });
});
