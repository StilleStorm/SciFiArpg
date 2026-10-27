/** Przystanki (DESIGN 4.1, S21a): which pages carry a stop, where it stands, registering it, the record, travel to it. */
import { describe, expect, it } from 'vitest';
import { createBus, type Bus, type GameEvents } from '../core/events';
import { dist } from '../core/vec';
import { ilvlFor } from '../items/level';
import { applyCharacter, CHARACTER_VERSION, emptyCharacter, serializeCharacter, toCharacter } from '../save/character';
import { bookmarkOf, toBookmark } from '../save/bookmark';
import { stationAt, stationBox, STATIONS, reachableCells, generateBase, acceptTicket } from './base';
import { CAMPAIGN_LAST, ilvlBase, newCampaign, type CampaignState, type TicketPlan } from './campaign';
import { enterPage } from './pageTurn';
import { createRun, type RunState } from './run';
import {
  cloneStops,
  isOpenPlanet,
  isRegistered,
  planStopTravel,
  recordStop,
  registerStop,
  stopAt,
  stopIndices,
  stopRows,
  tapStop,
  tickStops,
  ticketHasStops,
  toStops,
  withStop,
  STOP_WALK_R,
} from './stops';

const plan = (planet: number, kind: TicketPlan['kind'] = 'campaign'): TicketPlan => ({ kind, planet, priority: 'normalny', lawId: 'parzystosc' });

function log(bus: Bus, names: (keyof GameEvents)[]): { name: keyof GameEvents; payload: unknown }[] {
  const out: { name: keyof GameEvents; payload: unknown }[] = [];
  for (const name of names) bus.on(name, ((p: unknown) => out.push({ name, payload: p })) as never);
  return out;
}

const seeds = (n: number): number[] => Array.from({ length: n }, (_, i) => 17 + i * 7919);

describe('which pages carry a stop', () => {
  it('are 0, 2, 4, ... below the page count', () => {
    expect(stopIndices(1)).toEqual([0]);
    expect(stopIndices(2)).toEqual([0]);
    expect(stopIndices(3)).toEqual([0, 2]);
    expect(stopIndices(4)).toEqual([0, 2]);
    expect(stopIndices(5)).toEqual([0, 2, 4]);
    expect(stopIndices(6)).toEqual([0, 2, 4]);
    expect(stopIndices(7)).toEqual([0, 2, 4, 6]);
  });

  it('are placed on exactly those pages of a campaign, extra or travel ticket on every playable planet, over several page counts', () => {
    const seen = new Set<number>();
    for (const planet of [0, 1, 2]) {
      for (const kind of ['campaign', 'extra', 'travel'] as const) {
        for (const seed of seeds(12)) {
          const s = createRun(seed, { plan: plan(planet, kind) });
          seen.add(s.pageCount);
          const carrying = s.pages.filter((p) => p.stop).map((p) => p.index);
          expect(carrying, `planet ${planet} ${kind} seed ${seed} (${s.pageCount} pages)`).toEqual(stopIndices(s.pageCount));
        }
      }
    }
    expect(seen.size).toBeGreaterThan(1); // more than one page count was exercised
    for (const pages of [3, 5, 6, 7]) {
      const s = createRun(5, { plan: plan(1), pageCount: pages });
      expect(s.pages.filter((p) => p.stop).map((p) => p.index)).toEqual(stopIndices(pages));
    }
  });

  it('are absent from the finale, from a run with no plan and from the base page; a planet past CAMPAIGN_LAST has none', () => {
    const fin = createRun(3, { plan: { kind: 'final', planet: 0, priority: 'normalny', lawId: 'parzystosc' } });
    expect(fin.pages.some((p) => p.stop)).toBe(false);
    expect(createRun(3).pages.some((p) => p.stop)).toBe(false);
    expect(generateBase(3).stop).toBeUndefined();
    expect(ticketHasStops(plan(CAMPAIGN_LAST))).toBe(false);
    expect(ticketHasStops(plan(0, 'final'))).toBe(false);
    expect(ticketHasStops(undefined)).toBe(false);
    expect(ticketHasStops(plan(CAMPAIGN_LAST - 1))).toBe(true);
  });

  it('stand clear of every obstacle, of the entry, of the exit corner and its barrier, and where the player can walk', () => {
    for (const planet of [0, 1, 2]) {
      for (const seed of seeds(10)) {
        const s = createRun(seed, { plan: plan(planet) });
        for (const page of s.pages) {
          const stop = page.stop;
          if (!stop) continue;
          const where = `planet ${planet} seed ${seed} page ${page.index}`;
          for (const o of page.obstacles) for (const c of o.colliders) expect(dist(c, stop), `${where} obstacle ${o.kind}`).toBeGreaterThan(c.r + 30);
          expect(dist(page.entry, stop), `${where} entry`).toBeGreaterThan(150);
          if (page.exit) expect(dist(page.exit, stop), `${where} exit`).toBeGreaterThan(250);
          for (const c of page.content ?? []) expect(dist(c, stop), `${where} content`).toBeGreaterThan(80);
          expect(stop.x).toBeGreaterThan(page.inset + 80);
          expect(stop.x).toBeLessThan(page.w - page.inset - 80);
          expect(stop.y).toBeGreaterThan(200);
          const cells = reachableCells(page, page.entry, 10);
          expect(cells.some((c) => dist(c, stop) <= STOP_WALK_R - 12), `${where} reachable`).toBe(true);
          expect(stop.registered).toBe(false);
        }
      }
    }
  });

  it('do not move anything else on the pages (the same seed gives the same obstacles with or without the plan stops)', () => {
    const a = createRun(41, { plan: plan(1) });
    const b = createRun(41, { plan: plan(1) });
    expect(a.pages.map((p) => p.stop)).toEqual(b.pages.map((p) => p.stop)); // deterministic
    expect(a.pages.map((p) => p.obstacles.length)).toEqual(b.pages.map((p) => p.obstacles.length));
  });
});

