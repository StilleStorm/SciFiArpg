import { describe, expect, it } from 'vitest';
import { createBus, type Bus, type GameEvents } from '../core/events';
import { createSim } from '../systems/step';
import { giveRandomItem } from '../items/demo';
import { serializeCharacter } from '../save/character';
import { createRun, type RunState } from './run';
import {
  ENTER_R,
  bindTunnel,
  carryPurse,
  closeFor,
  closeTunnel,
  closesOnPage,
  createRunHold,
  fateOfHeldRun,
  isOnHole,
  openTunnel,
  planOpen,
  repairedWithTape,
  stepTunnel,
  tickTunnel,
  type LeaveAction,
  type Tunnel,
} from './tunnel';

function record(bus: Bus): { name: keyof GameEvents; payload: unknown }[] {
  const log: { name: keyof GameEvents; payload: unknown }[] = [];
  for (const name of ['tunnel:opened', 'tunnel:entered', 'tunnel:returned', 'tunnel:closed', 'footnote'] as const) {
    bus.on(name, (payload) => void log.push({ name, payload }));
  }
  return log;
}

describe('opening and replacing', () => {
  it('cuts the hole where the player stands, not yet armed', () => {
    const plan = planOpen(undefined, { x: 120, y: 340 }, 2);
    expect(plan.tunnel).toEqual({ x: 120, y: 340, pageIndex: 2, armed: false });
    expect(plan.replaced).toBeNull();
  });

  it('a second tunnel replaces the first, which is handed back to be closed', () => {
    const first = planOpen(undefined, { x: 10, y: 10 }, 0).tunnel;
    const plan = planOpen(first, { x: 300, y: 200 }, 0);
    expect(plan.replaced).toBe(first);
    expect(plan.tunnel).toMatchObject({ x: 300, y: 200 });
  });
});

describe('walking in', () => {
  const hole: Tunnel = { x: 100, y: 100, pageIndex: 1, armed: true };

  it('the enter distance is 28 units, exclusive', () => {
    expect(ENTER_R).toBe(28);
    expect(isOnHole(hole, { x: 100 + 27.9, y: 100 })).toBe(true);
    expect(isOnHole(hole, { x: 100 + 28, y: 100 })).toBe(false);
    expect(isOnHole(hole, { x: 100 + 19, y: 100 + 19 })).toBe(true);
    expect(isOnHole(hole, { x: 100 + 20, y: 100 + 20 })).toBe(false);
  });

  it('a tunnel cut at the feet does not swallow the player until he has stepped out of it once', () => {
    let tn: Tunnel = planOpen(undefined, { x: 100, y: 100 }, 1).tunnel;
    let r = stepTunnel(tn, { x: 100, y: 100 }, 1);
    expect(r.enter).toBe(false);
    expect(r.tunnel.armed).toBe(false);
    r = stepTunnel(r.tunnel, { x: 110, y: 100 }, 1); // still on it
    expect(r.enter).toBe(false);
    r = stepTunnel(r.tunnel, { x: 140, y: 100 }, 1); // off it: armed
    expect(r.enter).toBe(false);
    expect(r.tunnel.armed).toBe(true);
    tn = r.tunnel;
    expect(stepTunnel(tn, { x: 135, y: 100 }, 1).enter).toBe(false); // near, not on
    expect(stepTunnel(tn, { x: 105, y: 100 }, 1).enter).toBe(true);
  });

  it('a hole on another page never takes the player', () => {
    expect(stepTunnel(hole, { x: 100, y: 100 }, 2)).toEqual({ tunnel: hole, enter: false });
  });
});

describe('what closes a tunnel', () => {
  it('maps every cause to its reason', () => {
    expect(closeFor('open')).toBe('second');
    expect(closeFor('death')).toBe('death');
    expect(closeFor('runEnd')).toBe('end');
    expect(closeFor('abandon')).toBe('end');
    expect(closeFor('pageTurn')).toBe('page');
    expect(closeFor('return')).toBe('return');
  });

  it('a page turn closes it, standing on the same page does not', () => {
    expect(closesOnPage({ pageIndex: 0 }, 1)).toBe(true);
    expect(closesOnPage({ pageIndex: 1 }, 1)).toBe(false);
  });

  it('is repaired with tape when the player is still in the run, rubbed out when the page or the run goes', () => {
    expect(repairedWithTape('return')).toBe(true);
    expect(repairedWithTape('second')).toBe(true);
    expect(repairedWithTape('death')).toBe(true);
    expect(repairedWithTape('end')).toBe(false);
    expect(repairedWithTape('page')).toBe(false);
  });
});

