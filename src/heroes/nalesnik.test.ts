import { describe, expect, it } from 'vitest';
import { hasStatus, getStatus } from '../combat/status';
import { createBus, type Bus } from '../core/events';
import { createEnemy, createPickup } from '../entities/factory';
import type { Enemy } from '../entities/types';
import { projectileDamageMul, SKIM } from './shield';
import { updateEnemyProjectiles } from '../enemies/projectiles';
import { poolFor } from '../progression/update';
import { createRun, nextId, type RunState } from '../world/run';
import { HEROES, heroDef } from './defs';
import { ORBITA_LENGTH, WNIOSEK_RADIUS, autoRangeOf, dragToAim, previewOf, reachOf, resolveAim } from './aim';
import {
  FLAG_BLOCK_S,
  FLAG_REGEN,
  FLAG_S,
  GRAVITY_R,
  GRAVITY_S,
  GRAVITY_SPEED,
  SATELLITE_R,
  SATELLITE_S,
} from './nalesnik';
import { ROUND_COOLDOWN_S, ROUND_S, ROUND_UPOR, tickRound } from './quirks';
import { castSkill } from './skills';
import { heroStep } from './system';

function run(): RunState {
  const s = createRun(5, { heroId: 'nalesnik' });
  s.enemies.length = 0;
  s.player.x = 600;
  s.player.y = 800;
  s.page.obstacles.length = 0;
  return s;
}

function addEnemy(s: RunState, dx: number, dy = 0, hp = 5000): Enemy {
  const e = createEnemy(nextId(s), s.player.x + dx, s.player.y + dy, 1);
  e.hp = e.hpMax = hp;
  e.stats.upor = 0;
  e.stats.resist = {};
  s.enemies.push(e);
  return e;
}

/** The hero system and the clock, at 60 Hz, as the sim would run them (the enemies stay where the skills put them). */
function tick(s: RunState, bus: Bus, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    s.time += 1 / 60;
    for (const e of s.enemies) for (const st of e.statuses) st.remaining -= 1 / 60;
    for (const e of s.enemies) e.statuses = e.statuses.filter((st) => st.remaining > 0);
    heroStep(s, bus, 1 / 60);
  }
}

describe('Nalesnik, the definition', () => {
  const def = heroDef('nalesnik');

  it('is the fifth hero: tanky between Pralka and Konsultant, the fastest, a short mechanical auto', () => {
    expect(HEROES.map((h) => h.id)).toContain('nalesnik');
    expect(def.racja).toBeLessThan(heroDef('pralka').racja);
    expect(def.racja).toBeGreaterThan(heroDef('konsultant').racja);
    expect(def.speed).toBeGreaterThan(Math.max(...HEROES.filter((h) => h.id !== 'nalesnik').map((h) => h.speed)));
    expect(def.auto.type).toBe('mechaniczny');
    expect(def.auto.projectile).toBe(false);
    expect(def.auto.range).toBeLessThan(80);
  });

  it('has the three skills with the aim modes of the spec', () => {
    expect(def.skills.map((k) => [k.id, k.aim, k.type])).toEqual([
      ['orbita', 'kierunek', 'mechaniczny'],
      ['grawitacja', 'auto', 'egzystencjalny'],
      ['wniosek', 'wskazanie', 'regulaminowy'],
    ]);
  });

  it('has an upgrade pool of 3 skills x 3 ranks and 6 passives', () => {
    const pool = poolFor('nalesnik');
    expect(pool.filter((u) => u.kind === 'skill')).toHaveLength(3);
    expect(pool.filter((u) => u.kind === 'skill').every((u) => u.maxRank === 3)).toBe(true);
    expect(pool.filter((u) => u.kind === 'passive')).toHaveLength(6);
  });

  it('is applied to a fresh run', () => {
    const s = run();
    expect(s.player.heroId).toBe('nalesnik');
    expect(s.player.hpMax).toBe(def.racja);
    expect(s.player.speed).toBe(def.speed);
  });
});