describe('registering', () => {
  function stand(s: RunState, index = 0): void {
    enterPage(s, createBus(), index);
    const stop = s.page.stop;
    if (!stop) throw new Error('no stop');
    s.player.x = stop.x;
    s.player.y = stop.y;
  }

  it('walking over a post enters the page on the character, once, with a footnote and a stamp', () => {
    const s = createRun(9, { plan: plan(1), phase: 'run' });
    const bus = createBus();
    const events = log(bus, ['stop:registered', 'footnote', 'stamp']);
    const stop = s.page.stop;
    if (!stop) throw new Error('no stop');
    s.player.x = stop.x + STOP_WALK_R + 30;
    s.player.y = stop.y;
    tickStops(s, bus);
    expect(events).toHaveLength(0);
    s.player.x = stop.x + STOP_WALK_R - 5;
    tickStops(s, bus);
    expect(s.stops).toEqual({ 1: [0] });
    expect(stop.registered).toBe(true);
    expect(events.map((e) => e.name)).toEqual(['stop:registered', 'footnote', 'stamp']);
    expect(events[0]?.payload).toEqual({ planet: 1, index: 0 });
    tickStops(s, bus);
    expect(events).toHaveLength(3); // once
    stand(s, 2);
    tickStops(s, bus);
    expect(s.stops).toEqual({ 1: [0, 2] });
  });

  it('is not done by a tap, nor in the base, nor on a page with no stop', () => {
    const s = createRun(9, { plan: plan(0), phase: 'base' });
    const bus = createBus();
    tickStops(s, bus);
    expect(s.stops).toBeUndefined();
    const r = createRun(9, { plan: plan(0) });
    const stop = r.page.stop;
    if (!stop) throw new Error('no stop');
    expect(tapStop(r, bus, stop.x, stop.y)).toBe(false); // unregistered: just a place to walk to
    expect(registerStop(createRun(9), bus)).toBe(false);
    r.pageIndex = 1;
    r.page = r.pages[1] ?? r.page;
    expect(registerStop(r, bus)).toBe(false); // page 2 carries none
  });

  it('is saved with the character and comes back: the record, the registered posts of the next ticket', () => {
    const s = createRun(9, { plan: plan(2), phase: 'run' });
    expect(registerStop(s, createBus())).toBe(true);
    const saved = serializeCharacter(s);
    expect(saved.stops).toEqual({ 2: [0] });
    expect(saved.version).toBe(CHARACTER_VERSION);
    const again = JSON.parse(JSON.stringify(saved)) as unknown;
    const loaded = toCharacter(again);
    expect(loaded?.stops).toEqual({ 2: [0] });
    // another ticket on the same planet draws the post as registered; another planet does not
    const next = createRun(31, { plan: plan(2), character: loaded ?? undefined });
    expect(next.stops).toEqual({ 2: [0] });
    expect(next.pages[0]?.stop?.registered).toBe(true);
    expect(next.pages[2]?.stop?.registered ?? false).toBe(false);
    const other = createRun(31, { plan: plan(1), character: loaded ?? undefined });
    expect(other.pages[0]?.stop?.registered).toBe(false);
    expect(next.page.stop).toBeDefined();
  });

  it('a record of the older version loads with none, and damaged entries are dropped', () => {
    expect(CHARACTER_VERSION).toBe(2);
    const old = { ...emptyCharacter('pralka'), version: 1 };
    const c = toCharacter(JSON.parse(JSON.stringify(old)));
    expect(c).not.toBeNull();
    expect(c?.stops).toBeUndefined();
    expect(c?.version).toBe(CHARACTER_VERSION);
    const s = createRun(4, { plan: plan(0), character: c ?? undefined });
    expect(s.stops).toBeUndefined();
    expect(toStops({ 0: [4, 2, 2, -1, 3, 'x', 1.5], 1: 'no', 7: [0], 99: [0], [CAMPAIGN_LAST]: [0], 2: [] })).toEqual({ 0: [2, 4] });
    expect(toStops(null)).toEqual({});
    expect(toStops([1])).toEqual({});
    const dirty = toCharacter({ ...emptyCharacter('pralka'), stops: { 0: [0, 0, 2], 1: ['a'] } });
    expect(dirty?.stops).toEqual({ 0: [0, 2] });
  });

  it('applyCharacter copies the record, not the reference', () => {
    const s = createRun(4, { plan: plan(0) });
    const record = { 0: [0, 2] };
    applyCharacter(s, { ...emptyCharacter('pralka'), stops: record });
    expect(s.stops).toEqual(record);
    expect(s.stops).not.toBe(record);
    record[0]?.push(4);
    expect(s.stops).toEqual({ 0: [0, 2] });
  });
});

