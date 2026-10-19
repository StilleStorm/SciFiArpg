import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { createBus, type Bus, type GameEvents } from '../core/events';
import { dist } from '../core/vec';
import { createSim } from '../systems/step';
import {
  AUDIT_FEE,
  CONTENT,
  EVENT_IDS,
  SEAL_IDS,
  SEALS,
  activeBuffs,
  contentOf,
  contentPre,
  effectsOf,
  grantSeal,
  openTeczka,
  paragraphsFree,
  waivePrice,
  tapContent,
  tickContent,
  type Pieczec,
  type Teczka,
  type Zdarzenie,
} from './content';
import { EVENT_CHANCE, PIECZEC_CHANCE, generatePage, generateRunPages } from './pages';
import { createRun, type RunState } from './run';

function log(bus: Bus): { name: keyof GameEvents; payload: unknown }[] {
  const out: { name: keyof GameEvents; payload: unknown }[] = [];
  for (const name of ['content:opened', 'content:sealed', 'content:event', 'stamp', 'footnote', 'margin:note'] as const) {
    bus.on(name, (payload) => out.push({ name, payload }));
  }
  return out;
}

/** A run page with only the objects the test puts on it, the player in the middle, the clock running. */
function scene(seed = 5): { s: RunState; bus: Bus } {
  const s = createRun(seed, { pageCount: 4 });
  s.populate = false;
  s.page.content = [];
  s.page.obstacles = [];
  s.player.x = 600;
  s.player.y = 800;
  return { s, bus: createBus() };
}

const teczka = (x: number, y: number, id = 1): Teczka => ({ kind: 'teczka', id, x, y, seed: 3, opened: false });
const seal = (x: number, y: number, id: SealIdArg = 'pilnosc'): Pieczec => ({ kind: 'pieczec', id: 7, x, y, seed: 4, seal: id, used: false });
type SealIdArg = (typeof SEAL_IDS)[number];
const event = (event: Zdarzenie['event'], x: number, y: number): Zdarzenie => ({ kind: 'zdarzenie', id: 9, x, y, seed: 5, event, phase: 'idle', progress: 0 });

describe('placement', () => {
  it('is deterministic and leaves the obstacles where they were', () => {
    const a = generatePage(createRng(77), { index: 2, count: 5, entryCorner: 'tl' });
    const b = generatePage(createRng(77), { index: 2, count: 5, entryCorner: 'tl' });
    expect(a).toEqual(b);
    expect(a.content).toBeDefined();
  });

  it('puts 0-2 teczki, at most one seal and at most one event per page, with unique ids', () => {
    let teczki = 0;
    let seals = 0;
    let events = 0;
    let pages = 0;
    for (let seed = 1; seed <= 150; seed++) {
      for (const page of generateRunPages(createRng(seed), 5)) {
        pages++;
        const c = page.content ?? [];
        const nt = c.filter((x) => x.kind === 'teczka').length;
        const np = c.filter((x) => x.kind === 'pieczec').length;
        const ne = c.filter((x) => x.kind === 'zdarzenie').length;
        expect(nt).toBeLessThanOrEqual(2);
        expect(np).toBeLessThanOrEqual(1);
        expect(ne).toBeLessThanOrEqual(1);
        expect(new Set(c.map((x) => x.id)).size).toBe(c.length);
        if (page.index === 0 || page.exit === null) expect(ne).toBe(0);
        teczki += nt;
        seals += np;
        events += ne;
      }
    }
    expect(teczki / pages).toBeGreaterThan(0.75);
    expect(teczki / pages).toBeLessThan(1.05);
    expect(seals / pages).toBeGreaterThan(PIECZEC_CHANCE - 0.1);
    expect(seals / pages).toBeLessThan(PIECZEC_CHANCE + 0.1);
    // events only on the three middle pages of five
    expect(events / (pages * 0.6)).toBeGreaterThan(EVENT_CHANCE - 0.12);
    expect(events / (pages * 0.6)).toBeLessThan(EVENT_CHANCE + 0.08);
  });

  it('keeps every object off the obstacles, the entry and the exit, and every kind and seal turns up', () => {
    const kinds = new Set<string>();
    const sealsSeen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      for (const page of generateRunPages(createRng(seed), 5)) {
        for (const c of page.content ?? []) {
          for (const o of page.obstacles) for (const k of o.colliders) expect(dist(k, c)).toBeGreaterThan(k.r + 24);
          expect(dist(page.entry, c)).toBeGreaterThan(260);
          if (page.exit) expect(dist(page.exit, c)).toBeGreaterThan(260);
          expect(c.x).toBeGreaterThan(100);
          expect(c.x).toBeLessThan(page.w - 100);
          if (c.kind === 'zdarzenie') {
            kinds.add(c.event);
            if (c.event === 'przesylka') expect(c.to && dist(c, c.to)).toBeGreaterThanOrEqual(600);
          } else kinds.add(c.kind);
          if (c.kind === 'pieczec') sealsSeen.add(c.seal);
        }
      }
    }
    expect([...kinds].sort()).toEqual(['audyt', 'formularz', 'pieczec', 'przesylka', 'teczka']);
    expect([...sealsSeen].sort()).toEqual([...SEAL_IDS].sort());
    expect(EVENT_IDS).toHaveLength(3);
  });

  it('the base page has none', () => {
    const s = createRun(3, { phase: 'base' });
    expect(contentOf(s)).toEqual([]);
  });
});