describe('Orbita (kierunek)', () => {
  it('rolls along the aimed line in half a second and strikes everything on it once', () => {
    const s = run();
    const bus = createBus();
    const a = addEnemy(s, 90);
    const b = addEnemy(s, 160, 4);
    const off = addEnemy(s, 120, 90);
    expect(castSkill(s, bus, 0, false, { kind: 'kierunek', dx: 1, dy: 0 })).toBe(true);
    expect(s.hero.roll).not.toBeNull();
    tick(s, bus, 0.6);
    expect(s.hero.roll).toBeNull();
    expect(s.player.x - 600).toBeGreaterThan(ORBITA_LENGTH * 0.9);
    expect(Math.abs(s.player.y - 800)).toBeLessThan(1);
    expect(a.hp).toBeLessThan(5000);
    expect(b.hp).toBeLessThan(5000);
    expect(off.hp).toBe(5000);
  });

  it('a tap uses the auto target, a drag the dragged direction', () => {
    const s = run();
    addEnemy(s, 0, -150);
    const bus = createBus();
    expect(castSkill(s, bus, 0)).toBe(true);
    expect(s.hero.roll?.dy).toBeLessThan(-0.99);
    const s2 = run();
    const sk = heroDef('nalesnik').skills[0];
    const aim = dragToAim('kierunek', { x: 0, y: 0 }, { x: -30, y: 0 }, s2.player, reachOf(s2, sk));
    expect(resolveAim(s2, sk, aim).dx).toBeCloseTo(-1, 6);
    expect(previewOf(s2, sk, aim)?.kind).toBe('arrow');
    expect(reachOf(s2, sk)).toBe(ORBITA_LENGTH);
  });

  it('bounces off the edge of the page instead of leaving it', () => {
    const s = run();
    const bus = createBus();
    s.player.x = s.page.w - 100;
    castSkill(s, bus, 0, false, { kind: 'kierunek', dx: 1, dy: 0 });
    let turned = false;
    for (let i = 0; i < 40; i++) {
      s.time += 1 / 60;
      heroStep(s, bus, 1 / 60);
      if ((s.hero.roll?.dx ?? 1) < 0) turned = true;
      expect(s.player.x).toBeLessThanOrEqual(s.page.w);
    }
    expect(turned).toBe(true);
    expect(s.player.x).toBeLessThan(s.page.w - 100 + 5);
  });

  it('the first enemy hit that survives becomes the satellite: przeczytane with the hero as the source, 3 s on a 70-unit circle', () => {
    const s = run();
    const bus = createBus();
    const weak = addEnemy(s, 60, 0, 1); // dies of the blow: it cannot be the satellite
    const first = addEnemy(s, 120);
    const second = addEnemy(s, 180);
    castSkill(s, bus, 0, false, { kind: 'kierunek', dx: 1, dy: 0 });
    tick(s, bus, 0.55);
    expect(s.enemies).not.toContain(weak);
    expect(s.hero.orbit?.id).toBe(first.id);
    expect(getStatus(first, 'przeczytane')?.source).toBe(s.player.id);
    expect(hasStatus(second, 'przeczytane')).toBe(false);
    // after the ease it goes round at 70 units, and it attacks nothing
    tick(s, bus, 0.5);
    for (let i = 0; i < 60; i++) {
      tick(s, bus, 1 / 60);
      expect(Math.hypot(first.x - s.player.x, first.y - s.player.y)).toBeCloseTo(SATELLITE_R, 0);
      expect(first.attackTimer).toBeGreaterThan(0);
    }
    const before = Math.atan2(first.y - s.player.y, first.x - s.player.x);
    tick(s, bus, 0.25);
    const after = Math.atan2(first.y - s.player.y, first.x - s.player.x);
    expect(after).not.toBeCloseTo(before, 1);
    // gone after three seconds from the catch
    tick(s, bus, SATELLITE_S);
    expect(s.hero.orbit).toBeNull();
  });
});