describe('tapping a stop in a run', () => {
  it('a registered post asks to go back to the base, from a little outside its drawing; an unregistered one does not', () => {
    const s = createRun(12, { plan: plan(0), phase: 'run' });
    const bus = createBus();
    const events = log(bus, ['stop:tapped']);
    const stop = s.page.stop;
    if (!stop) throw new Error('no stop');
    expect(tapStop(s, bus, stop.x, stop.y - 40)).toBe(false);
    registerStop(s, bus);
    expect(tapStop(s, bus, stop.x, stop.y - 40)).toBe(true);
    expect(events).toEqual([{ name: 'stop:tapped', payload: { planet: 0, index: 0 } }]);
    expect(tapStop(s, bus, stop.x + 400, stop.y)).toBe(false);
    // a small zoom grows the target to 44 css px
    expect(stopAt(s.page, stop.x + 40, stop.y - 40, 1)).toBeNull();
    expect(stopAt(s.page, stop.x + 40, stop.y - 40, 0.5)).not.toBeNull();
  });

  it('does nothing in the base', () => {
    const s = createRun(12, { plan: plan(0), phase: 'base' });
    expect(tapStop(s, createBus(), 100, 100)).toBe(false);
  });
});

describe('the stop board', () => {
  const campaign = (patch: Partial<CampaignState>): CampaignState => ({ ...newCampaign(), ...patch });

  it('is a station of every layout with a tap target of at least 44 css px, found by a tap on it', () => {
    expect(STATIONS).toContain('przystanek');
    for (const seed of seeds(12)) {
      const page = generateBase(seed);
      const st = page.base?.stations.find((x) => x.id === 'przystanek');
      if (!st) throw new Error(`no board on ${seed}`);
      for (const zoom of [0.6, 0.75, 1, 1.4]) {
        const b = stationBox(st, zoom);
        expect((b.x1 - b.x0) * zoom).toBeGreaterThanOrEqual(44 - 1e-6);
        expect((b.y1 - b.y0) * zoom).toBeGreaterThanOrEqual(44 - 1e-6);
      }
      expect(stationAt(page, st.x, st.y - 30)?.id).toBe('przystanek');
    }
  });

  it('lists the open planets: the current and the closed ones, never past CAMPAIGN_LAST', () => {
    const fresh = campaign({});
    expect(stopRows(fresh, undefined)).toEqual([{ planet: 0, indices: [] }]);
    const mid = campaign({ current: 2, closed: [0, 1] });
    expect(stopRows(mid, { 0: [4, 0], 1: [2], 2: [0] }).map((r) => [r.planet, r.indices])).toEqual([[0, [0, 4]], [1, [2]], [2, [0]]]);
    const done = campaign({ current: 0, closed: [0, 1, 2], finalTicket: true });
    expect(stopRows(done, undefined).map((r) => r.planet)).toEqual([0, 1, 2]);
    const all = campaign({ current: 0, closed: [0, 1, 2, 3, 4], caseClosed: true });
    expect(stopRows(all, undefined).map((r) => r.planet).every((p) => p < CAMPAIGN_LAST)).toBe(true);
    expect(isOpenPlanet(fresh, 1)).toBe(false);
    expect(isOpenPlanet(all, CAMPAIGN_LAST)).toBe(false);
  });
});

