/** The fourth and fifth skills (DESIGN 10.1): what each changes on the state, the pad loadout, the repeat of Juz to bylo. */
import { describe, expect, it } from 'vitest';
import { getStatus, hasStatus } from '../combat/status';
import { createBus, type Bus } from '../core/events';
import { createEnemy, createPickup, createSummon } from '../entities/factory';
import type { Enemy } from '../entities/types';
import { recomputeStats } from '../items/stats';
import { applyDamage, killEnemy } from '../systems/combat';
import { createRun, nextId, type RunState } from '../world/run';
import { dragToAim, previewOf, reachOf, radiusOf } from './aim';
import { fireAuto, SIGHT_DX, SIGHT_DY } from './auto';
import { HEROES, heroDef, type HeroDef, type SkillIndex } from './defs';
import { assignPad, fixPads, installedSkills, isInstalled, padOf, padSkill } from './loadout';
import { BEBEN_DAMAGE, BEBEN_KNOCKBACK, KSIEZYC_GAP_S, KSIEZYC_ORBIT, KSIEZYC_S, KSIEZYC_UPOR, NUMER_BONUS, PLYWY_PUSH, READING_UPOR, START_KNOCKBACK } from './numbers';
import { heroById } from './registry';
import { castSkill } from './skills';
import { heroStep } from './system';
import type { HeroId } from './index';

function run(heroId: HeroId): RunState {
  const s = createRun(5, { heroId });
  s.enemies.length = 0;
  s.player.x = 600;
  s.player.y = 800;
  s.page.obstacles.length = 0;
  s.player.baseStats.stats.dmgMin = 10; // the base stats, because a recompute (the upor of a skill) rebuilds the stats from them
  s.player.baseStats.stats.dmgMax = 10;
  s.player.baseStats.stats.critChance = 0;
  recomputeStats(s.player);
  s.player.hp = s.player.hpMax = 1e6;
  return s;
}

/** Install the fourth and fifth skills at rank 1 and put `skill` on pad 0 (the others slide: the pads keep three different skills). */
function install(s: RunState, skill: SkillIndex, rank = 1): void {
  s.hero.ranks[3] = Math.max(s.hero.ranks[3], skill >= 3 ? rank : 0);
  s.hero.ranks[4] = Math.max(s.hero.ranks[4], skill >= 3 ? rank : 0);
  assignPad(s, 0, skill);
}

function addEnemy(s: RunState, dx: number, dy = 0, hp = 5000): Enemy {
  const e = createEnemy(nextId(s), s.player.x + dx, s.player.y + dy, 1);
  e.hp = e.hpMax = hp;
  e.stats.upor = 0;
  e.stats.resist = {};
  e.attackTimer = 999;
  s.enemies.push(e);
  return e;
}

/** The hero system and the clock at 60 Hz; the enemies stay where the skills put them. */
function tick(s: RunState, bus: Bus, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    s.time += 1 / 60;
    for (const e of s.enemies) for (const st of e.statuses) st.remaining -= 1 / 60;
    for (const e of s.enemies) e.statuses = e.statuses.filter((st) => st.remaining > 0);
    heroStep(s, bus, 1 / 60);
  }
}

const hit = (n: number, power = 1): number => Math.max(1, Math.round(10 * n * power));
const east = { kind: 'kierunek', dx: 1, dy: 0 } as const;

describe('the ten new skills are defined and registered', () => {
  it('every skill of every hero has a function, and 4 and 5 ask a permission', () => {
    for (const h of HEROES) {
      for (const sk of h.skills) expect(heroById(h.id).casts[sk.id], sk.id).toBeTypeOf('function');
      expect(h.skills[3].requires).toBeTruthy();
      expect(h.skills[4].requires).toBeTruthy();
    }
  });
});