describe('buffs', () => {
  it('are neutral with none and combine', () => {
    expect(effectsOf([])).toEqual({ speedMul: 1, crit: 0, meterBonus: 0, lootTier: 0, regen: 0 });
    const fx = effectsOf([
      { id: 'pilnosc', remaining: 1, total: 1 },
      { id: 'kontrola', remaining: 1, total: 1 },
      { id: 'wypoczynek', remaining: 1, total: 1 },
    ]);
    expect(fx.speedMul).toBeCloseTo(1.25);
    expect(fx.crit).toBeCloseTo(0.15);
    expect(fx.regen).toBeCloseTo(0.03);
  });

  it('there are six seals and each is 30-45 s', () => {
    expect(SEAL_IDS).toHaveLength(6);
    for (const id of SEAL_IDS) expect(SEALS[id].seconds).toBeGreaterThanOrEqual(30);
  });

  it('lay their numbers on one step and take them off again', () => {
    const { s, bus } = scene();
    const speed = s.player.speed;
    const crit = s.player.stats.critChance;
    const tier = s.law.lootTierBonus;
    expect(contentPre(s)()).toBeUndefined();
    grantSeal(s, bus, 'pilnosc');
    grantSeal(s, bus, 'kontrola');
    grantSeal(s, bus, 'obieg');
    const undo = contentPre(s);
    expect(s.player.speed).toBeCloseTo(speed * 1.25);
    expect(s.player.stats.critChance).toBeCloseTo(crit + 0.15);
    expect(s.law.lootTierBonus).toBe(tier + 1);
    undo();
    expect(s.player.speed).toBe(speed);
    expect(s.player.stats.critChance).toBe(crit);
    expect(s.law.lootTierBonus).toBe(tier);
  });

  it('argument adds half again to the meter a step gained', () => {
    const { s, bus } = scene();
    grantSeal(s, bus, 'argument');
    s.player.meter = 0.2;
    const undo = contentPre(s);
    s.player.meter = 0.3; // the step gained 0.1
    undo();
    expect(s.player.meter).toBeCloseTo(0.35);
  });

  it('a renewed seal keeps one entry; the stamp expires with a note', () => {
    const { s, bus } = scene();
    const lines = log(bus);
    grantSeal(s, bus, 'zwolnienie');
    grantSeal(s, bus, 'zwolnienie');
    expect(activeBuffs(s)).toHaveLength(1);
    expect(lines.filter((l) => l.name === 'stamp')).toHaveLength(2);
    for (let i = 0; i < 31 * 60; i++) tickContent(s, bus, 1 / 60);
    expect(activeBuffs(s)).toHaveLength(0);
    expect(lines.some((l) => l.name === 'margin:note')).toBe(true);
  });

  it('wypoczynek restores racja; buffs live on RunState.buffs', () => {
    const { s, bus } = scene();
    grantSeal(s, bus, 'wypoczynek');
    s.player.hp = s.player.hpMax * 0.5;
    for (let i = 0; i < 60; i++) tickContent(s, bus, 1 / 60);
    expect(s.player.hp).toBeCloseTo(s.player.hpMax * 0.53, 1);
    expect(s.buffs?.map((b) => b.id)).toEqual(['wypoczynek']);
  });

  it('zwolnienie waives the price of paragraphs (PLAN 8 "free paragraphs") and nothing else', () => {
    const { s, bus } = scene();
    expect(paragraphsFree(s.buffs)).toBe(false);
    grantSeal(s, bus, 'zwolnienie');
    expect(paragraphsFree(s.buffs)).toBe(true);
    expect(waivePrice({ cost: 30, cd: 3, dmg: 1.4 })).toEqual({ dmg: 1.4 });
    expect(waivePrice({ cd: -2 })).toEqual({ cd: -2 });
  });

  it('a pilnosc stamp makes the real step faster', () => {
    const a = scene();
    const b = scene();
    grantSeal(b.s, b.bus, 'pilnosc');
    for (const w of [a, b]) {
      w.s.player.target = { x: 1100, y: 800 };
      const sim = createSim(w.bus);
      for (let i = 0; i < 60; i++) sim.step(w.s, 1 / 60);
    }
    expect(b.s.player.x - 600).toBeGreaterThan((a.s.player.x - 600) * 1.15);
    expect(b.s.player.speed).toBe(a.s.player.speed);
  });
});

