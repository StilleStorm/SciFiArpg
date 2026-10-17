import { describe, expect, it } from 'vitest';
import { createBus, type Bus, type GameEvents } from '../core/events';
import { createSim } from '../systems/step';
import { enterPage, kioskOf, kioskReached, planWaves, populatePage, tapKiosk, tickPageTurn } from './pageTurn';
import { createRun, type RunState } from './run';

function events(bus: Bus, names: (keyof GameEvents)[]): { name: string; payload: unknown }[] {
  const out: { name: string; payload: unknown }[] = [];
  for (const n of names) bus.on(n, ((p: unknown) => out.push({ name: n, payload: p })) as never);
  return out;
}

const run = (seed = 4, lawId: 'parzystosc' | 'grawitacja' | 'weryfikacja-dwuetapowa' = 'grawitacja'): RunState =>
  createRun(seed, { lawId, pageCount: 5 });

describe('population', () => {
  it('plans waves that favour the dominant family and grow with the page', () => {
    const s = run();
    const first = planWaves(s);
    expect(first[0]?.family).toBe(s.ticket.family);
    const total = (w: { count: number }[]): number => w.reduce((a, b) => a + b.count, 0);
    s.pageIndex = 3;
    expect(total(planWaves(s))).toBeGreaterThan(total(first));
    expect((first[0]?.count ?? 0) / total(first)).toBeGreaterThanOrEqual(0.5);
  });

  it('fills a page with enemies, doubled under Parzystosc, and adds the boss on the last page', () => {
    const plain = run(4, 'grawitacja');
    populatePage(plain, createBus());
    const paired = run(4, 'parzystosc');
    populatePage(paired, createBus());
    expect(plain.populate).toBe(false);
    expect(plain.enemies.length).toBeGreaterThan(2);
    expect(paired.enemies.length).toBeGreaterThan(plain.enemies.length);
    expect(plain.enemies.some((e) => e.boss)).toBe(false);

    const last = run(4, 'grawitacja');
    enterPage(last, createBus(), 4);
    populatePage(last, createBus());
    expect(last.enemies.filter((e) => e.boss)).toHaveLength(1);
  });
});

describe('the page turn', () => {
  it('moves to the next page, re-places the player at the entry and clears the old things', () => {
    const s = run();
    const bus = createBus();
    const seen = events(bus, ['page:entered']);
    populatePage(s, bus);
    s.pickups.push({ kind: 'pickup', id: 900, x: 1, y: 1, r: 14, number: 1, item: {} as never });
    const to = s.pages[1];
    expect(to).toBeDefined();
    enterPage(s, bus, 1);
    expect(s.pageIndex).toBe(1);
    expect(s.page).toBe(to);
    expect(s.player.x).toBe(to?.entry.x);
    expect(s.player.y).toBe(to?.entry.y);
    expect(s.enemies).toHaveLength(0);
    expect(s.pickups).toHaveLength(0);
    expect(s.projectiles).toHaveLength(0);
    expect(s.populate).toBe(true);
    expect(seen).toEqual([{ name: 'page:entered', payload: { index: 1, count: 5 } }]);
  });

  it('starts the turn when the player stands in the exit, once', () => {
    const s = run();
    const bus = createBus();
    const turns = events(bus, ['page:turn']);
    s.populate = false;
    tickPageTurn(s, bus);
    expect(turns).toHaveLength(0);
    const e = s.page.exit;
    expect(e).toBeTruthy();
    if (!e) return;
    s.player.x = e.x + (e.corner[1] === 'l' ? 40 : -40);
    s.player.y = e.y + (e.corner[0] === 't' ? 40 : -40);
    tickPageTurn(s, bus);
    expect(s.turning).toBe(true);
    expect(turns).toEqual([{ name: 'page:turn', payload: { from: 0, to: 1 } }]);
    tickPageTurn(s, bus);
    expect(turns).toHaveLength(1);
  });

  it('keeps the exit shut under the two-factor clause until the code is entered', () => {
    const s = run(4, 'weryfikacja-dwuetapowa');
    const bus = createBus();
    const turns = events(bus, ['page:turn']);
    s.populate = false;
    const e = s.page.exit;
    if (!e) throw new Error('no exit');
    s.player.x = e.x + (e.corner[1] === 'l' ? 40 : -40);
    s.player.y = e.y + (e.corner[0] === 't' ? 40 : -40);
    tickPageTurn(s, bus);
    expect(turns).toHaveLength(0);
    expect(s.law.codeAt).not.toBeNull();
    s.law.exitUnlocked = true;
    tickPageTurn(s, bus);
    expect(turns).toHaveLength(1);
  });

  it('walks a run through the sim: stand on the exit, the sim turns the page by itself', () => {
    const s = run();
    const bus = createBus();
    const sim = createSim(bus);
    const turns = events(bus, ['page:turn']);
    sim.step(s, 1 / 60); // populates
    const e = s.page.exit;
    if (!e) throw new Error('no exit');
    s.player.hp = s.player.hpMax = 1e6;
    s.player.x = e.x + (e.corner[1] === 'l' ? 45 : -45);
    s.player.y = e.y + (e.corner[0] === 't' ? 45 : -45);
    sim.step(s, 1 / 60);
    expect(turns).toHaveLength(1);
    expect(s.turning).toBe(true);
    // while the sweep plays the sim is frozen
    const t0 = s.time;
    sim.step(s, 1 / 60);
    expect(s.time).toBe(t0);
  });

  it('closes the run when the boss falls', () => {
    const s = run();
    const bus = createBus();
    const ended = events(bus, ['run:ended']);
    enterPage(s, bus, 4);
    s.populate = false;
    s.victoryAt = s.time + 1;
    s.time += 0.5;
    tickPageTurn(s, bus);
    expect(ended).toHaveLength(0);
    s.time += 0.6;
    tickPageTurn(s, bus);
    tickPageTurn(s, bus);
    expect(ended).toEqual([{ name: 'run:ended', payload: { outcome: 'ukonczono' } }]);
  });
});

describe('the kiosk', () => {
  it('sits on one page, is tapped from afar and reached on arrival', () => {
    const s = run();
    const page = s.pages.find((p) => p.hasKiosk);
    expect(page).toBeTruthy();
    if (!page) return;
    expect(kioskOf(s)).toBeNull();
    enterPage(s, createBus(), page.index);
    const k = kioskOf(s);
    expect(k).toBeTruthy();
    if (!k) return;
    expect(tapKiosk(s, k.x + 500, k.y)).toBe(false);
    expect(tapKiosk(s, k.x + 10, k.y + 10)).toBe(true);
    expect(kioskReached(s)).toBe(false);
    s.player.x = k.x;
    s.player.y = k.y + 100;
    expect(kioskReached(s)).toBe(true);
    expect(kioskReached(s)).toBe(false);
  });
});