describe('Grawitacja własna (auto, area)', () => {
  it('pulls enemies and loot within 180 units toward the hero at 120 units per second; the others stay', () => {
    const s = run();
    const bus = createBus();
    const near = addEnemy(s, 150);
    const far = addEnemy(s, 260);
    const loot = createPickup(nextId(s), s.player.x - 140, s.player.y, 1, undefined, 1);
    s.pickups.push(loot);
    const outer = createPickup(nextId(s), s.player.x, s.player.y + 300, 2, undefined, 1);
    s.pickups.push(outer);
    expect(heroDef('nalesnik').skills[1].aim).toBe('auto');
    expect(castSkill(s, bus, 1)).toBe(true);
    expect(s.hero.gravity?.radius).toBe(GRAVITY_R);
    tick(s, bus, 0.5);
    expect(150 - Math.hypot(near.x - s.player.x, near.y - s.player.y)).toBeCloseTo(GRAVITY_SPEED * 0.5, 0);
    expect(140 - Math.hypot(loot.x - s.player.x, loot.y - s.player.y)).toBeCloseTo(GRAVITY_SPEED * 0.5, 0);
    expect(Math.hypot(far.x - s.player.x, far.y - s.player.y)).toBeCloseTo(260, 6);
    expect(outer.y).toBe(s.player.y + 300);
    tick(s, bus, GRAVITY_S);
    expect(s.hero.gravity).toBeNull();
  });

  it('an enemy that reaches the rim takes the egzystencjalny damage once and is slowed (do_weryfikacji)', () => {
    const s = run();
    const bus = createBus();
    const e = addEnemy(s, 100);
    const hits: number[] = [];
    bus.on('enemy:hit', (h) => hits.push(h.amount));
    castSkill(s, bus, 1);
    tick(s, bus, 1.8);
    expect(Math.hypot(e.x - s.player.x, e.y - s.player.y)).toBeLessThan(s.player.r + e.r + 6);
    expect(hits).toHaveLength(1);
    expect(hasStatus(e, 'do_weryfikacji')).toBe(true);
  });

  it('does not move a boss', () => {
    const s = run();
    const bus = createBus();
    const boss = addEnemy(s, 150);
    boss.boss = true;
    castSkill(s, bus, 1);
    tick(s, bus, 1);
    expect(Math.hypot(boss.x - s.player.x, boss.y - s.player.y)).toBeCloseTo(150, 6);
  });
});

describe('Wniosek o status (wskazanie)', () => {
  const at = (x: number, y: number) => ({ kind: 'wskazanie', x, y }) as const;

  it('plants a 120-unit flag for 8 s at the point; one at a time', () => {
    const s = run();
    const bus = createBus();
    const sk = heroDef('nalesnik').skills[2];
    expect(castSkill(s, bus, 2, false, at(700, 800))).toBe(true);
    const z = s.zones.find((x) => x.variant === 'wniosek');
    expect(z).toBeDefined();
    expect([z?.x, z?.y, z?.r, z?.ttl]).toEqual([700, 800, WNIOSEK_RADIUS, FLAG_S]);
    expect(previewOf(s, sk, at(700, 800))).toEqual({ kind: 'circle', x: 700, y: 800, r: WNIOSEK_RADIUS });
    s.hero.cd[2] = 0;
    castSkill(s, bus, 2, false, at(500, 780));
    const flags = s.zones.filter((x) => x.variant === 'wniosek');
    expect(flags).toHaveLength(1);
    expect(flags[0]?.x).toBe(500);
  });

  it('an enemy entering is zablokowany for a second and takes regulaminowy damage once per entry', () => {
    const s = run();
    const bus = createBus();
    castSkill(s, bus, 2, false, at(700, 800));
    const e = addEnemy(s, 400, 0); // far outside
    e.x = 700 + 200;
    e.y = 800;
    const hits: number[] = [];
    bus.on('enemy:hit', (h) => hits.push(h.amount));
    tick(s, bus, 0.2);
    expect(hits).toHaveLength(0);
    e.x = 700 + 100; // steps in
    tick(s, bus, 0.1);
    expect(hits).toHaveLength(1);
    expect(getStatus(e, 'zablokowany')?.remaining).toBeGreaterThan(0.8);
    expect(getStatus(e, 'zablokowany')?.remaining).toBeLessThanOrEqual(FLAG_BLOCK_S);
    tick(s, bus, 1.5); // stays inside: no second blow
    expect(hits).toHaveLength(1);
    e.x = 700 + 300; // leaves ...
    tick(s, bus, 0.1);
    e.x = 700 + 50; // ... and enters again
    tick(s, bus, 0.1);
    expect(hits).toHaveLength(2);
  });

  it('the hero regains 4 racja per second inside the zone, nothing outside', () => {
    const s = run();
    const bus = createBus();
    castSkill(s, bus, 2, false, at(600, 800));
    s.player.hp = 40;
    tick(s, bus, 2);
    expect(s.player.hp).toBeCloseTo(40 + FLAG_REGEN * 2, 1);
    s.player.hp = 40;
    s.player.x = 600 + WNIOSEK_RADIUS + 30;
    tick(s, bus, 2);
    expect(s.player.hp).toBe(40);
  });

  it('the flag is taken down when its time is up', () => {
    const s = run();
    const bus = createBus();
    castSkill(s, bus, 2, false, at(600, 800));
    tick(s, bus, FLAG_S + 0.1);
    expect(s.zones.filter((x) => x.variant === 'wniosek')).toHaveLength(0);
  });

  it('a tap flags the auto target', () => {
    const s = run();
    const bus = createBus();
    addEnemy(s, 100, -60);
    castSkill(s, bus, 2);
    const z = s.zones[0];
    expect([z?.x, z?.y]).toEqual([700, 740]);
    expect(autoRangeOf(s, heroDef('nalesnik').skills[2])).toBe(260);
  });
});