describe('the pad loadout', () => {
  it('starts with skills 1 2 3; 4 and 5 are not installed until they have a rank', () => {
    const s = run('pralka');
    expect(s.hero.pads).toEqual([0, 1, 2]);
    expect(installedSkills(s)).toEqual([0, 1, 2]);
    expect(isInstalled(s, 3)).toBe(false);
    expect(assignPad(s, 0, 3)).toBe(false);
    expect(s.hero.pads).toEqual([0, 1, 2]);
  });

  it('assigning an installed skill to a pad puts it there; one already on another pad swaps', () => {
    const s = run('pralka');
    s.hero.ranks[3] = 1;
    expect(assignPad(s, 1, 3)).toBe(true);
    expect(s.hero.pads).toEqual([0, 3, 2]);
    expect(padOf(s, 1)).toBeNull();
    expect(assignPad(s, 0, 2)).toBe(true); // 2 was on pad 2: swaps with 0
    expect(s.hero.pads).toEqual([2, 3, 0]);
    expect(assignPad(s, 0, 2)).toBe(false);
    expect(new Set(s.hero.pads).size).toBe(3);
    expect(padSkill(s, 1).id).toBe('beben');
  });

  it('fixPads after a load with a missing skill or a repeat leaves three different installed skills', () => {
    const s = run('konsultant');
    s.hero.pads = [4, 4, 3]; // neither installed, one repeated
    fixPads(s);
    expect(new Set(s.hero.pads).size).toBe(3);
    expect(s.hero.pads.every((i) => isInstalled(s, i))).toBe(true);
    s.hero.ranks[4] = 1;
    s.hero.pads = [4, 0, 4];
    fixPads(s);
    expect(new Set(s.hero.pads).size).toBe(3);
    expect(s.hero.pads[0]).toBe(4);
  });

  it('a pad holding skill 3 fires skill 3, and the cooldown belongs to the skill, not the pad', () => {
    const s = run('pralka');
    install(s, 3);
    addEnemy(s, 80);
    const bus = createBus();
    const casts: unknown[] = [];
    bus.on('skill:cast', (e) => casts.push(e));
    expect(castSkill(s, bus, 0, false, east)).toBe(true);
    expect(casts[0]).toMatchObject({ slot: 0, skill: 3, free: false });
    expect(s.hero.cd[3]).toBeGreaterThan(0);
    expect(s.hero.cd[0]).toBe(0);
    expect(castSkill(s, bus, 0, false, east)).toBe(false); // still cooling
    assignPad(s, 0, 0); // skill 3 goes off the pads, skill 0 comes on pad 0
    expect(castSkill(s, bus, 0)).toBe(true); // skill 0 is ready though it shares a pad with the cooling skill 3
    tick(s, bus, 1);
    expect(s.hero.cd[3]).toBeGreaterThan(8); // a skill off the pads keeps cooling
    expect(s.hero.cd[3]).toBeLessThan(s.hero.cdTotal[3]);
  });

  it('the cooldowns of all five skills run (not only the first three)', () => {
    const s = run('nalesnik');
    s.hero.cd[4] = 2;
    tick(s, createBus(), 1);
    expect(s.hero.cd[4]).toBeCloseTo(1, 1);
  });
});

describe('aim geometry of the new aimed skills', () => {
  it('reaches and radii are the ones of the spec', () => {
    const p = run('pralka');
    expect(reachOf(p, heroDef('pralka').skills[3])).toBe(150);
    const k = run('konsultant');
    expect(reachOf(k, heroDef('konsultant').skills[4])).toBe(220);
    expect(radiusOf(k, heroDef('konsultant').skills[3])).toBe(14);
    const l = run('petlowiec');
    expect(radiusOf(l, heroDef('petlowiec').skills[4])).toBe(90);
    const g = run('kartograf');
    expect(radiusOf(g, heroDef('kartograf').skills[4])).toBe(130);
    const n = run('nalesnik');
    expect(reachOf(n, heroDef('nalesnik').skills[4])).toBe(KSIEZYC_ORBIT);
  });

  it('a drag gives an arrow for kierunek and a circle for wskazanie', () => {
    const s = run('petlowiec');
    const sk = heroDef('petlowiec').skills[4];
    const aim = dragToAim('wskazanie', { x: 0, y: 0 }, { x: 40, y: 0 }, s.player, reachOf(s, sk));
    expect(previewOf(s, sk, aim)).toMatchObject({ kind: 'circle', r: 90 });
    const s2 = run('pralka');
    expect(previewOf(s2, heroDef('pralka').skills[3], { kind: 'kierunek', dx: 0, dy: 1 })?.kind).toBe('arrow');
  });
});

