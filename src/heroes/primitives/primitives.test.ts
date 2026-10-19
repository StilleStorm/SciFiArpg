/** The primitives library (S1): each primitive on a small, fixed scene. */
import { describe, expect, it } from 'vitest';
import { getStatus, hasStatus } from '../../combat/status';
import { createBus, type Bus } from '../../core/events';
import { createEnemy } from '../../entities/factory';
import type { Enemy } from '../../entities/types';
import { recomputeStats } from '../../items/stats';
import { createRun, nextId, type RunState } from '../../world/run';
import type { HeroId } from '../registry';
import { aoe, buff, cone, cooldownReset, dash, decoy, deferredDamage, echo, forkProjectile, heal, hitscan, line, projectile, pull, push, removeSummon, shield, statusApply, stepDeferred, summon, teleport, zone, type Ctx } from './index';

function scene(heroId: HeroId): { c: Ctx; s: RunState; bus: Bus; events: string[] } {
  const s = createRun(5, { heroId });
  s.enemies.length = 0;
  s.page.obstacles.length = 0;
  s.player.x = 600;
  s.player.y = 800;
  s.player.baseStats.stats.dmgMin = 10;
  s.player.baseStats.stats.dmgMax = 10;
  s.player.baseStats.stats.critChance = 0;
  recomputeStats(s.player);
  s.player.hp = s.player.hpMax = 100;
  const bus = createBus();
  const events: string[] = [];
  for (const name of ['skill:fx', 'summon:expired'] as const) bus.on(name, () => events.push(name));
  return { c: { s, bus }, s, bus, events };
}

function at(s: RunState, dx: number, dy = 0, hp = 5000): Enemy {
  const e = createEnemy(nextId(s), s.player.x + dx, s.player.y + dy, 1);
  e.hp = e.hpMax = hp;
  e.stats.upor = 0;
  e.stats.resist = {};
  s.enemies.push(e);
  return e;
}

describe('movement', () => {
  it('dash starts a dash with the speed length / time and draws a sketch', () => {
    const { c, s, events } = scene('pralka');
    dash(c, { dx: 1, dy: 0, len: 220, time: 0.22, kind: 'dash', drag: 7, rank: 2 });
    expect(s.hero.dash).toEqual({ dx: 1, dy: 0, left: 0.22, speed: 1000, drag: 7, rank: 2 });
    expect(s.hero.roll).toBeNull();
    expect(events).toEqual(['skill:fx']);
  });

  it('dash as a roll clears the auto target and faces the way it rolls', () => {
    const { c, s } = scene('pralka');
    s.player.facing = 1;
    dash(c, { dx: -1, dy: 0, len: 100, time: 0.5, kind: 'roll', rank: 0, face: true });
    expect(s.hero.roll).toMatchObject({ dx: -1, left: 0.5, speed: 200, hit: [] });
    expect(s.player.facing).toBe(-1);
  });

  it('teleport moves the hero, drops the target and keeps the old place for the caller', () => {
    const { c, s, events } = scene('pralka');
    const from = teleport(c, { x: 640, y: 760 });
    expect(from).toEqual({ x: 600, y: 800 });
    expect([s.player.x, s.player.y]).toEqual([640, 760]);
    expect(s.player.target).toBeNull();
    expect(events).toEqual(['skill:fx']);
  });

  it('teleport can be kept inside the page', () => {
    const { c, s } = scene('pralka');
    teleport(c, { x: -500, y: 800, resolve: true });
    expect(s.player.x).toBeGreaterThan(-500);
  });

  it('pull draws an enemy in, never closer than the gap', () => {
    const { c, s } = scene('pralka');
    const e = at(s, 80);
    expect(pull(c, e, s.player, 34, 20)).toBe(34);
    expect(e.x).toBeCloseTo(646, 5);
    expect(pull(c, e, s.player, 100, 20)).toBeCloseTo(26, 5);
    expect(e.x - s.player.x).toBeCloseTo(20, 5);
  });

  it('push jumps along the direction', () => {
    const { c, s } = scene('pralka');
    const e = at(s, 50);
    push(c, e, 1, 0, 40);
    expect(e.x).toBeCloseTo(690, 5);
  });

  it('push in sweep mode covers the whole distance in open ground and stops at the edge of the page', () => {
    const { c, s } = scene('pralka');
    const e = at(s, 50);
    push(c, e, 1, 0, 180, { mode: 'sweep' });
    expect(e.x).toBeCloseTo(830, 5);
    const far = at(s, 50);
    far.x = s.page.w;
    push(c, far, 1, 0, 180, { mode: 'sweep' });
    expect(far.x).toBeLessThan(s.page.w + 1);
  });
});

