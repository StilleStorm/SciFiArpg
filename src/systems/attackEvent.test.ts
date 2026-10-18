import { describe, expect, it } from 'vitest';
import { createBus, type GameEvents } from '../core/events';
import { createGrid, type Enemy } from '../entities';
import { createEnemy } from '../entities/factory';
import type { HeroId } from '../heroes';
import { createRun, nextId, type RunState } from '../world/run';
import { attack, enemiesAttack, playerAttacks } from './combat';

type Started = GameEvents['attack:started'];

function run(heroId: HeroId): RunState {
  const s = createRun(5, { heroId });
  s.enemies.length = 0;
  s.projectiles.length = 0;
  s.player.x = 600;
  s.player.y = 800;
  s.player.attackTimer = 0;
  s.law.knockbackMul = 0; // a crit must not push the target out of reach in the middle of a count
  return s;
}

function addEnemy(s: RunState, dx: number, dy = 0): Enemy {
  const e = createEnemy(nextId(s), s.player.x + dx, s.player.y + dy, 1);
  e.hp = e.hpMax = 1e9;
  s.enemies.push(e);
  return e;
}

function watch(bus = createBus()): { bus: ReturnType<typeof createBus>; started: Started[]; hits: number; misses: number } {
  const seen = { bus, started: [] as Started[], hits: 0, misses: 0 };
  bus.on('attack:started', (e) => seen.started.push(e));
  bus.on('enemy:hit', () => seen.hits++);
  bus.on('enemy:miss', () => seen.misses++);
  return seen;
}

describe('attack:started', () => {
  it('a melee hero emits it once per attempt, hit or miss', () => {
    const s = run('pralka');
    const target = addEnemy(s, 30, 10);
    const w = watch();
    const grid = createGrid<Enemy>(64);
    grid.insert(target);
    const attempts = 300;
    for (let i = 0; i < attempts; i++) {
      s.player.attackTimer = 0;
      playerAttacks(s, grid, w.bus, 1 / 60);
    }
    expect(w.started).toHaveLength(attempts);
    expect(w.hits + w.misses).toBe(attempts);
    expect(w.hits).toBeGreaterThan(0);
    expect(w.misses).toBeGreaterThan(0);
    const first = w.started[0];
    expect(first).toEqual({ attackerId: s.player.id, attacker: 'player', x: 600, y: 800, tx: 630, ty: 810, ranged: false });
  });

  it('a ranged hero emits it when the shot leaves the hand, not when it lands', () => {
    for (const hero of ['konsultant', 'petlowiec', 'kartograf'] as const) {
      const s = run(hero);
      const target = addEnemy(s, 60, 0);
      const w = watch();
      const grid = createGrid<Enemy>(64);
      grid.insert(target);
      playerAttacks(s, grid, w.bus, 1 / 60);
      expect(s.projectiles, hero).toHaveLength(1);
      expect(w.started, hero).toHaveLength(1);
      expect(w.started[0]?.ranged, hero).toBe(true);
      expect(w.started[0]?.attacker, hero).toBe('player');
      // the landing is an attack() call from heroes/system.ts: the roll happens, the announcement does not repeat
      for (let i = 0; i < 40; i++) attack(s, w.bus, s.player, target);
      expect(w.hits + w.misses, hero).toBe(40);
      expect(w.started, hero).toHaveLength(1);
    }
  });

  it('an enemy blow emits it once per attempt, hit or miss, with the enemy as the attacker', () => {
    const s = run('pralka');
    s.player.hp = s.player.hpMax = 1e9;
    const e = addEnemy(s, 20);
    const w = watch();
    const attempts = 100;
    for (let i = 0; i < attempts; i++) {
      e.attackTimer = 0;
      enemiesAttack(s, w.bus, 1 / 60);
    }
    expect(w.started).toHaveLength(attempts);
    expect(w.started.every((ev) => ev.attacker === 'enemy' && ev.attackerId === e.id && !ev.ranged)).toBe(true);
    expect(w.started[0]).toMatchObject({ x: e.x, y: e.y, tx: s.player.x, ty: s.player.y });
  });

  it('nothing in range, nothing announced', () => {
    const s = run('pralka');
    const far = addEnemy(s, 500);
    const w = watch();
    const grid = createGrid<Enemy>(64);
    grid.insert(far);
    playerAttacks(s, grid, w.bus, 1 / 60);
    expect(w.started).toHaveLength(0);
  });
});