describe('Pralka', () => {
  it('Otwarcie bebna: the cone strikes 1.3x, pushes 40 along it and sets do_weryfikacji; outside the cone nothing happens', () => {
    const s = run('pralka');
    install(s, 3);
    const inside = addEnemy(s, 100, 10);
    const behind = addEnemy(s, -100);
    const wide = addEnemy(s, 60, 90); // about 56 degrees off
    const far = addEnemy(s, 220);
    const bus = createBus();
    expect(castSkill(s, bus, 0, false, east)).toBe(true);
    expect(5000 - inside.hp).toBe(hit(BEBEN_DAMAGE, 1.25));
    expect(inside.x).toBeCloseTo(700 + BEBEN_KNOCKBACK, 3);
    expect(getStatus(inside, 'do_weryfikacji')?.remaining).toBeGreaterThan(3);
    for (const e of [behind, wide, far]) {
      expect(e.hp).toBe(5000);
      expect(hasStatus(e, 'do_weryfikacji')).toBe(false);
    }
  });

  it('Otwarcie bebna with nobody in the cone does nothing and costs no cooldown', () => {
    const s = run('pralka');
    install(s, 3);
    addEnemy(s, -100);
    expect(castSkill(s, createBus(), 0, false, east)).toBe(false);
    expect(s.hero.cd[3]).toBe(0);
  });

  it('Wniosek o osobowosc: 6 s of reading: +20 upor, damage to those within 140 each half second, existence 0.5, then it ends', () => {
    const s = run('pralka');
    install(s, 4);
    const near = addEnemy(s, 100);
    const far = addEnemy(s, 260);
    const gen = addEnemy(s, 60, 60);
    gen.existence = 1;
    const upor = s.player.stats.upor;
    const bus = createBus();
    const notes: string[] = [];
    bus.on('footnote', (e) => notes.push(e.text));
    expect(castSkill(s, bus, 0)).toBe(true);
    expect(s.hero.reading).not.toBeNull();
    expect(s.player.stats.upor).toBe(upor + READING_UPOR);
    expect(notes).toHaveLength(1);
    tick(s, bus, 2.1);
    // 0.35 x 10 x 1.25 per second, four ticks of a half second: each rolls 10 x 0.175 x 1.25 = 2.19 -> 2
    expect(5000 - near.hp).toBe(4 * hit(0.35 * 0.5, 1.25));
    expect(far.hp).toBe(5000);
    expect(gen.existence).toBeLessThanOrEqual(0.5);
    tick(s, bus, 5);
    expect(s.hero.reading).toBeNull();
    expect(s.player.stats.upor).toBe(upor);
    const after = near.hp;
    tick(s, bus, 1);
    expect(near.hp).toBe(after);
    s.hero.cd[4] = 0;
    castSkill(s, bus, 0);
    expect(notes).toHaveLength(1); // the application number is printed on the first cast only
  });
});

