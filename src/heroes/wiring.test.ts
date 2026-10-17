import { describe, expect, it } from 'vitest';
import { createBus } from '../core/events';
import { createEnemy } from '../entities/factory';
import { knockback, applyDamage } from '../systems/combat';
import { movePlayer } from '../systems/movement';
import { createRun, nextId, type RunState } from '../world/run';
import { skillDamage } from './helpers';
import { castSkill } from './skills';
import { heroStep } from './system';
import type { HeroId } from './index';

function run(heroId: HeroId = 'pralka'): RunState {
  const s = createRun(5, { heroId });
  s.enemies.length = 0;
  return s;
}

function addEnemy(s: RunState, dx: number, dy = 0) {
  const e = createEnemy(nextId(s), s.player.x + dx, s.player.y + dy, 1);
  e.hp = e.hpMax = 500;
  e.stats.resist = { mechaniczny: 0, regulaminowy: 0, egzystencjalny: 0 };
  s.enemies.push(e);
  return e;
}

describe('typed skill damage', () => {
  it('a skill of the claim type is a rebuttal: the bubble is struck and the hit is a crit', () => {
    const s = run('konsultant');
    const bus = createBus();
    const e = addEnemy(s, 60);
    e.claim = { textKey: 'x', type: 'regulaminowy' };
    const hits: boolean[] = [];
    bus.on('enemy:hit', (ev) => hits.push(ev.crit));
    skillDamage(s, bus, e, 'regulaminowy', 1);
    expect(e.claim.struck).toBe(true);
    expect(hits).toEqual([true]);
  });

  it('a skill of another type does not strike the bubble', () => {
    const s = run('konsultant');
    const bus = createBus();
    const e = addEnemy(s, 60);
    e.claim = { textKey: 'x', type: 'mechaniczny' };
    skillDamage(s, bus, e, 'regulaminowy', 1);
    expect(e.claim.struck).not.toBe(true);
  });

  it('existence scales skill damage (Wygenerowane)', () => {
    const s = run('konsultant');
    const bus = createBus();
    const a = addEnemy(s, 60);
    const b = addEnemy(s, 80);
    b.existence = 0.3;
    s.player.stats.dmgMin = s.player.stats.dmgMax = 100;
    s.player.stats.critChance = 0;
    skillDamage(s, bus, a, 'mechaniczny', 1);
    skillDamage(s, bus, b, 'mechaniczny', 1);
    expect(500 - a.hp).toBe(100);
    expect(500 - b.hp).toBe(30);
  });
});

describe('bot hours', () => {
  it('skills do nothing and cost no cooldown', () => {
    const s = run('konsultant');
    const bus = createBus();
    const e = addEnemy(s, 80);
    s.law.botTime = true;
    expect(castSkill(s, bus, 0)).toBe(false);
    expect(s.hero.cd[0]).toBe(0);
    expect(e.hp).toBe(500);
    s.law.botTime = false;
    expect(castSkill(s, bus, 0)).toBe(true);
  });

  it('a skill hit and a flying player projectile deal nothing', () => {
    const s = run('kartograf');
    const bus = createBus();
    const e = addEnemy(s, 60);
    s.law.botTime = true;
    expect(skillDamage(s, bus, e, 'egzystencjalny', 3)).toBe(false);
    s.projectiles.push({ kind: 'projectile', id: nextId(s), x: e.x, y: e.y, r: 8, vx: 0, vy: 0, ttl: 1, damage: 3, damageType: 'mechaniczny', owner: 'player', passed: [] });
    heroStep(s, bus, 1 / 60);
    expect(e.hp).toBe(500);
  });
});

describe('player statuses', () => {
  it('wyciszony blocks a cast and writes one margin note', () => {
    const s = run('konsultant');
    const bus = createBus();
    addEnemy(s, 80);
    const notes: string[] = [];
    bus.on('margin:note', (n) => notes.push(n.text));
    s.player.statuses.push({ kind: 'wyciszony', remaining: 3, source: null });
    expect(castSkill(s, bus, 0)).toBe(false);
    expect(castSkill(s, bus, 1)).toBe(false);
    expect(notes).toHaveLength(1);
  });

  it('zablokowany stops the player, do_weryfikacji halves the walk', () => {
    const bus = createBus();
    const walk = (kind?: 'zablokowany' | 'do_weryfikacji'): number => {
      const s = run('pralka');
      s.player.x = 600;
      s.player.y = 800;
      s.player.target = { x: 900, y: 800 };
      if (kind) s.player.statuses.push({ kind, remaining: 5, source: null });
      for (let i = 0; i < 30; i++) movePlayer(s, bus, 1 / 60);
      return s.player.x - 600;
    };
    const free = walk();
    expect(free).toBeGreaterThan(5);
    expect(walk('do_weryfikacji')).toBeCloseTo(free / 2, 1);
    expect(walk('zablokowany')).toBe(0);
  });
});

describe('knockback', () => {
  it('moves the enemy away by the distance times the law factor', () => {
    const s = run('pralka');
    const e = addEnemy(s, 100);
    const x0 = e.x;
    knockback(s, e, s.player.x, s.player.y, 12);
    expect(e.x - x0).toBeCloseTo(12, 5);
    s.law.knockbackMul = 3;
    const x1 = e.x;
    knockback(s, e, s.player.x, s.player.y, 12);
    expect(e.x - x1).toBeCloseTo(36, 5);
  });

  it('a crit shoves a common enemy, a plain hit does not', () => {
    const s = run('pralka');
    const bus = createBus();
    const e = addEnemy(s, 100);
    const x0 = e.x;
    applyDamage(s, bus, e, 3, false);
    expect(e.x).toBe(x0);
    applyDamage(s, bus, e, 3, true);
    expect(e.x).toBeGreaterThan(x0 + 11);
  });
});