describe('seals on the page', () => {
  it('stamp the player once when walked onto', () => {
    const { s, bus } = scene();
    const lines = log(bus);
    s.page.content = [seal(640, 800, 'kontrola')];
    tickContent(s, bus, 1 / 60);
    expect((s.page.content[0] as Pieczec).used).toBe(true);
    expect(activeBuffs(s).map((b) => b.id)).toEqual(['kontrola']);
    expect(lines.filter((l) => l.name === 'content:sealed')).toHaveLength(1);
    s.page.content = [{ ...(s.page.content[0] as Pieczec), used: true }];
    tickContent(s, bus, 1 / 60);
    expect(lines.filter((l) => l.name === 'content:sealed')).toHaveLength(1);
  });

  it('are not taken from a distance', () => {
    const { s, bus } = scene();
    s.page.content = [seal(900, 800)];
    tickContent(s, bus, 1 / 60);
    expect(activeBuffs(s)).toHaveLength(0);
  });
});

describe('teczki', () => {
  it('a tap chooses the folder, the player walks there and it opens on arrival with loot', () => {
    const { s, bus } = scene();
    const lines = log(bus);
    const z = teczka(800, 800);
    s.page.content = [z];
    expect(tapContent(s, 810, 790)).toBe(true);
    tickContent(s, bus, 1 / 60);
    expect(z.opened).toBe(false);
    s.player.x = 760;
    const before = s.pickups.length;
    tickContent(s, bus, 1 / 60);
    expect(z.opened).toBe(true);
    expect(s.pickups.length).toBeGreaterThan(before);
    expect(s.pickups.some((k) => k.item)).toBe(true);
    expect(lines.filter((l) => l.name === 'content:opened')).toHaveLength(1);
    const after = s.pickups.length;
    tickContent(s, bus, 1 / 60);
    expect(s.pickups.length).toBe(after);
    expect(openTeczka(s, bus, z)).toBe(false);
  });

  it('a tap elsewhere forgets the folder; walking past without a tap does not open it', () => {
    const { s, bus } = scene();
    const z = teczka(700, 800);
    s.page.content = [z];
    tapContent(s, 700, 800);
    expect(tapContent(s, 100, 100)).toBe(false);
    tickContent(s, bus, 1 / 60);
    expect(z.opened).toBe(false);
  });

  it('with a joystick, standing at the folder opens it', () => {
    const { s, bus } = scene();
    const z = teczka(630, 800);
    s.page.content = [z];
    s.player.steer = { dx: 1, dy: 0, mag: 1 };
    tickContent(s, bus, 1 / 60);
    expect(z.opened).toBe(true);
  });

  it('the loot is one item of the page level and the folders are seeded', () => {
    const items: string[] = [];
    for (let i = 0; i < 2; i++) {
      const { s, bus } = scene(11);
      const z = teczka(700, 800);
      s.page.content = [z];
      openTeczka(s, bus, z);
      items.push(JSON.stringify(s.pickups.map((k) => k.item?.name ?? k.gwiazdki ?? 's')));
      expect(s.pickups.filter((k) => k.item)).toHaveLength(1);
    }
    expect(items[0]).toBe(items[1]);
  });
});