describe('Konsultant', () => {
  it('Numer sprawy: a stamp (0.5x), then +35% on every hit for 6 s; a zone follows the target', () => {
    const s = run('konsultant');
    install(s, 3);
    const e = addEnemy(s, 120);
    const other = addEnemy(s, 200);
    const bus = createBus();
    tick(s, bus, 0.05); // the hero system listens for the bonus
    expect(castSkill(s, bus, 0, false, { kind: 'wskazanie', x: e.x, y: e.y })).toBe(true);
    expect(5000 - e.hp).toBe(hit(0.5, 1.25));
    expect(s.hero.numer?.id).toBe(e.id);
    const zone = s.zones.find((z) => z.variant === 'numer');
    expect(zone?.follow).toBe(e.id);
    expect(zone?.number).toBeGreaterThanOrEqual(1000);
    const before = e.hp;
    applyDamage(s, bus, e, 100, false, 'mechaniczny');
    expect(before - e.hp).toBeCloseTo(100 * (1 + NUMER_BONUS), 6);
    const o = other.hp;
    applyDamage(s, bus, other, 100, false, 'mechaniczny');
    expect(o - other.hp).toBe(100);
    tick(s, bus, 7);
    expect(s.hero.numer).toBeNull();
    expect(s.zones.some((z) => z.variant === 'numer')).toBe(false);
    const late = e.hp;
    applyDamage(s, bus, e, 100, false, 'mechaniczny');
    expect(late - e.hp).toBe(100);
  });

  it('a numbered enemy that dies of the bonus dies the usual way', () => {
    const s = run('konsultant');
    install(s, 3);
    const e = addEnemy(s, 120, 0, 5000);
    const bus = createBus();
    const died: number[] = [];
    bus.on('enemy:died', (ev) => died.push(ev.id));
    tick(s, bus, 0.05);
    castSkill(s, bus, 0, false, { kind: 'wskazanie', x: e.x, y: e.y });
    e.hp = 120; // 100 x 1.35 = 135 is enough
    applyDamage(s, bus, e, 100, false, 'mechaniczny');
    expect(s.enemies.includes(e)).toBe(false);
    expect(died).toEqual([e.id]);
  });

  it('the number is handed to the nearest enemy within 160 when it dies, at most three times, with the time that remains', () => {
    const s = run('konsultant');
    install(s, 3);
    const first = addEnemy(s, 120);
    const b = addEnemy(s, 120, 80);
    const c = addEnemy(s, 120, 150);
    const d = addEnemy(s, 120, 220);
    const far = addEnemy(s, 120, 800);
    const bus = createBus();
    expect(castSkill(s, bus, 0, false, { kind: 'wskazanie', x: first.x, y: first.y })).toBe(true);
    const until = s.hero.numer?.until ?? 0;
    const number = s.hero.numer?.number;
    killEnemy(s, bus, first);
    tick(s, bus, 0.1);
    expect(s.hero.numer).toMatchObject({ id: b.id, handovers: 1, until, number });
    expect(s.zones.find((z) => z.variant === 'numer')?.follow).toBe(b.id);
    killEnemy(s, bus, b);
    tick(s, bus, 0.1);
    expect(s.hero.numer).toMatchObject({ id: c.id, handovers: 2 });
    killEnemy(s, bus, c);
    tick(s, bus, 0.1);
    expect(s.hero.numer).toMatchObject({ id: d.id, handovers: 3 });
    killEnemy(s, bus, d);
    tick(s, bus, 0.1);
    expect(s.hero.numer).toBeNull(); // the fourth death: no more handovers
    expect(far.hp).toBe(5000);
    expect(s.zones.some((z) => z.variant === 'numer')).toBe(false);
  });

  it('with nobody within 160 of where it died the number is gone', () => {
    const s = run('konsultant');
    install(s, 3);
    const e = addEnemy(s, 120);
    addEnemy(s, 120, 400);
    const bus = createBus();
    castSkill(s, bus, 0, false, { kind: 'wskazanie', x: e.x, y: e.y });
    killEnemy(s, bus, e);
    tick(s, bus, 0.1);
    expect(s.hero.numer).toBeNull();
  });

  it('Rozlaczenie: the first enemy on the line is thrown 180 further and zablokowany 2 s; others stay', () => {
    const s = run('konsultant');
    install(s, 4);
    const first = addEnemy(s, 100, 3);
    const behind = addEnemy(s, 180, 0);
    const off = addEnemy(s, 100, 80);
    const bus = createBus();
    expect(castSkill(s, bus, 0, false, east)).toBe(true);
    expect(first.x).toBeCloseTo(700 + 180 * 1.12, 0); // the throw grows with the rank's area
    expect(5000 - first.hp).toBe(hit(1, 1.25));
    expect(getStatus(first, 'zablokowany')?.remaining).toBeGreaterThanOrEqual(2);
    expect(behind.hp).toBe(5000);
    expect(off.x).toBe(700);
    expect(hasStatus(behind, 'zablokowany')).toBe(false);
  });

  it('Rozlaczenie: the throw stops at an obstacle', () => {
    const s = run('konsultant');
    install(s, 4);
    const e = addEnemy(s, 100);
    s.page.obstacles.push({ kind: 'blot', x: 850, y: 800, size: 20, rot: 0, seed: 1, colliders: [{ x: 850, y: 800, r: 20 }] });
    castSkill(s, createBus(), 0, false, east);
    expect(e.x).toBeLessThan(850 - 20 - e.r + 1);
    expect(e.x).toBeGreaterThan(700);
  });

  it('Rozlaczenie: below 25% racja the call drops, the enemy dies (normal death), and it is not thrown', () => {
    const s = run('konsultant');
    install(s, 4);
    const weak = addEnemy(s, 100, 0, 100);
    weak.hp = 20;
    const bus = createBus();
    const died: number[] = [];
    bus.on('enemy:died', (ev) => died.push(ev.id));
    expect(castSkill(s, bus, 0, false, east)).toBe(true);
    expect(s.enemies.includes(weak)).toBe(false);
    expect(died).toEqual([weak.id]);
    expect(s.kills).toBe(1);
  });

  it('Rozlaczenie with nobody on the line does nothing', () => {
    const s = run('konsultant');
    install(s, 4);
    addEnemy(s, 100, 120);
    expect(castSkill(s, createBus(), 0, false, east)).toBe(false);
    expect(s.hero.cd[4]).toBe(0);
  });
});