describe('travel to a stop', () => {
  const opts = { priority: 'normalny' as const, level: 1, seed: 77, number: 48500 };

  it('prints the campaign plan on the current planet and a travel plan on another', () => {
    const c: CampaignState = { ...newCampaign(), current: 1, closed: [0] };
    const st = { 0: [0, 2], 1: [2] };
    const here = planStopTravel(c, st, 1, 2, opts);
    expect(here?.plan.kind).toBe('campaign');
    expect(here?.plan.planet).toBe(1);
    const there = planStopTravel(c, st, 0, 2, opts);
    expect(there?.plan.kind).toBe('travel');
    expect(there?.plan.planet).toBe(0);
  });

  it('refuses a stop that is not registered, a planet that is not open, and a planet past CAMPAIGN_LAST', () => {
    const c: CampaignState = { ...newCampaign(), current: 1, closed: [0] };
    expect(planStopTravel(c, { 0: [0] }, 0, 2, opts)).toBeNull();
    expect(planStopTravel(c, undefined, 0, 0, opts)).toBeNull();
    expect(planStopTravel(c, { 2: [0] }, 2, 0, opts)).toBeNull(); // planet 3 is not open yet
    expect(planStopTravel(c, { [CAMPAIGN_LAST]: [0] }, CAMPAIGN_LAST, 0, opts)).toBeNull();
  });

  it('lands on the page with the right planet, the page count at least index + 1, and the item level of that planet and page', () => {
    const c: CampaignState = { ...newCampaign(), current: 2, closed: [0, 1] };
    const st = withStop(withStop(undefined, 0, 0), 1, 4);
    for (const [planet, index] of [[0, 0], [1, 4]] as const) {
      for (const seed of [77, 78, 79, 80, 81, 82]) {
        const trip = planStopTravel(c, st, planet, index, { ...opts, seed });
        if (!trip) throw new Error('no trip');
        expect(trip.bookmark.pageCount).toBeGreaterThanOrEqual(index + 1);
        expect(trip.bookmark.pageIndex).toBe(index);
        expect(toBookmark(JSON.parse(JSON.stringify(trip.bookmark)))).toEqual(trip.bookmark); // survives the save
        const base = createRun(seed, { phase: 'base', resume: trip.bookmark });
        expect(base.plan?.planet).toBe(planet);
        expect(base.pageIndex).toBe(index);
        expect(base.pageCount).toBeGreaterThanOrEqual(index + 1);
        expect(base.ticket.number).toBe(opts.number);
        expect(acceptTicket(base)).toBe(true);
        expect(base.pageIndex).toBe(index);
        const bus = createBus();
        enterPage(base, bus, base.pageIndex); // the walk through the exit
        expect(base.phase).toBe('run');
        expect(base.page.index).toBe(index);
        expect(base.plan?.planet).toBe(planet);
        expect(base.page.stop?.registered ?? false).toBe(false); // this run has not the record; the character's does
        const level = ilvlFor({ planet, priority: trip.plan.priority, pageIndex: index, pageCount: base.pageCount });
        expect(level).toBeGreaterThanOrEqual(ilvlBase(planet));
        expect(level).toBeLessThanOrEqual(ilvlBase(planet) + 2 + 2);
        // the bookmark of the run is the same page
        expect(bookmarkOf(base).pageIndex).toBe(index);
      }
    }
  });

  it('a page beyond the natural count of the planet gets pages enough', () => {
    const c: CampaignState = { ...newCampaign(), current: 0 };
    const trip = planStopTravel(c, { 0: [8] }, 0, 8, opts);
    expect(trip?.bookmark.pageCount).toBe(9);
    const s = createRun(opts.seed, { phase: 'base', resume: trip?.bookmark });
    expect(s.pages).toHaveLength(9);
    expect(s.pages[8]?.stop).toBeDefined();
    expect(s.pages[8]?.exit).toBeNull(); // the last page is the boss page
  });

  it('records a stop for a script, only on an open planet and an even index', () => {
    const s = createRun(5, { plan: plan(0), phase: 'base' });
    s.campaign = { ...newCampaign(), current: 1, closed: [0] };
    const bus = createBus();
    expect(recordStop(s, bus, 0, 2)).toBe(true);
    expect(recordStop(s, bus, 1, 0)).toBe(true);
    expect(recordStop(s, bus, 2, 0)).toBe(false);
    expect(recordStop(s, bus, 0, 3)).toBe(false);
    expect(s.stops).toEqual({ 0: [2], 1: [0] });
    expect(isRegistered(s.stops, 0, 2)).toBe(true);
    expect(cloneStops(s.stops ?? {})).toEqual(s.stops);
  });
});