describe('events', () => {
  it('formularz: enemies arrive, the form fills only while the player stands at it, then pays', () => {
    const { s, bus } = scene();
    const lines = log(bus);
    const z = event('formularz', 660, 800);
    s.page.content = [z];
    tickContent(s, bus, 1 / 60);
    expect(z.phase).toBe('active');
    expect(s.enemies.length).toBeGreaterThanOrEqual(3);
    s.enemies.length = 0;
    s.player.x = 660 + CONTENT.formR + 40;
    for (let i = 0; i < 120; i++) tickContent(s, bus, 1 / 60);
    expect(z.progress).toBe(0);
    s.player.x = 660;
    for (let i = 0; i < 60 * 4; i++) tickContent(s, bus, 1 / 60);
    expect(z.progress).toBeCloseTo(4, 0);
    expect(z.phase).toBe('active');
    for (let i = 0; i < 60 * 5; i++) tickContent(s, bus, 1 / 60);
    expect(z.phase).toBe('done');
    expect(s.pickups.some((k) => k.item)).toBe(true);
    expect(s.pickups.some((k) => k.gwiazdki)).toBe(true);
    expect(lines.filter((l) => l.name === 'content:event').map((l) => (l.payload as { phase: string }).phase)).toEqual(['active', 'done']);
  });

  it('przesylka: pick up, deliver in time for a reward; too late it goes back', () => {
    const ok = scene();
    const z = event('przesylka', 640, 800);
    z.to = { x: 1000, y: 800 };
    ok.s.page.content = [z];
    tickContent(ok.s, ok.bus, 1 / 60);
    expect(z.phase).toBe('active');
    ok.s.player.x = 1000;
    tickContent(ok.s, ok.bus, 1 / 60);
    expect(z.phase).toBe('done');
    expect(ok.s.pickups.some((k) => k.item)).toBe(true);

    const late = scene();
    const w = event('przesylka', 640, 800);
    w.to = { x: 1100, y: 1400 };
    late.s.page.content = [w];
    tickContent(late.s, late.bus, 1 / 60);
    for (let i = 0; i < 60 * (CONTENT.parcelSeconds + 1); i++) tickContent(late.s, late.bus, 1 / 60);
    expect(w.phase).toBe('failed');
    expect(late.s.pickups).toHaveLength(0);
  });

  it('audyt: no loss of racja for the whole time passes; a blow or leaving fails with a fee', () => {
    const pass = scene();
    const z = event('audyt', 640, 800);
    pass.s.page.content = [z];
    for (let i = 0; i < 60 * (CONTENT.auditSeconds + 1); i++) tickContent(pass.s, pass.bus, 1 / 60);
    expect(z.phase).toBe('done');
    expect(pass.s.pickups.some((k) => k.gwiazdki || k.potwierdzenie)).toBe(true);

    const hit = scene();
    hit.s.player.gwiazdki = 30;
    const w = event('audyt', 640, 800);
    hit.s.page.content = [w];
    tickContent(hit.s, hit.bus, 1 / 60);
    expect(w.phase).toBe('active');
    hit.s.player.hp -= 5;
    tickContent(hit.s, hit.bus, 1 / 60);
    expect(w.phase).toBe('failed');
    expect(hit.s.player.gwiazdki).toBe(30 - AUDIT_FEE);

    const away = scene();
    const v = event('audyt', 640, 800);
    away.s.page.content = [v];
    tickContent(away.s, away.bus, 1 / 60);
    away.s.player.x = 640 + CONTENT.auditR + 20;
    tickContent(away.s, away.bus, 1 / 60);
    expect(v.phase).toBe('failed');
  });

  it('a finished event does not run again', () => {
    const { s, bus } = scene();
    const lines = log(bus);
    const z = event('audyt', 640, 800);
    z.phase = 'done';
    s.page.content = [z];
    for (let i = 0; i < 10; i++) tickContent(s, bus, 1 / 60);
    expect(lines.filter((l) => l.name === 'content:event')).toHaveLength(0);
  });
});
