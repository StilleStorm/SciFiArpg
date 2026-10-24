import { describe, expect, it } from 'vitest';
import { createBus } from '../core/events';
import { dist } from '../core/vec';
import { createSim } from '../systems/step';
import { gateHolds, installGate, liftGate, stepGate, teczkiTaken, bindGates, GATE_RADIUS } from './gate';
import { resolveMove } from './pages';
import { createRun } from './run';
import { newQuests } from './quests';

const gated = (kind: 'boss' | 'teczka' | 'quest', id?: string) => {
  const s = createRun(5, { pageCount: 4 });
  const ok = installGate(s.page, { kind, ...(id ? { id } : {}) });
  expect(ok).toBe(true);
  return s;
};

describe('page gates', () => {
  it('a gate puts a barrier of colliders across the exit corner and the player cannot reach the corner', () => {
    const s = gated('teczka');
    const e = s.page.exit;
    if (!e) throw new Error('no exit');
    const o = s.page.obstacles.find((p) => p.kind === 'gate');
    expect(o?.colliders.length).toBeGreaterThanOrEqual(5);
    expect(gateHolds(s, s.page.gate ?? { kind: 'teczka' })).toBe(true);
    // walk from 300 units out straight at the corner: pushed out of the barrier, never inside the exit radius
    const fx = e.corner[1] === 'l' ? 1 : -1;
    const fy = e.corner[0] === 't' ? 1 : -1;
    const pos = { x: e.x + fx * 210, y: e.y + fy * 210 };
    for (let i = 0; i < 400; i++) {
      pos.x += ((e.x - pos.x) / Math.max(1, dist(pos, e))) * 4;
      pos.y += ((e.y - pos.y) / Math.max(1, dist(pos, e))) * 4;
      resolveMove(s.page, pos, 18);
    }
    expect(dist(pos, e)).toBeGreaterThan(100);
    expect(dist(pos, e)).toBeGreaterThan(GATE_RADIUS - 60);
  });

  it('holds while the condition is open, lifts when it holds, and the corner is reachable again', () => {
    const s = gated('quest', 'h:test');
    const g = s.page.gate;
    if (!g) throw new Error('no gate');
    expect(gateHolds(s, g)).toBe(true);
    expect(stepGate(s)).toBeNull(); // far from the corner: no note, no lift
    s.quests = { ...newQuests(), log: ['h:test'] };
    expect(gateHolds(s, g)).toBe(false);
    expect(stepGate(s)).toBe('lifted');
    expect(s.page.gate).toBeUndefined();
    expect(s.page.obstacles.some((o) => o.kind === 'gate')).toBe(false);
  });

  it('a teczka gate lifts once enough teczki are taken', () => {
    const s = createRun(5, { pageCount: 4 });
    installGate(s.page, { kind: 'teczka', need: 1 });
    const g = s.page.gate;
    if (!g) throw new Error('no gate');
    expect(teczkiTaken(s)).toBe(0);
    expect(gateHolds(s, g)).toBe(true);
    const c = { kind: 'teczka' as const, id: 9, x: 300, y: 300, seed: 1, opened: false };
    s.page.content = [...(s.page.content ?? []), c];
    s.pages = [s.page];
    c.opened = true;
    expect(gateHolds(s, g)).toBe(false);
  });

  it('a boss gate lifts when the boss falls; the Asystent names the condition at the corner, not every step', () => {
    const s = gated('boss');
    const bus = createBus();
    bindGates(bus, () => s);
    const e = s.page.exit;
    if (!e) throw new Error('no exit');
    s.player.x = e.x + (e.corner[1] === 'l' ? 180 : -180);
    s.player.y = e.y + (e.corner[0] === 't' ? 180 : -180);
    expect(stepGate(s)).toBe('note');
    expect(stepGate(s)).toBeNull();
    s.time += 20;
    expect(stepGate(s)).toBe('note');
    bus.emit('boss:died', { id: 1, family: 'urzadzenia', x: 0, y: 0 });
    expect(stepGate(s)).toBe('lifted');
    expect(liftGate(s.page)).toBe(false);
  });

  it('a page without an exit (the boss page) takes no gate', () => {
    const s = createRun(5, { pageCount: 3 });
    const last = s.pages[s.pages.length - 1];
    if (!last) throw new Error('no page');
    expect(installGate(last, { kind: 'boss' })).toBe(false);
  });

  it('the page turn stays shut behind a held gate and the simulation writes the footnote', () => {
    const s = gated('quest', 'x');
    const bus = createBus();
    const notes: string[] = [];
    bus.on('footnote', (e) => notes.push(e.text));
    const turns: unknown[] = [];
    bus.on('page:turn', (e) => turns.push(e));
    const sim = createSim(bus);
    const e = s.page.exit;
    if (!e) throw new Error('no exit');
    s.player.x = e.x + (e.corner[1] === 'l' ? 200 : -200);
    s.player.y = e.y + (e.corner[0] === 't' ? 200 : -200);
    s.player.target = { x: e.x, y: e.y };
    for (let i = 0; i < 300; i++) {
      s.enemies.length = 0;
      sim.step(s, 1 / 60);
    }
    expect(turns).toHaveLength(0);
    expect(notes.length).toBeGreaterThanOrEqual(1);
    s.quests = { ...newQuests(), log: ['x'] };
    for (let i = 0; i < 300 && turns.length === 0; i++) {
      s.enemies.length = 0;
      if (!s.player.target) s.player.target = { x: e.x, y: e.y };
      sim.step(s, 1 / 60);
    }
    expect(turns).toHaveLength(1);
  });
});