describe('selection', () => {
  it('aoe selects by distance to the centre and hands each enemy over in order', () => {
    const { c, s } = scene('pralka');
    const a = at(s, 40);
    const b = at(s, -60, 10);
    at(s, 200);
    const seen: number[] = [];
    const hit = aoe(c, { x: s.player.x, y: s.player.y, r: 100, each: (e) => seen.push(e.id) });
    expect(hit).toEqual([a, b]);
    expect(seen).toEqual([a.id, b.id]);
  });

  it('cone takes what is inside the reach and the half angle, the edge of the enemy counted', () => {
    const { c, s } = scene('pralka');
    const inside = at(s, 100, 10);
    at(s, 100, 100); // off the axis
    at(s, -100); // behind
    at(s, 400); // too far
    const edge = at(s, 160 + 5); // beyond reach by less than its radius
    edge.r = 10;
    const hit = cone(c, { x: s.player.x, y: s.player.y, dx: 1, dy: 0, reach: 160, half: (35 * Math.PI) / 180 });
    expect(hit).toEqual([inside, edge]);
  });

  it('line takes what stands on a ruled line, nearest first', () => {
    const { c, s } = scene('pralka');
    const far = at(s, 150, 2);
    const near = at(s, 60, -3);
    at(s, 100, 60);
    at(s, -50);
    const on = line(c, { x: s.player.x, y: s.player.y, dx: 1, dy: 0, reach: 200, half: 6 });
    expect(on.map((x) => x.e)).toEqual([near, far]);
    expect(on[0]?.along).toBeCloseTo(60, 5);
  });

  it('line can leave one enemy out', () => {
    const { c, s } = scene('pralka');
    const a = at(s, 60);
    const b = at(s, 100);
    expect(line(c, { x: s.player.x, y: s.player.y, dx: 1, dy: 0, reach: 200, half: 6, skip: a }).map((x) => x.e)).toEqual([b]);
  });

  it('hitscan hands every enemy on the ray to hit, nearest first, and returns the end of the ray', () => {
    const { c, s } = scene('kartograf');
    const a = at(s, 120);
    const b = at(s, 60);
    const order: number[] = [];
    const end = hitscan(c, { x: s.player.x, y: s.player.y, dx: 1, dy: 0, reach: 260, half: 3, hit: (e) => order.push(e.id) });
    expect(order).toEqual([b.id, a.id]);
    expect(end).toEqual({ x: 860, y: 800 });
  });
});

describe('spawning', () => {
  it('projectile pushes a player projectile that pierces and has not passed anyone', () => {
    const { c, s } = scene('kartograf');
    const pr = projectile(c, { x: 1, y: 2, vx: 3, vy: 4, r: 7, ttl: 0.6, damage: 1, damageType: 'mechaniczny', pierce: 99, bonusPerPass: 0.35 });
    expect(s.projectiles).toEqual([pr]);
    expect(pr).toMatchObject({ owner: 'player', pierce: 99, bonusPerPass: 0.35, passed: [] });
  });

  it('forkProjectile turns a copy of a shot and gives it its own id', () => {
    const { c, s } = scene('petlowiec');
    const pr = projectile(c, { x: 0, y: 0, vx: 100, vy: 0, r: 5, ttl: 1, damage: 1, damageType: 'egzystencjalny', pierce: 0 });
    const f = forkProjectile(c, pr, Math.PI / 2);
    expect(f.id).not.toBe(pr.id);
    expect(f.vx).toBeCloseTo(0, 5);
    expect(f.vy).toBeCloseTo(100, 5);
    expect(s.projectiles).toHaveLength(2);
  });

  it('zone keeps at most `max` zones of its variant, dropping the oldest', () => {
    const { c, s } = scene('kartograf');
    const first = zone(c, { x: 1, y: 1, variant: 'teren', r: 85, ttl: 6, max: 2 });
    const second = zone(c, { x: 2, y: 2, variant: 'teren', r: 85, ttl: 6, max: 2 });
    const third = zone(c, { x: 3, y: 3, variant: 'teren', r: 85, ttl: 6, max: 2 });
    zone(c, { x: 4, y: 4, variant: 'legenda', r: 50, ttl: 6, max: 1 });
    expect(s.zones.filter((z) => z.variant === 'teren')).toEqual([second, third]);
    expect(s.zones).not.toContain(first);
    expect(s.zones).toHaveLength(3);
  });

  it('summon keeps at most `max` of its variant, telling the render layer about each that expires', () => {
    const { c, s, events } = scene('petlowiec');
    const a = summon(c, { variant: 'copy', heroId: 'petlowiec', ttl: 8, x: 10, y: 10, max: 2 });
    const b = summon(c, { variant: 'copy', heroId: 'petlowiec', ttl: 8, x: 20, y: 20, max: 2 });
    const d = summon(c, { variant: 'copy', heroId: 'petlowiec', ttl: 8, x: 30, y: 30, max: 2 });
    expect(s.summons).toEqual([b, d]);
    expect(events).toEqual(['summon:expired']);
    removeSummon(c, a.id); // already gone: nothing happens
    removeSummon(c, b.id);
    expect(s.summons).toEqual([d]);
    expect(events).toEqual(['summon:expired', 'summon:expired']);
  });

  it('summon can be settled inside the page', () => {
    const { c, s } = scene('petlowiec');
    const m = summon(c, { variant: 'copy', heroId: 'petlowiec', ttl: 8, x: -900, y: 800, settle: true });
    expect(m.x).toBeGreaterThan(-900);
    expect(s.summons).toContain(m);
  });

  it('decoy stands where it is told, deals nothing and looks like the hero', () => {
    const { c, s } = scene('kartograf');
    const d = decoy(c, { x: 610, y: 805, ttl: 5 });
    expect(d).toMatchObject({ variant: 'decoy', heroId: s.player.heroId, x: 610, y: 805, ttl: 5, damageMul: 0, r: s.player.r });
    expect(s.summons).toEqual([d]);
  });
});