describe('Równowaga hydrostatyczna', () => {
  it('near full racja projectiles do 30 percent less; below 90 percent, nothing', () => {
    const s = run();
    expect(SKIM).toBe(0.7);
    expect(projectileDamageMul(s.player)).toBe(0.7);
    s.player.hp -= 1;
    expect(projectileDamageMul(s.player)).toBe(0.7);
    s.player.hp = s.player.hpMax * 0.9 - 1;
    expect(projectileDamageMul(s.player)).toBe(1);
    expect(projectileDamageMul({ heroId: 'pralka', hp: 10, hpMax: 10 })).toBe(1);
  });

  it('an enemy shot lands for 30 percent less on a Nalesnik at full racja, and in full on the other heroes', () => {
    const shot = (heroId: 'nalesnik' | 'pralka', hurt: number): number => {
      const s = createRun(5, { heroId });
      s.enemies.length = 0;
      s.player.hp -= hurt;
      const before = s.player.hp;
      s.projectiles.push({ kind: 'projectile', id: nextId(s), x: s.player.x, y: s.player.y, r: 5, vx: 0, vy: 0, ttl: 1, damage: 10, damageType: 'mechaniczny', owner: 'enemy' });
      updateEnemyProjectiles(s, createBus(), 1 / 60);
      return before - s.player.hp;
    };
    expect(shot('nalesnik', 0)).toBe(7);
    expect(shot('nalesnik', 15)).toBe(10);
    expect(shot('pralka', 0)).toBe(10);
  });

  it('below a third of racja it rounds up for 5 s: +20 upor, one footnote, and then 20 s before it can again', () => {
    const s = run();
    const bus = createBus();
    const notes: string[] = [];
    bus.on('footnote', (n) => notes.push(n.text));
    const upor = s.player.stats.upor;
    s.player.hp = s.player.hpMax / 3; // exactly a third is not below
    tickRound(s, bus);
    expect(s.player.round).toBeFalsy();
    s.player.hp = s.player.hpMax / 3 - 1;
    tickRound(s, bus);
    expect(s.player.round).toBe(true);
    expect(s.player.stats.upor).toBe(upor + ROUND_UPOR);
    expect(notes).toHaveLength(1);
    tickRound(s, bus);
    expect(notes).toHaveLength(1); // once per trigger
    // it flattens after 5 s and the upor is taken back
    s.time = ROUND_S - 0.01;
    tickRound(s, bus);
    expect(s.player.round).toBe(true);
    s.time = ROUND_S + 0.01;
    tickRound(s, bus);
    expect(s.player.round).toBe(false);
    expect(s.player.stats.upor).toBe(upor);
    // still low, but 20 s have not passed since it began
    s.time = ROUND_COOLDOWN_S - 0.5;
    tickRound(s, bus);
    expect(s.player.round).toBeFalsy();
    s.time = ROUND_COOLDOWN_S + 0.5;
    tickRound(s, bus);
    expect(s.player.round).toBe(true);
    expect(notes).toHaveLength(2);
  });

  it('does nothing for the other heroes', () => {
    const s = createRun(5, { heroId: 'pralka' });
    const bus = createBus();
    s.player.hp = 1;
    tickRound(s, bus);
    expect(s.player.round).toBeFalsy();
  });
});
