/**
 * The skill contract (S1): every hero x skill x aim kind replayed on one fixed, seeded scene; the state after the cast and
 * after two and a half seconds of the hero system is compared with `contract.snapshot.json`, captured before the skills were
 * re-expressed as data + primitives. A refactor of the heroes must leave this file green WITHOUT regenerating the snapshot.
 * Regenerate only for an intended behaviour change: `npx vitest run -u src/heroes/contract.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { createBus, type Bus, type GameEvents } from '../core/events';
import { createEnemy, createPickup } from '../entities/factory';
import { recomputeStats } from '../items/stats';
import { createRun, nextId, type RunState } from '../world/run';
import type { Aim } from './aim';
import { HEROES, skillAt, type SkillIndex } from './defs';
import { assignPad } from './loadout';
import { castSkill } from './skills';
import { heroStep } from './system';
import type { HeroId } from './index';

const SEED = 5;

const AIMS: Record<string, Aim> = {
  auto: { kind: 'auto' },
  kierunek: { kind: 'kierunek', dx: 0.8, dy: -0.6 },
  wskazanie: { kind: 'wskazanie', x: 720, y: 880 },
};

interface Recorded {
  events: [string, unknown][];
  bus: Bus;
}

function recorder(): Recorded {
  const real = createBus();
  const events: [string, unknown][] = [];
  const bus: Bus = {
    on: (name, fn) => real.on(name, fn),
    emit(name, ...payload) {
      events.push([name, payload[0] ?? null]);
      (real.emit as (n: keyof GameEvents, ...p: unknown[]) => void)(name, ...payload);
    },
  };
  return { events, bus };
}

/** Fixed scene: nine enemies at fixed offsets (one nearly dead), two pickups, a warm history of the hero's position for Petla. */
function scene(heroId: HeroId, bus: Bus, rankedSkill?: SkillIndex): RunState {
  const s = createRun(SEED, { heroId });
  s.enemies.length = 0;
  s.page.obstacles.length = 0;
  s.player.x = 600;
  s.player.y = 800;
  const p = s.player;
  p.baseStats.stats.dmgMin = 10;
  p.baseStats.stats.dmgMax = 10;
  p.baseStats.stats.critChance = 0;
  recomputeStats(p);
  p.hp = p.hpMax = 1e6;
  const spots: [number, number][] = [[60, 0], [110, -30], [150, 20], [-70, 10], [40, 90], [-30, -120], [200, -90], [90, 140], [260, 40], [80, -60]];
  spots.forEach(([dx, dy], i) => {
    const e = createEnemy(nextId(s), p.x + dx, p.y + dy, 1);
    e.hp = e.hpMax = i === 2 ? 40 : 5000;
    e.stats.upor = 0;
    e.stats.resist = {};
    e.attackTimer = 999;
    s.enemies.push(e);
  });
  s.pickups.push(createPickup(nextId(s), p.x - 120, p.y, 1, undefined, 1));
  s.pickups.push(createPickup(nextId(s), p.x + 20, p.y + 260, 2, undefined, 1));
  for (const i of [3, 4] as const) s.hero.ranks[i] = 1;
  if (rankedSkill !== undefined && rankedSkill > 4) s.hero.ranks[rankedSkill] = 1; // a skill past the fifth (S19): installed for its own replay only, so the older keys stay byte-identical
  tick(s, bus, 1.5);
  p.x = 640;
  p.y = 810;
  tick(s, bus, 1.7);
  p.x = 600;
  p.y = 800;
  return s;
}

function tick(s: RunState, bus: Bus, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    s.time += 1 / 60;
    for (const e of s.enemies) for (const st of e.statuses) st.remaining -= 1 / 60;
    for (const e of s.enemies) e.statuses = e.statuses.filter((st) => st.remaining > 0);
    heroStep(s, bus, 1 / 60);
  }
}

const round = (_k: string, v: unknown): unknown => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 1000) / 1000 : v);

function digest(s: RunState): unknown {
  const p = s.player;
  return JSON.parse(
    JSON.stringify(
      {
        time: s.time,
        player: { x: p.x, y: p.y, hp: p.hp, shield: p.shield, facing: p.facing, attackRange: p.attackRange, stats: p.stats, target: p.target },
        enemies: s.enemies.map((e) => ({ id: e.id, x: e.x, y: e.y, hp: e.hp, boss: e.boss ?? false, statuses: e.statuses, attackTimer: e.attackTimer })),
        projectiles: s.projectiles,
        summons: s.summons,
        zones: s.zones,
        pickups: s.pickups.map((k) => ({ id: k.id, x: k.x, y: k.y })),
        hero: { ...s.hero, ring: s.hero.ring.length },
      },
      round,
    ),
  );
}

function replay(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const def of HEROES) {
    for (let i = 0; i < def.skills.length; i++) {
      const skill = i as SkillIndex;
      for (const [aimName, aim] of Object.entries(AIMS)) {
        const variants = def.id === 'petlowiec' ? ['plain', 'copy'] : ['plain'];
        for (const variant of variants) {
          const { events, bus } = recorder();
          const s = scene(def.id, bus, skill);
          if (variant === 'copy') {
            assignPad(s, 0, 0);
            castSkill(s, bus, 0, false, AIMS['auto']);
            s.hero.cd = [0, 0, 0, 0, 0];
          }
          if (def.id === 'petlowiec' && skill === 3) {
            // Juz to bylo repeats the last skill: give it one (Przybycie when there is no copy yet, else Spor)
            assignPad(s, 1, 1);
            castSkill(s, bus, 1, false, AIMS['auto']);
            s.hero.cd = [0, 0, 0, 0, 0];
          }
          assignPad(s, 0, skill);
          events.length = 0;
          const result = castSkill(s, bus, 0, false, aim);
          const afterCast = digest(s);
          const castEvents = JSON.parse(JSON.stringify(events, round));
          events.length = 0;
          tick(s, bus, 2.5);
          out[`${def.id}.${skillAt(def, skill).id}.${aimName}.${variant}`] = {
            result,
            castEvents,
            afterCast,
            afterTick: digest(s),
            tickEvents: JSON.parse(JSON.stringify(events, round)),
          };
        }
      }
    }
  }
  return out;
}

/** JSON with the keys of every object sorted, so that the order fields were added in does not matter. */
function canonical(v: unknown): string {
  const sort = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(sort);
    if (x !== null && typeof x === 'object') return Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, val]) => [k, sort(val)]));
    return x;
  };
  return JSON.stringify(sort(v), null, 1) + '\n';
}

describe('hero skill contract', () => {
  const actual = replay();

  it('replays deterministically', () => {
    expect(replay()).toEqual(actual);
  });

  it('covers every hero, skill and aim kind', () => {
    const keys = Object.keys(actual);
    expect(HEROES.length * 5).toBeGreaterThanOrEqual(25);
    for (const def of HEROES) for (const sk of def.skills) for (const a of Object.keys(AIMS)) expect(keys, `${def.id}.${sk.id}.${a}`).toContain(`${def.id}.${sk.id}.${a}.plain`);
  });

  it('matches the snapshot captured before the refactor', async () => {
    await expect(canonical(actual)).toMatchFileSnapshot('./contract.snapshot.json');
  });
});
