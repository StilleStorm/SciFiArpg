import { describe, expect, it } from 'vitest';
import { createBus } from '../core/events';
import { createGrid, type Enemy } from '../entities';
import { createEnemy } from '../entities/factory';
import type { HeroId } from '../heroes';
import { createRun, nextId, type RunState } from '../world/run';
import { playerAttacks } from './combat';
import { movePlayer } from './movement';

function run(heroId: HeroId): RunState {
  const s = createRun(5, { heroId });
  s.enemies.length = 0;
  s.projectiles.length = 0;
  s.player.x = 600;
  s.player.y = 800;
  s.player.attackTimer = 0;
  return s;
}

function addEnemy(s: RunState, dx: number, dy = 0): Enemy {
  const e = createEnemy(nextId(s), s.player.x + dx, s.player.y + dy, 1);
  e.hp = e.hpMax = 500;
  s.enemies.push(e);
  return e;
}

/** One attack check the way step.ts does it: a fresh grid of the enemies. */
function attackOnce(s: RunState, bus = createBus()): { hits: number; misses: number } {
  const grid = createGrid<Enemy>(64);
  for (const e of s.enemies) grid.insert(e);
  let hits = 0;
  let misses = 0;
  bus.on('enemy:hit', () => hits++);
  bus.on('enemy:miss', () => misses++);
  playerAttacks(s, grid, bus, 1 / 60);
  return { hits, misses };
}

describe('auto-attack while moving (DESIGN 2)', () => {
  it('a ranged hero fires at the nearest enemy in range while steering', () => {
    for (const hero of ['konsultant', 'petlowiec'] as const) {
      const s = run(hero);
      const near = addEnemy(s, s.player.attackRange * 0.6, 20);
      addEnemy(s, -s.player.attackRange * 0.9);
      s.player.steer = { dx: 0, dy: -1, mag: 1 };
      movePlayer(s, createBus(), 1 / 60);
      expect(s.player.moving, hero).toBe(true);
      attackOnce(s);
      expect(s.projectiles, hero).toHaveLength(1);
      const shot = s.projectiles[0];
      expect(shot?.owner).toBe('player');
      // aimed at the nearer enemy
      const aim = Math.atan2(shot?.vy ?? 0, shot?.vx ?? 0);
      expect(aim).toBeCloseTo(Math.atan2(near.y - s.player.y, near.x - s.player.x), 5);
      expect(s.player.attackTimer).toBeGreaterThan(0);
    }
  });

  it('a melee hero swings while walking past an enemy within reach', () => {
    const s = run('pralka');
    addEnemy(s, s.player.attackRange * 0.7);
    s.player.target = { x: 600, y: 200 };
    movePlayer(s, createBus(), 1 / 60);
    expect(s.player.moving).toBe(true);
    const r = attackOnce(s);
    expect(r.hits + r.misses).toBe(1);
  });

  it('walking to a tap far from enemies does nothing', () => {
    const s = run('kartograf');
    addEnemy(s, s.player.attackRange + 120);
    s.player.target = { x: 100, y: 800 };
    movePlayer(s, createBus(), 1 / 60);
    const r = attackOnce(s);
    expect(s.projectiles).toHaveLength(0);
    expect(r.hits + r.misses).toBe(0);
    expect(s.player.attackTimer).toBe(0);
  });

  it('keeps facing the walking direction when it shoots backwards', () => {
    const s = run('konsultant');
    addEnemy(s, -s.player.attackRange * 0.5);
    s.player.steer = { dx: 1, dy: 0, mag: 1 };
    movePlayer(s, createBus(), 1 / 60);
    attackOnce(s);
    expect(s.projectiles).toHaveLength(1);
    expect(s.player.facing).toBe(1);
  });

  it('standing still still turns toward the target', () => {
    const s = run('pralka');
    s.player.facing = 1;
    addEnemy(s, -s.player.attackRange * 0.5);
    s.player.moving = false;
    attackOnce(s);
    expect(s.player.facing).toBe(-1);
  });
});