describe('Petlowiec', () => {
  it('Juz to bylo with nothing to repeat: three pointed remarks at once', () => {
    const s = run('petlowiec');
    install(s, 3);
    addEnemy(s, 90);
    const bus = createBus();
    expect(castSkill(s, bus, 0)).toBe(true);
    expect(s.projectiles.filter((p) => p.owner === 'player')).toHaveLength(3);
    const ys = s.projectiles.map((p) => Math.sign(Math.round(p.vy)));
    expect(new Set(ys).size).toBe(3); // one level, one up, one down
    expect(s.hero.lastCast).toBeNull(); // Juz to bylo is never the thing that is repeated
  });

  it('Juz to bylo repeats the last skill for free with its last aim, and does not overwrite it', () => {
    const s = run('petlowiec');
    install(s, 3); // pads: Juz to bylo, Spor, Petla
    const a = addEnemy(s, 0, -60);
    const bus = createBus();
    const casts: { skill: number; free: boolean }[] = [];
    bus.on('skill:cast', (e) => casts.push({ skill: e.skill, free: e.free }));
    expect(castSkill(s, bus, 1)).toBe(true); // Spor: an area round the hero (solo)
    expect(s.hero.lastCast?.skill).toBe(1);
    const afterSpor = a.hp;
    expect(afterSpor).toBeLessThan(5000);
    const cdSpor = s.hero.cd[1];
    expect(castSkill(s, bus, 0)).toBe(true);
    expect(casts.map((c) => [c.skill, c.free])).toEqual([[1, false], [1, true], [3, false]]);
    expect(a.hp).toBeLessThan(afterSpor);
    expect(s.hero.cd[1]).toBe(cdSpor); // a free cast starts no cooldown
    expect(s.hero.lastCast?.skill).toBe(1);
  });

  it('every live copy casts it from its own place; a skill a copy cannot cast is skipped', () => {
    const s = run('petlowiec');
    install(s, 3);
    // the last cast is Spor: a ring round every copy (skills.ts), so the copy's enemy is hit once by Spor itself and once by the repeat
    const copy = createSummon(nextId(s), 600, 1000, { variant: 'copy', heroId: 'petlowiec', ttl: 8 });
    s.summons.push(copy);
    const nearCopy = addEnemy(s, 20, 200);
    const bus = createBus();
    s.hero.lastCast = { skill: 1, aim: { kind: 'auto' } };
    const px = s.player.x;
    castSkill(s, bus, 0);
    expect(nearCopy.hp).toBeLessThan(5000);
    expect(s.player.x).toBe(px); // the hero was put back
    expect(s.player.y).toBe(800);
    // Przybycie cannot be cast by a copy: the repeat makes one more copy (the hero's own) but the copy casts nothing
    const s2 = run('petlowiec');
    install(s2, 3);
    s2.summons.push(createSummon(nextId(s2), 650, 800, { variant: 'copy', heroId: 'petlowiec', ttl: 8 }));
    s2.hero.lastCast = { skill: 0, aim: { kind: 'auto' } };
    castSkill(s2, bus, 0);
    expect(s2.summons.filter((m) => m.variant === 'copy')).toHaveLength(2);
  });

  it('Juz to bylo repeats a point skill at the same point', () => {
    const s = run('petlowiec');
    install(s, 4);
    assignPad(s, 1, 4);
    const bus = createBus();
    const target = addEnemy(s, 150, 0);
    castSkill(s, bus, 1, false, { kind: 'wskazanie', x: 750, y: 800 });
    expect(s.hero.lastCast).toMatchObject({ skill: 4, aim: { kind: 'wskazanie', x: 750, y: 800 } });
    expect(s.zones.filter((z) => z.variant === 'start')).toHaveLength(1);
    assignPad(s, 0, 3);
    castSkill(s, bus, 0);
    const zones = s.zones.filter((z) => z.variant === 'start');
    expect(zones).toHaveLength(2);
    expect(zones.every((z) => z.x === 750 && z.y === 800)).toBe(true);
    void target;
  });

  it('Odlozony start: a countdown circle, then 2.0x in the circle, a push of 60 and przeczytane toward the player for 2 s', () => {
    const s = run('petlowiec');
    install(s, 4);
    const inside = addEnemy(s, 150, 40);
    const edge = addEnemy(s, 150, 85);
    const outside = addEnemy(s, 150, 200);
    const bus = createBus();
    expect(castSkill(s, bus, 0, false, { kind: 'wskazanie', x: 750, y: 800 })).toBe(true);
    const zone = s.zones.find((z) => z.variant === 'start');
    expect(zone).toMatchObject({ x: 750, y: 800, r: 90 * 1.12 });
    expect(zone?.ttl).toBeCloseTo(0.8, 6);
    tick(s, bus, 0.7);
    expect(inside.hp).toBe(5000);
    tick(s, bus, 0.2);
    expect(s.zones.some((z) => z.variant === 'start')).toBe(false);
    expect(5000 - inside.hp).toBe(hit(2, 1.25));
    expect(Math.hypot(inside.x - 750, inside.y - 800)).toBeCloseTo(40 + START_KNOCKBACK, 3);
    expect(5000 - edge.hp).toBe(hit(2, 1.25));
    const st = getStatus(inside, 'przeczytane');
    expect(st?.source).toBe(s.player.id);
    expect(st?.remaining).toBeGreaterThan(1.7);
    expect(outside.hp).toBe(5000);
  });
});