describe('effects', () => {
  it('statusApply puts a status on every target; touch only refreshes one that would run out', () => {
    const { s } = scene('konsultant');
    const a = at(s, 30);
    const b = at(s, 60);
    statusApply([a, b], { kind: 'zablokowany', seconds: 2, source: 9 });
    expect(getStatus(a, 'zablokowany')?.remaining).toBe(2);
    expect(hasStatus(b, 'zablokowany')).toBe(true);
    statusApply([a], { kind: 'zablokowany', seconds: 1, source: 9, touch: true });
    expect(getStatus(a, 'zablokowany')?.remaining).toBe(2);
    statusApply([a], { kind: 'zablokowany', seconds: 3, source: 9, touch: true });
    expect(getStatus(a, 'zablokowany')?.remaining).toBe(3);
    expect(a.statuses).toHaveLength(1);
  });

  it('buff adds to the base stat, recomputes, and a negative amount takes it back', () => {
    const { c, s } = scene('konsultant');
    buff(c, 'critChance', 0.25);
    expect(s.player.stats.critChance).toBeCloseTo(0.25, 6);
    buff(c, 'critChance', -0.25);
    expect(s.player.stats.critChance).toBeCloseTo(0, 6);
    const upor = s.player.stats.upor;
    buff(c, 'upor', 20);
    expect(s.player.stats.upor).toBe(upor + 20);
  });

  it('heal adds racja up to the maximum, or raises it to at least a value, never lowering it', () => {
    const { c, s } = scene('pralka');
    s.player.hp = 40;
    heal(c, { amount: 30 });
    expect(s.player.hp).toBe(70);
    heal(c, { amount: 100 });
    expect(s.player.hp).toBe(100);
    s.player.hp = 40;
    heal(c, { atLeast: 25 });
    expect(s.player.hp).toBe(40);
    heal(c, { atLeast: 90 });
    expect(s.player.hp).toBe(90);
    heal(c, { atLeast: 900 });
    expect(s.player.hp).toBe(100);
  });

  it('shield soaks for a while', () => {
    const { c, s } = scene('pralka');
    s.time = 3;
    shield(c, 41.6, 5);
    expect(s.player.shield).toBe(42);
    expect(s.hero.shieldUntil).toBe(8);
  });

  it('cooldownReset readies one skill, all of them, or all but one', () => {
    const { c, s } = scene('pralka');
    s.hero.cd = [5, 6, 7, 8, 9];
    cooldownReset(c, 2);
    expect(s.hero.cd).toEqual([5, 6, 0, 8, 9]);
    cooldownReset(c, 'all', 4);
    expect(s.hero.cd).toEqual([0, 0, 0, 0, 9]);
    cooldownReset(c, 'all');
    expect(s.hero.cd).toEqual([0, 0, 0, 0, 0]);
  });
});

describe('deferred damage and echo', () => {
  it('nothing is queued until a skill queues something', () => {
    const { s } = scene('pralka');
    expect(s.hero.deferred).toBeUndefined();
  });

  it('deferredDamage lands once, after its delay, on whoever is there then', () => {
    const { c, s } = scene('petlowiec');
    const e = at(s, 50);
    deferredDamage(c, { delay: 0.8, x: e.x, y: e.y, r: 40, type: 'mechaniczny', mult: 1 });
    stepDeferred(c);
    expect(e.hp).toBe(5000);
    s.time = 0.79;
    stepDeferred(c);
    expect(e.hp).toBe(5000);
    s.time = 0.81;
    stepDeferred(c);
    expect(e.hp).toBe(4990);
    s.time = 5;
    stepDeferred(c);
    expect(e.hp).toBe(4990);
    expect(s.hero.deferred).toEqual([]);
  });

  it('echo repeats the hit, each weaker', () => {
    const { c, s } = scene('petlowiec');
    const e = at(s, 50);
    echo(c, { x: e.x, y: e.y, r: 40, type: 'mechaniczny', mult: 4, times: 3, every: 0.5, decay: 0.5 });
    expect(s.hero.deferred?.map((d) => d.at)).toEqual([0.5, 1, 1.5]);
    expect(s.hero.deferred?.map((d) => d.mult)).toEqual([2, 1, 0.5]);
    const hp: number[] = [];
    for (const t of [0.5, 1, 1.5]) {
      s.time = t;
      stepDeferred(c);
      hp.push(e.hp);
    }
    expect(hp).toEqual([4980, 4970, 4965]);
  });
});