describe('the held run', () => {
  it('comes back as the very same object', () => {
    const hold = createRunHold<RunState>();
    const s = createRun(7);
    expect(hold.held).toBe(false);
    hold.hold(s);
    expect(hold.held).toBe(true);
    expect(hold.peek()).toBe(s);
    expect(hold.take()).toBe(s);
    expect(hold.held).toBe(false);
    expect(hold.take()).toBeNull();
  });

  it('decides what becomes of it', () => {
    const table: Record<LeaveAction, string> = { return: 'continue', settings: 'keep', newTicket: 'settle', resumeBookmark: 'settle', changeHero: 'settle' };
    for (const [action, fate] of Object.entries(table)) {
      expect(fateOfHeldRun(true, action as LeaveAction)).toBe(fate);
      expect(fateOfHeldRun(false, action as LeaveAction)).toBe('none');
    }
  });

  it('holds the world still: no step changes the clock, the enemies or the loot until it continues', () => {
    const bus = createBus();
    const sim = createSim(bus);
    const s = createRun(11);
    for (let i = 0; i < 90; i++) sim.step(s, 1 / 60); // populated, enemies walking
    expect(s.enemies.length).toBeGreaterThan(0);
    const before = JSON.stringify({ time: s.time, enemies: s.enemies.map((e) => [e.id, e.x, e.y, e.hp]), pickups: s.pickups.length, player: [s.player.x, s.player.y] });
    const ids = s.enemies.map((e) => e.id);
    const hold = createRunHold<RunState>();
    s.status = 'paused';
    hold.hold(s);
    for (let i = 0; i < 300; i++) sim.step(s, 1 / 60);
    const back = hold.take();
    expect(back).toBe(s);
    expect(JSON.stringify({ time: s.time, enemies: s.enemies.map((e) => [e.id, e.x, e.y, e.hp]), pickups: s.pickups.length, player: [s.player.x, s.player.y] })).toBe(before);
    s.status = 'running';
    sim.step(s, 1 / 60);
    expect(s.enemies.map((e) => e.id)).toEqual(ids);
    expect(s.time).toBeGreaterThan(JSON.parse(before).time);
  });
});

