import { describe, expect, it } from 'vitest';
import { createBus, type GameEvents } from '../core/events';
import { createGrid, type Enemy } from '../entities';
import { createEnemy } from '../entities/factory';
import { playerAttacks } from '../systems/combat';
import { createRun, nextId, type RunState } from '../world/run';
import { SIGHT_DX, SIGHT_DY } from './auto';
import { heroDef } from './defs';

type Started = GameEvents['attack:started'];

function run(): RunState {
  const s = createRun(5, { heroId: 'kartograf' });
  s.enemies.length = 0;
  s.projectiles.length = 0;
  s.player.x = 600;
  s.player.y = 800;
  s.player.stats.pewnoscSiebie = 1e6; // 95 percent to hit
  return s;
}

function addEnemy(s: RunState, x: number, y: number): Enemy {
  const e = createEnemy(nextId(s), x, y, 1);
  e.hp = e.hpMax = 5000;
  e.stats.upor = 0;
  e.stats.resist = {};
  s.enemies.push(e);
  return e;
}

function shoot(s: RunState) {
  const bus = createBus();
  const started: Started[] = [];
  const hit: number[] = [];
  bus.on('attack:started', (e) => started.push(e));
  bus.on('enemy:hit', (e) => hit.push(e.id));
  const grid = createGrid<Enemy>(64);
  for (const e of s.enemies) grid.insert(e);
  s.player.attackTimer = 0;
  playerAttacks(s, grid, bus, 1 / 60);
  return { started, hit };
}

describe('the Kartograf auto-attack is a hitscan laser', () => {
  it('is declared as one: no projectile, pierce on crit', () => {
    const a = heroDef('kartograf').auto;
    expect(a.hitscan).toBe(true);
    expect(a.pierceOnCrit).toBe(true);
    expect(a.type).toBe('mechaniczny');
  });

  it('lands at once: no projectile flies, the target takes the hit, one attack:started carries the line and the distance', () => {
    const s = run();
    s.player.stats.critChance = 0;
    const target = addEnemy(s, 750, 800);
    let seen: Started | undefined;
    let hits = 0;
    for (let i = 0; i < 20 && hits === 0; i++) {
      const r = shoot(s);
      hits = r.hit.length;
      seen = r.started[0];
      expect(r.started).toHaveLength(1);
    }
    expect(s.projectiles).toHaveLength(0);
    expect(hits).toBe(1);
    expect(target.hp).toBeLessThan(5000);
    expect(seen?.ranged).toBe(true);
    expect(seen?.attacker).toBe('player');
    const laser = seen?.laser;
    expect(laser?.crit).toBe(false);
    expect(laser?.sx).toBeCloseTo(600 + SIGHT_DX, 6);
    expect(laser?.sy).toBeCloseTo(800 - SIGHT_DY, 6);
    // a non-crit line ends on the target; the label is the real distance over ten
    expect(laser?.ex).toBe(750);
    expect(laser?.ey).toBe(800);
    expect(laser?.metres).toBeCloseTo(15, 6);
    expect(s.player.attackTimer).toBeGreaterThan(0);
  });

  it('a plain hit does not pass through: the enemy behind the target is untouched', () => {
    const s = run();
    s.player.stats.critChance = 0;
    addEnemy(s, 750, 800);
    const behind = addEnemy(s, 830, 798);
    for (let i = 0; i < 15; i++) shoot(s);
    expect(behind.hp).toBe(5000);
  });

  it('on a crit the line runs on to the range limit and hits every enemy on it, and nobody off it', () => {
    const s = run();
    s.player.stats.critChance = 1;
    const target = addEnemy(s, 700, 800);
    // two more on the ruled line, past the target, and one well off to the side
    const sx = 600 + SIGHT_DX;
    const sy = 800 - SIGHT_DY;
    const ux = (700 - sx) / Math.hypot(700 - sx, 800 - sy);
    const uy = (800 - sy) / Math.hypot(700 - sx, 800 - sy);
    const along = (d: number) => ({ x: sx + ux * d, y: sy + uy * d });
    const p1 = along(Math.hypot(700 - sx, 800 - sy) + 70);
    const p2 = along(Math.hypot(700 - sx, 800 - sy) + 130);
    const second = addEnemy(s, p1.x, p1.y);
    const third = addEnemy(s, p2.x, p2.y);
    const aside = addEnemy(s, p1.x, p1.y + 70);
    let laser: Started['laser'];
    let all: number[] = [];
    for (let i = 0; i < 40 && !laser?.crit; i++) {
      const r = shoot(s);
      laser = r.started[0]?.laser;
      all = r.hit;
    }
    expect(laser?.crit).toBe(true);
    expect(all).toContain(target.id);
    expect(all).toContain(second.id);
    expect(all).toContain(third.id);
    expect(all).not.toContain(aside.id);
    expect(aside.hp).toBe(5000);
    // the line goes past the target, to the limit of the range, from the instrument
    expect(Math.hypot((laser?.ex ?? 0) - sx, (laser?.ey ?? 0) - sy)).toBeCloseTo(s.player.attackRange, 3);
    expect(laser?.ex).toBeGreaterThan(700);
    // still one announcement per shot and no projectile
    expect(s.projectiles).toHaveLength(0);
  });

  it('claims and rebuttals still apply: a hit of the claim type is a rebuttal and crits', () => {
    const s = run();
    s.player.stats.critChance = 0;
    const e = addEnemy(s, 700, 800);
    e.claim = { textKey: 'enemies.urzadzenia.claim.update', type: 'mechaniczny' };
    let rebutted = false;
    const bus = createBus();
    bus.on('enemy:rebutted', () => (rebutted = true));
    const grid = createGrid<Enemy>(64);
    grid.insert(e);
    for (let i = 0; i < 20 && !rebutted; i++) {
      s.player.attackTimer = 0;
      playerAttacks(s, grid, bus, 1 / 60);
    }
    expect(rebutted).toBe(true);
  });
});