describe('Kartograf', () => {
  it('Skala 1:1: the auto range is 60% longer for 5 s and then back', () => {
    const s = run('kartograf');
    install(s, 3);
    const range = s.player.attackRange;
    const bus = createBus();
    expect(castSkill(s, bus, 0)).toBe(true);
    expect(s.player.attackRange).toBeCloseTo(range * 1.6, 6);
    tick(s, bus, 3);
    expect(s.player.attackRange).toBeCloseTo(range * 1.6, 6);
    tick(s, bus, 3.5);
    expect(s.player.attackRange).toBe(range);
    expect(s.hero.scale).toBeNull();
  });

  it('Skala 1:1: every laser pierces as if it had crit and marks what it crosses do_weryfikacji 1.5 s', () => {
    const plain = run('kartograf');
    const bus = createBus();
    // on the line from the range pole's sight through the first enemy
    const line = (s: RunState): Enemy[] => {
      const out = [addEnemy(s, 90)];
      const ux = 90 - SIGHT_DX;
      const uy = SIGHT_DY;
      const len = Math.hypot(ux, uy);
      for (const k of [1, 2]) out.push(addEnemy(s, 90 + (ux / len) * 55 * k, (uy / len) * 55 * k));
      return out;
    };
    const a = line(plain);
    const first = a[0];
    if (!first) throw new Error('no enemy');
    fireAuto(plain, plain.player, first, bus);
    expect(a.slice(1).every((e) => !hasStatus(e, 'do_weryfikacji'))).toBe(true);

    const s = run('kartograf');
    install(s, 3);
    castSkill(s, bus, 0);
    const b = line(s);
    const target = b[0];
    if (!target) throw new Error('no enemy');
    s.player.attackTimer = 0;
    fireAuto(s, s.player, target, bus);
    for (const e of b) {
      const st = getStatus(e, 'do_weryfikacji');
      expect(st).toBeDefined();
      expect(st?.remaining).toBeGreaterThan(1.4);
    }
  });

  it('Legenda: a zone of 130 for 4 s; each enemy entering gets one wrong name, przeczytane toward the player and 0.35x per second', () => {
    const s = run('kartograf');
    install(s, 4);
    const inside = [addEnemy(s, 150, 0), addEnemy(s, 190, 10), addEnemy(s, 150, 50)];
    const outside = addEnemy(s, 150, 220);
    const bus = createBus();
    const notes: string[] = [];
    bus.on('margin:note', (e) => notes.push(e.text));
    expect(castSkill(s, bus, 0, false, { kind: 'wskazanie', x: 750, y: 800 })).toBe(true);
    const zone = s.zones.find((z) => z.variant === 'legenda');
    expect(zone).toMatchObject({ x: 750, y: 800, r: 130 * 1.12 });
    expect(zone?.ttl).toBeCloseTo(4 * 1.15, 6);
    tick(s, bus, 2.1);
    expect(notes).toHaveLength(3);
    expect(new Set(notes).size).toBe(3);
    for (const e of inside) {
      expect(getStatus(e, 'przeczytane')?.source).toBe(s.player.id);
      expect(5000 - e.hp).toBe(4 * hit(0.35 * 0.5, 1.25));
    }
    expect(outside.hp).toBe(5000);
    expect(hasStatus(outside, 'przeczytane')).toBe(false);
    tick(s, bus, 3);
    expect(notes).toHaveLength(3); // nobody is named twice
    expect(s.zones.some((z) => z.variant === 'legenda')).toBe(false);
  });

  it('Legenda has six names and uses each at most once per cast', () => {
    const s = run('kartograf');
    install(s, 4);
    for (let i = 0; i < 8; i++) addEnemy(s, 150 + (i % 4) * 20, (Math.floor(i / 4) - 0.5) * 40);
    const bus = createBus();
    const notes: string[] = [];
    bus.on('margin:note', (e) => notes.push(e.text));
    castSkill(s, bus, 0, false, { kind: 'wskazanie', x: 750, y: 800 });
    tick(s, bus, 0.2);
    expect(notes).toHaveLength(6);
    expect(new Set(notes).size).toBe(6);
  });
});