describe('on a run', () => {
  it('opens, announces, and a second one closes the first', () => {
    const bus = createBus();
    const log = record(bus);
    const s = createRun(3);
    s.player.x = 200;
    s.player.y = 250;
    expect(openTunnel(s, bus)).toBe(true);
    expect(s.tunnel).toEqual({ x: 200, y: 250, pageIndex: 0, armed: false });
    s.player.x = 400;
    expect(openTunnel(s, bus)).toBe(true);
    expect(s.tunnel?.x).toBe(400);
    expect(log.map((l) => l.name)).toEqual(['tunnel:opened', 'tunnel:closed', 'tunnel:opened']);
    expect(log[1]?.payload).toEqual({ reason: 'second' });
  });

  it('cannot be cut while a sheet, a form or a page turn holds the run, or when the player is dead', () => {
    const bus = createBus();
    for (const hold of [(s: RunState) => (s.status = 'paused'), (s: RunState) => (s.modal = 'update'), (s: RunState) => (s.turning = true), (s: RunState) => (s.player.hp = 0)]) {
      const s = createRun(3);
      hold(s);
      expect(openTunnel(s, bus)).toBe(false);
      expect(s.tunnel).toBeUndefined();
    }
  });

  it('tickTunnel arms the hole, then reports the walk-in once', () => {
    const bus = createBus();
    const log = record(bus);
    const s = createRun(3);
    s.player.x = 300;
    s.player.y = 300;
    openTunnel(s, bus);
    tickTunnel(s, bus);
    expect(log.filter((l) => l.name === 'tunnel:entered')).toHaveLength(0);
    s.player.x = 360;
    tickTunnel(s, bus);
    expect(s.tunnel?.armed).toBe(true);
    s.player.x = 310;
    tickTunnel(s, bus);
    expect(log.filter((l) => l.name === 'tunnel:entered')).toHaveLength(1);
  });

  it('does not tick while the run is held or turning', () => {
    const bus = createBus();
    const log = record(bus);
    const s = createRun(3);
    openTunnel(s, bus);
    if (s.tunnel) s.tunnel.armed = true;
    s.status = 'paused';
    tickTunnel(s, bus);
    s.status = 'running';
    s.turning = true;
    tickTunnel(s, bus);
    expect(log.filter((l) => l.name === 'tunnel:entered')).toHaveLength(0);
  });

  it('closes by itself on death, on the end of the run and when the page turns, and says so', () => {
    const cases: { cause: (bus: Bus) => void; reason: string }[] = [
      { cause: (bus) => bus.emit('player:died', { x: 0, y: 0 }), reason: 'death' },
      { cause: (bus) => bus.emit('run:ended', { outcome: 'zgloszenie' }), reason: 'end' },
      { cause: (bus) => bus.emit('page:entered', { index: 1, count: 4 }), reason: 'page' },
    ];
    for (const c of cases) {
      const bus = createBus();
      const s = createRun(3);
      bindTunnel(bus, () => s);
      const log = record(bus);
      openTunnel(s, bus);
      c.cause(bus);
      expect(s.tunnel).toBeUndefined();
      expect(log.filter((l) => l.name === 'tunnel:closed').map((l) => l.payload)).toEqual([{ reason: c.reason }]);
    }
  });

  it('the page of the tunnel being entered again does not close it', () => {
    const bus = createBus();
    const s = createRun(3);
    bindTunnel(bus, () => s);
    openTunnel(s, bus);
    bus.emit('page:entered', { index: 0, count: 4 });
    expect(s.tunnel).toBeDefined();
  });

  it('the Asystent notes the opening and the repair, and only the return', () => {
    const bus = createBus();
    const s = createRun(3);
    bindTunnel(bus, () => s);
    const log = record(bus);
    openTunnel(s, bus);
    closeTunnel(s, bus, 'return');
    openTunnel(s, bus);
    closeTunnel(s, bus, 'second');
    const notes = log.filter((l) => l.name === 'footnote').map((l) => (l.payload as { text: string }).text);
    expect(notes).toEqual(['Stronę przecięto. Koszt naprawy zostanie doliczony.', 'Stronę naprawiono taśmą. Taśma nie jest przezroczysta.', 'Stronę przecięto. Koszt naprawy zostanie doliczony.']);
    expect(closeTunnel(s, bus, 'end')).toBe(false);
  });
});

describe('the purse after a trip to the base', () => {
  it('stays untouched when the base changed nothing', () => {
    const s = createRun(5);
    giveRandomItem(s.player, 1, 'zwykly', 1);
    const bag = s.player.inventory;
    expect(carryPurse(s, serializeCharacter(s))).toBe(false);
    expect(s.player.inventory).toBe(bag);
  });

  it('takes the shop\'s changes into the run and keeps racja', () => {
    const s = createRun(5);
    s.player.hp = Math.max(1, s.player.hpMax - 3);
    const hp = s.player.hp;
    const c = serializeCharacter(s);
    c.gwiazdki = 3;
    c.inventory = [];
    s.player.gwiazdki = 40;
    expect(carryPurse(s, c)).toBe(true);
    expect(s.player.gwiazdki).toBe(3);
    expect(s.player.hp).toBe(hp);
  });

  it('ignores a character of another hero', () => {
    const s = createRun(5);
    const c = serializeCharacter(s);
    c.heroId = 'kartograf';
    c.gwiazdki = 999;
    expect(carryPurse(s, c)).toBe(false);
    expect(s.player.gwiazdki).not.toBe(999);
  });
});