describe('Nalesnik', () => {
  it('Plywy: the ring runs out over 0.4 s, pushes enemies out 70 and strikes 1.2x once each; far ones stay', () => {
    const s = run('nalesnik');
    install(s, 3);
    const near = addEnemy(s, 40);
    const mid = addEnemy(s, 0, -140);
    const far = addEnemy(s, 300);
    const bus = createBus();
    expect(castSkill(s, bus, 0)).toBe(true);
    expect(s.hero.tide).not.toBeNull();
    tick(s, bus, 0.1);
    expect(near.hp).toBeLessThan(5000); // the ring is already past 60
    expect(mid.hp).toBe(5000); // but not yet at 140
    tick(s, bus, 0.5);
    expect(s.hero.tide).toBeNull();
    expect(5000 - near.hp).toBe(hit(1.2, 1.25));
    expect(5000 - mid.hp).toBe(hit(1.2, 1.25));
    expect(near.x).toBeCloseTo(640 + PLYWY_PUSH, 3);
    expect(Math.hypot(mid.x - 600, mid.y - 800)).toBeCloseTo(140 + PLYWY_PUSH, 3);
    expect(far.hp).toBe(5000);
    expect(far.x).toBe(900);
  });

  it('Plywy pulls loot within 160 to the pancake and leaves the rest', () => {
    const s = run('nalesnik');
    install(s, 3);
    const close = createPickup(nextId(s), 700, 800, 1);
    const wide = createPickup(nextId(s), 600, 950, 2);
    const away = createPickup(nextId(s), 900, 800, 3);
    s.pickups.push(close, wide, away);
    const bus = createBus();
    castSkill(s, bus, 0);
    tick(s, bus, 0.6);
    const stop = s.player.r + close.r + 2;
    expect(Math.hypot(close.x - 600, close.y - 800)).toBeLessThanOrEqual(stop + 0.5);
    expect(Math.hypot(wide.x - 600, wide.y - 800)).toBeLessThanOrEqual(s.player.r + wide.r + 2.5);
    expect(away.x).toBe(900);
  });

  it('Ksiezyc: one moon at a time, settles on a circle of 90, goes round at 1.4 rad/s, gives +10 upor, and ends after 8 s', () => {
    const s = run('nalesnik');
    install(s, 4);
    const upor = s.player.stats.upor;
    const bus = createBus();
    const expired: number[] = [];
    bus.on('summon:expired', (e) => expired.push(e.id));
    expect(castSkill(s, bus, 0, false, east)).toBe(true);
    const moon = s.summons.find((m) => m.variant === 'moon');
    expect(moon).toBeDefined();
    expect(s.player.stats.upor).toBe(upor + KSIEZYC_UPOR);
    tick(s, bus, 0.5);
    expect(Math.hypot((moon?.x ?? 0) - 600, (moon?.y ?? 0) - 800)).toBeCloseTo(KSIEZYC_ORBIT * 1.12, 3);
    const a0 = moon?.orbit?.angle ?? 0;
    tick(s, bus, 1);
    expect((moon?.orbit?.angle ?? 0) - a0).toBeCloseTo(1.4, 2);
    // a second cast replaces the moon; the upor is not added twice
    s.hero.cd[4] = 0;
    castSkill(s, bus, 0, false, { kind: 'kierunek', dx: 0, dy: -1 });
    expect(s.summons.filter((m) => m.variant === 'moon')).toHaveLength(1);
    expect(expired).toContain(moon?.id);
    expect(s.player.stats.upor).toBe(upor + KSIEZYC_UPOR);
    tick(s, bus, KSIEZYC_S * 1.15 + 0.3);
    expect(s.summons.some((m) => m.variant === 'moon')).toBe(false);
    expect(s.player.stats.upor).toBe(upor);
  });

  it('the moon strikes an enemy it overlaps at most once per 0.6 s, for 0.5x egzystencjalny', () => {
    const s = run('nalesnik');
    install(s, 4);
    const big = addEnemy(s, KSIEZYC_ORBIT, 0);
    big.r = 110; // the moon is inside it for a second and a half as it goes by
    const bus = createBus();
    const times: number[] = [];
    const amounts: number[] = [];
    bus.on('enemy:hit', (e) => {
      times.push(s.time);
      amounts.push(e.amount);
    });
    castSkill(s, bus, 0, false, east);
    tick(s, bus, 2.2);
    expect(times.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < times.length; i++) expect((times[i] ?? 0) - (times[i - 1] ?? 0)).toBeGreaterThanOrEqual(KSIEZYC_GAP_S - 1e-6);
    expect(amounts).toEqual(amounts.map(() => hit(0.5, 1.25)));
    expect(times.length).toBeLessThanOrEqual(4);
  });

  it('the moon does not hit during the bot hours', () => {
    const s = run('nalesnik');
    install(s, 4);
    const big = addEnemy(s, KSIEZYC_ORBIT, 0);
    big.r = 60;
    const bus = createBus();
    castSkill(s, bus, 0, false, east);
    s.law.botTime = true;
    tick(s, bus, 1.5);
    expect(big.hp).toBe(5000);
  });
});

describe('all ten through their pads', () => {
  const defs: [HeroDef, 3 | 4][] = [];
  for (const h of HEROES) for (const i of [3, 4] as const) defs.push([h, i]);
  it.each(defs.map(([h, i]) => [h.id, i, h.skills[i].id] as const))('%s skill %i (%s) casts through a pad when there is a target', (heroId, i) => {
    const s = run(heroId);
    install(s, i);
    for (const d of [60, 90, 130]) addEnemy(s, d, 3);
    s.enemies.forEach((e) => (e.hp = e.hpMax = 5000));
    const bus = createBus();
    const sk = heroDef(heroId).skills[i];
    const aim = sk.aim === 'kierunek' ? east : sk.aim === 'wskazanie' ? ({ kind: 'wskazanie', x: 690, y: 803 } as const) : undefined;
    expect(castSkill(s, bus, 0, false, aim)).toBe(true);
    expect(s.hero.cd[i]).toBeGreaterThan(0);
    expect(s.hero.cdTotal[i]).toBeGreaterThan(0);
    tick(s, bus, 1);
  });
});
