/** The Nalesnik filled (S21): skills 6 to 10 in every paragraph and aim, the two new ultimates, passives 7 to 10, the folder's data. */
import { describe, expect, it } from 'vitest';
import { getStatus, hasStatus } from '../../combat/status';
import { createBus, type Bus } from '../../core/events';
import { createEnemy } from '../../entities/factory';
import type { Enemy } from '../../entities/types';
import { updateEnemyProjectiles } from '../../enemies/projectiles';
import { t } from '../../i18n';
import { recomputeStats } from '../../items/stats';
import { setRunParagraph } from '../../progression/paragraphs';
import { applyDamage } from '../../systems/combat';
import { createRun, nextId, type RunState } from '../../world/run';
import type { Aim } from '../aim';
import { heroDef, skillAt, type SkillIndex } from '../defs';
import { assignPad } from '../loadout';
import { patchFields, PATCH_FIELD_LIMIT, type ParagraphNo } from '../paragraphs';
import { heroById } from '../registry';
import { projectileDamageMul } from '../shield';
import { castSkill } from '../skills';
import { heroStep } from '../system';
import { castUltimate, setUltimateParagraph, ultimateActive, ultimateSeconds } from '../ultimate';
import { MAX_ULT_RADIUS, MAX_ULT_S } from '../ultimateDefs';
import { zoneParts } from './figure';
import { IX } from './numbers';
import { nalState } from './state';

const DT = 1 / 60;
const SKILL_IDS = ['krawedz', 'pierscien', 'zaokraglenie', 'upadek', 'zmianaOrbity'] as const;

function scene(offsets: [number, number][], hp = 5000): { s: RunState; bus: Bus; enemies: Enemy[]; notes: { text: string }[] } {
  const bus = createBus();
  const notes: { text: string }[] = [];
  bus.on('footnote', (e) => notes.push(e));
  const s = createRun(5, { heroId: 'nalesnik' });
  s.enemies.length = 0;
  s.page.obstacles.length = 0;
  s.player.x = 600;
  s.player.y = 800;
  s.player.baseStats.stats.dmgMin = 10;
  s.player.baseStats.stats.dmgMax = 10;
  s.player.baseStats.stats.critChance = 0;
  s.player.baseStats.hpMax = 1e6; // a recompute (Zaokraglenie) keeps it
  recomputeStats(s.player);
  s.player.hp = s.player.hpMax;
  s.player.level = 36;
  for (let i = 3; i <= 9; i++) s.hero.ranks[i] = 1; // every skill installed
  const enemies = offsets.map(([dx, dy]) => {
    const e = createEnemy(nextId(s), s.player.x + dx, s.player.y + dy, 1);
    e.hp = e.hpMax = hp;
    e.stats.upor = 0;
    e.stats.resist = {};
    e.claim = undefined;
    e.attackTimer = 999;
    e.facing = -1;
    s.enemies.push(e);
    return e;
  });
  return { s, bus, enemies, notes };
}

function tick(s: RunState, bus: Bus, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    s.time += DT;
    for (const e of s.enemies) for (const st of e.statuses) st.remaining -= DT;
    for (const e of s.enemies) e.statuses = e.statuses.filter((st) => st.remaining > 0);
    heroStep(s, bus, DT);
  }
}

const lost = (e: Enemy): number => e.hpMax - e.hp;
/** Every skill of the scene has rank 1: +25% (heroes/helpers.ts RANK_DAMAGE). */
const hit = (mult: number): number => Math.max(1, Math.round(10 * mult * 1.25));
/** An ultimate's blow has no rank. */
const blow = (mult: number): number => Math.max(1, Math.round(10 * mult));

/** Put skill `i` on pad 0, make paragraph `n` active, cast it with `aim`. */
function cast(s: RunState, bus: Bus, i: SkillIndex, n: ParagraphNo, aim?: Aim): boolean {
  if (s.hero.pads[0] !== i) expect(assignPad(s, 0, i)).toBe(true);
  expect(setRunParagraph(s, skillAt(heroDef('nalesnik'), i).id, n, true)).toBe(true);
  s.hero.cd[i] = 0;
  return castSkill(s, bus, 0, false, aim);
}

describe('the folder', () => {
  const m = heroById('nalesnik');
  it('has ten skills, ten casts, ten pads, ten sounds, three ultimates with a sound each, ten passives', () => {
    expect(m.def.skills).toHaveLength(10);
    expect(Object.keys(m.casts).sort()).toEqual(m.def.skills.map((k) => k.id).sort());
    expect(m.pads).toHaveLength(10);
    for (const g of m.pads) expect(g.length).toBeGreaterThan(0);
    expect(new Set(m.sounds.skills).size).toBe(10);
    expect(m.passives).toHaveLength(10);
    expect(m.passives[6]?.rule).toBe(true);
    expect(m.ultimates?.map((u) => u.level)).toEqual([12, 24, 36]);
    const ult = m.sounds.ultimate;
    expect(typeof ult).toBe('object');
    for (const u of m.ultimates ?? []) expect(typeof ult === 'object' && ult[u.id], u.id).toBeTruthy();
  });

  it('puts every skill in one column of the chart and one category (2 / 3 / 2 / 3), and keeps the old ids first', () => {
    const specs = m.specs;
    const ids = m.def.skills.map((k) => k.id);
    expect(ids.slice(0, 5)).toEqual(['orbita', 'grawitacja', 'wniosek', 'plywy', 'ksiezyc']);
    const columns = (specs?.list ?? []).flatMap((c) => c.skills);
    expect([...columns].sort()).toEqual([...ids].sort());
    for (const id of ids) expect(specs?.categories[id], id).toBeDefined();
    const count = (c: string): number => ids.filter((id) => specs?.categories[id] === c).length;
    expect([count('podstawowa'), count('ofensywna'), count('obronna'), count('uzytkowa')]).toEqual([2, 3, 2, 3]);
    for (const c of specs?.list ?? []) expect(c.skills).toContain(c.capstone.skill);
  });

  it('opens the new skills at the levels of SKILLS.md and keeps one skill of each type by level 7', () => {
    const lvl = (id: string): number => m.paragraphs[id]?.level ?? 99;
    expect(SKILL_IDS.map(lvl)).toEqual([3, 11, 3, 9, 14]);
    const types = new Set(m.def.skills.filter((k) => lvl(k.id) <= 7).map((k) => k.type));
    expect(types).toEqual(new Set(['regulaminowy', 'egzystencjalny', 'mechaniczny']));
    const aims = new Set(m.def.skills.map((k) => k.aim));
    expect(aims).toEqual(new Set(['auto', 'kierunek', 'wskazanie']));
  });

  it('has Polish text for every key it names, the first-cast notes and the passives', () => {
    for (const sk of m.def.skills) for (const k of [sk.nameKey, sk.padKey, sk.descKey]) expect(t(k), k).not.toBe(k);
    for (const u of m.ultimates ?? []) {
      for (const k of [u.nameKey, u.descKey, u.stampKey, u.noteKey, ...u.list.flatMap((p) => [p.nameKey, p.descKey])]) expect(t(k), k).not.toBe(k);
      expect(t(u.stampKey)).toBe(t(u.stampKey).toUpperCase());
      expect(t(u.stampKey)).not.toContain('!');
    }
    for (const sp of Object.values(m.paragraphs)) for (const p of sp.list) for (const k of [p.nameKey, p.descKey]) expect(t(k), k).not.toBe(k);
    for (const n of [7, 8, 9, 10]) for (const part of ['name', 'desc']) expect(t(`forms.update.passive.nalesnik.${n}.${part}`)).not.toContain('forms.update');
    for (const id of ['krawedz', 'pierscien', 'zaokraglenie', 'upadek', 'zmiana']) expect(t(`heroes.nalesnik.note.${id}`)).not.toContain('heroes.nalesnik');
  });

  it('draws the ring, the crater and the curve through the zone hook, and leaves other zones to the others', () => {
    const z = (variant: string, extra: object = {}): Parameters<typeof zoneParts>[0] => ({ kind: 'zone', id: 7, x: 0, y: 0, r: 120, variant, ttl: 1, ...extra }) as Parameters<typeof zoneParts>[0];
    expect(zoneParts(z('pierscien', { acc: 90 }))?.length).toBeGreaterThanOrEqual(3);
    expect(zoneParts(z('krater'))?.length).toBeGreaterThanOrEqual(3);
    expect(zoneParts(z('luk', { angle: 0.5 }))?.[0]?.startsWith('~M0 0Q')).toBe(true);
    expect(zoneParts(z('teren'))).toBeNull();
  });
});

describe('every new skill in every paragraph and aim', () => {
  const aims: Record<string, Aim> = {
    auto: { kind: 'auto' },
    kierunek: { kind: 'kierunek', dx: 1, dy: 0 },
    wskazanie: { kind: 'wskazanie', x: 700, y: 800 },
  };
  for (const [offset, id] of SKILL_IDS.entries()) {
    const i = (IX.krawedz + offset) as SkillIndex;
    for (const n of [1, 2, 3] as const) {
      for (const [aimName, aim] of Object.entries(aims)) {
        it(`${id} § ${n} with ${aimName} aim casts, spends its cooldown, and leaves something`, () => {
          const offs: [number, number][] = [[70, 0], [100, 20], [60, -50], [-80, 10]];
          const { s, bus, enemies } = scene(offs);
          const start = { x: s.player.x, y: s.player.y };
          expect(cast(s, bus, i, n, aim), id).toBe(true);
          expect(s.hero.cd[i] ?? 0).toBeGreaterThan(0);
          tick(s, bus, 0.6);
          const hurt = enemies.some((e) => lost(e) > 0);
          const marked = enemies.some((e) => e.statuses.length > 0);
          const moved = enemies.some((e, k) => Math.hypot(e.x - (600 + offs[k]![0]), e.y - (800 + offs[k]![1])) > 1);
          const things = s.zones.length + s.summons.length;
          const self = Math.hypot(s.player.x - start.x, s.player.y - start.y) > 1 || nalState(s).round !== null;
          expect(hurt || marked || moved || things > 0 || self, `${id} § ${n} ${aimName}`).toBe(true);
          expect(s.player.hp).toBeGreaterThan(0);
        });
      }
    }
  }

  it('Krawedz needs somebody to roll at: nothing happens without a target, and no cooldown is spent', () => {
    const { s, bus } = scene([[400, 0]]);
    expect(cast(s, bus, IX.krawedz, 1)).toBe(false);
    expect(s.hero.cd[IX.krawedz] ?? 0).toBe(0);
  });
});

describe('the data of the paragraphs', () => {
  it('every new skill has three, § 1 unpatched, § 3 with a price, at most four fields', () => {
    const m = heroById('nalesnik');
    for (const id of SKILL_IDS) {
      const list = m.paragraphs[id]?.list;
      expect(list, id).toHaveLength(3);
      expect(patchFields(list?.[0]?.patch ?? { dmg: 1 })).toBe(0);
      for (const p of list ?? []) expect(patchFields(p.patch)).toBeLessThanOrEqual(PATCH_FIELD_LIMIT);
      const p3 = list?.[2]?.patch ?? {};
      expect((p3.cd ?? 0) > 0 || (p3.cost ?? 0) > 0 || (p3.dur ?? 1) < 1 || (p3.dmg ?? 1) < 1, id).toBe(true);
    }
  });
});

describe('Krawedz', () => {
  it('§ 1 rolls 80 at the target and strikes it for 0.8x; one enemy on the path beyond it is not touched', () => {
    const { s, bus, enemies } = scene([[60, 0], [110, 0]]);
    expect(cast(s, bus, IX.krawedz, 1)).toBe(true);
    tick(s, bus, 0.4);
    expect(lost(enemies[0]!)).toBe(hit(0.8));
    expect(lost(enemies[1]!)).toBe(0);
    expect(s.player.x).toBeGreaterThan(660);
    expect(s.player.x).toBeLessThan(690);
  });

  it('from behind (the enemy faces the way he rolls) the blow is a crit, twice as much', () => {
    const { s, bus, enemies } = scene([[60, 0]]);
    enemies[0]!.facing = 1;
    cast(s, bus, IX.krawedz, 1);
    tick(s, bus, 0.4);
    expect(lost(enemies[0]!)).toBe(hit(0.8) * 2);
  });

  it('§ 2 zlozona is regulaminowy and strikes everyone on the path for 0.6x', () => {
    const { s, bus, enemies } = scene([[45, 0], [70, 8]]);
    cast(s, bus, IX.krawedz, 2);
    tick(s, bus, 0.4);
    expect(lost(enemies[0]!)).toBe(hit(0.6));
    expect(lost(enemies[1]!)).toBe(hit(0.6));
  });

  it('§ 3 ostra strikes 1.2x and the target waits for verification 1 s', () => {
    const { s, bus, enemies } = scene([[60, 0]]);
    cast(s, bus, IX.krawedz, 3);
    tick(s, bus, 0.4);
    expect(lost(enemies[0]!)).toBe(hit(1.2));
    expect(hasStatus(enemies[0]!, 'do_weryfikacji')).toBe(true);
  });

  it('stops at a wall and does not go on rolling', () => {
    const { s, bus } = scene([[60, 0]]);
    s.player.x = s.page.w - s.page.inset - 20;
    s.enemies[0]!.x = s.player.x - 60;
    s.enemies[0]!.y = s.player.y;
    s.enemies[0]!.facing = 1;
    cast(s, bus, IX.krawedz, 1);
    tick(s, bus, 0.6);
    expect(s.player.x).toBeLessThan(s.page.w);
    expect(nalState(s).edge).toBeNull();
  });
});

describe('Pierscien', () => {
  it('§ 1 strikes each enemy that enters the band of 90-120 once for 0.6x and marks it 1 s; the ring follows him', () => {
    const { s, bus, enemies } = scene([[100, 0], [50, 0], [300, 0]]);
    expect(cast(s, bus, IX.pierscien, 1)).toBe(true);
    tick(s, bus, 0.2);
    expect(lost(enemies[0]!)).toBe(hit(0.6));
    expect(hasStatus(enemies[0]!, 'do_weryfikacji')).toBe(true);
    expect(lost(enemies[1]!)).toBe(0);
    tick(s, bus, 1);
    expect(lost(enemies[0]!)).toBe(hit(0.6)); // standing in it is not a crossing again
    s.player.x += 80;
    tick(s, bus, 0.1);
    const z = s.zones.find((x) => x.variant === 'pierscien');
    expect(z?.x).toBeCloseTo(s.player.x, 0);
  });

  it('a crossing again is a second blow: out of the band and in', () => {
    const { s, bus, enemies } = scene([[100, 0]]);
    cast(s, bus, IX.pierscien, 1);
    tick(s, bus, 0.1);
    enemies[0]!.x = s.player.x + 200;
    tick(s, bus, 0.1);
    enemies[0]!.x = s.player.x + 100;
    tick(s, bus, 0.1);
    expect(lost(enemies[0]!)).toBe(hit(0.6) * 2);
  });

  it('lasts 4 s (4.6 at rank 1), and § 2 wewnetrzny moves the band to 50-80 for 3 s (3.45) at 0.9x', () => {
    const a = scene([[100, 0]]);
    cast(a.s, a.bus, IX.pierscien, 1);
    tick(a.s, a.bus, 4.4);
    expect(a.s.zones.some((x) => x.variant === 'pierscien')).toBe(true);
    tick(a.s, a.bus, 0.4);
    expect(a.s.zones.some((x) => x.variant === 'pierscien')).toBe(false);
    const b = scene([[65, 0], [100, 0]]);
    cast(b.s, b.bus, IX.pierscien, 2);
    tick(b.s, b.bus, 0.2);
    expect(lost(b.enemies[0]!)).toBe(hit(0.9));
    expect(lost(b.enemies[1]!)).toBe(0);
    tick(b.s, b.bus, 3.2);
    expect(b.s.zones.some((x) => x.variant === 'pierscien')).toBe(true);
    tick(b.s, b.bus, 0.4);
    expect(b.s.zones.some((x) => x.variant === 'pierscien')).toBe(false);
  });

  it('§ 3 planetarny is egzystencjalny, lasts 6 s, and sets the existence of a Wygenerowane that crosses to 0.5', () => {
    const { s, bus, enemies } = scene([[100, 0]]);
    enemies[0]!.existence = 1;
    cast(s, bus, IX.pierscien, 3);
    tick(s, bus, 0.2);
    expect(enemies[0]!.existence).toBe(0.5);
    tick(s, bus, 6.5);
    expect(s.zones.some((x) => x.variant === 'pierscien')).toBe(true);
  });
});

describe('Zaokraglenie', () => {
  it('§ 1: round, +20 upor, 35% off every type, 20% slower; taken back after 3 s (3.45 at rank 1)', () => {
    const { s, bus } = scene([]);
    const before = { upor: s.player.stats.upor, res: s.player.stats.resist.mechaniczny ?? 0, speed: s.player.speed };
    expect(cast(s, bus, IX.zaokraglenie, 1)).toBe(true);
    expect(s.player.round).toBe(true);
    expect(s.player.stats.upor).toBe(before.upor + 20);
    expect(s.player.stats.resist.mechaniczny).toBe(before.res + 35);
    expect(s.player.stats.resist.egzystencjalny).toBe(35);
    expect(s.player.speed).toBeCloseTo(before.speed * 0.8, 5);
    tick(s, bus, 3.3);
    expect(s.player.round).toBe(true);
    tick(s, bus, 0.3);
    expect(s.player.round).toBe(false);
    expect(s.player.stats.upor).toBe(before.upor);
    expect(s.player.stats.resist.mechaniczny).toBe(before.res);
    expect(s.player.speed).toBeCloseTo(before.speed, 5);
  });

  it('a second cast does not stack on the first', () => {
    const { s, bus } = scene([]);
    const upor = s.player.stats.upor;
    cast(s, bus, IX.zaokraglenie, 1);
    s.hero.cd[IX.zaokraglenie] = 0;
    cast(s, bus, IX.zaokraglenie, 1);
    expect(s.player.stats.upor).toBe(upor + 20);
  });

  it('§ 2 w gore lasts 5 s, takes off 20% and does not slow', () => {
    const { s, bus } = scene([]);
    const speed = s.player.speed;
    cast(s, bus, IX.zaokraglenie, 2);
    expect(s.player.stats.resist.mechaniczny).toBe((heroDef('nalesnik').baseStats.resist.mechaniczny ?? 0) + 20);
    expect(s.player.speed).toBe(speed);
    tick(s, bus, 5.6);
    expect(s.player.round).toBe(true);
    tick(s, bus, 0.4);
    expect(s.player.round).toBe(false);
  });

  it('§ 3 w dol lies flat: every projectile skims off, melee costs 20% more; the figure is not round', () => {
    const { s, bus } = scene([]);
    s.player.hp = Math.round(s.player.hpMax * 0.5); // below the 90% of the rule: only the flat state skims
    expect(projectileDamageMul(s.player)).toBe(1);
    cast(s, bus, IX.zaokraglenie, 3);
    expect(s.player.flat).toBe(true);
    expect(s.player.round).not.toBe(true);
    expect(projectileDamageMul(s.player)).toBe(0);
    expect(s.player.stats.resist.regulaminowy).toBe(-20);
    tick(s, bus, 3.6);
    expect(s.player.flat).toBeUndefined();
    expect(projectileDamageMul(s.player)).toBe(1);
    expect(s.player.stats.resist.regulaminowy ?? 0).toBe(0);
  });
});

describe('Upadek na powierzchnie', () => {
  it('§ 1 hops to the point, strikes 1.6x in 100, pushes 50, and he is round for 2 s', () => {
    const { s, bus, enemies } = scene([[130, 0], [160, 60], [400, 0]]);
    expect(cast(s, bus, IX.upadek, 1, { kind: 'wskazanie', x: 740, y: 800 })).toBe(true);
    expect(s.player.x).toBeCloseTo(740, 0);
    expect(lost(enemies[0]!)).toBe(hit(1.6));
    expect(Math.hypot(enemies[0]!.x - 740, enemies[0]!.y - 800)).toBeGreaterThan(10 + 40);
    expect(lost(enemies[2]!)).toBe(0);
    expect(s.player.round).toBe(true);
    tick(s, bus, 2.6);
    expect(s.player.round).toBe(false);
  });

  it('the hop reaches 140 at most', () => {
    const { s, bus } = scene([]);
    cast(s, bus, IX.upadek, 1, { kind: 'wskazanie', x: 1100, y: 800 });
    expect(s.player.x).toBeCloseTo(740, 0);
  });

  it('§ 2 kontrolowany: radius 60, 2.4x, no push', () => {
    const { s, bus, enemies } = scene([[130, 0], [230, 0]]);
    cast(s, bus, IX.upadek, 2, { kind: 'wskazanie', x: 730, y: 800 });
    expect(lost(enemies[0]!)).toBe(hit(2.4));
    expect(enemies[0]!.x).toBe(730);
    expect(lost(enemies[1]!)).toBe(0);
  });

  it('§ 3 z wysokosci leaves a crater for 3 s that strikes 0.3x a second', () => {
    const { s, bus, enemies } = scene([[130, 0]]);
    cast(s, bus, IX.upadek, 3, { kind: 'wskazanie', x: 730, y: 800 });
    expect(s.zones.some((z) => z.variant === 'krater')).toBe(true);
    const first = lost(enemies[0]!);
    enemies[0]!.x = 730; // it was pushed: put it back inside
    enemies[0]!.y = 800;
    tick(s, bus, 1.1);
    expect(lost(enemies[0]!)).toBeGreaterThan(first);
    tick(s, bus, 2.6);
    expect(s.zones.some((z) => z.variant === 'krater')).toBe(false);
    const after = lost(enemies[0]!);
    tick(s, bus, 1);
    expect(lost(enemies[0]!)).toBe(after);
  });
});

describe('Zmiana orbity', () => {
  it('§ 1 rolls to the point along a curve in 0.4 s (200 at most), marking whoever it crosses for 2 s', () => {
    const { s, bus, enemies } = scene([[100, -30], [100, 30], [300, 200]]);
    expect(cast(s, bus, IX.zmiana, 1, { kind: 'wskazanie', x: 1000, y: 800 })).toBe(true);
    tick(s, bus, 0.5);
    expect(Math.hypot(s.player.x - 800, s.player.y - 800)).toBeLessThan(2);
    const crossed = enemies.filter((e) => hasStatus(e, 'do_weryfikacji'));
    expect(crossed.length).toBeGreaterThan(0);
    expect(getStatus(crossed[0]!, 'do_weryfikacji')?.remaining).toBeGreaterThan(1);
    expect(lost(enemies[0]!)).toBe(0);
    expect(s.zones.some((z) => z.variant === 'luk')).toBe(true);
  });

  it('is held by a wall: the curve does not carry him through an obstacle', () => {
    const { s, bus } = scene([]);
    s.player.x = s.page.w - s.page.inset - 60;
    cast(s, bus, IX.zmiana, 1, { kind: 'wskazanie', x: s.player.x + 200, y: s.player.y });
    tick(s, bus, 0.6);
    expect(s.player.x).toBeLessThanOrEqual(s.page.w - s.page.inset);
  });

  it('§ 2 na wniosek strikes the crossed for 0.7x', () => {
    const { s, bus, enemies } = scene([[100, 5]]);
    cast(s, bus, IX.zmiana, 2, { kind: 'wskazanie', x: 800, y: 800 });
    tick(s, bus, 0.5);
    expect(lost(enemies[0]!)).toBe(hit(0.7));
  });

  it('§ 3 o 180 stopni lands with a ring of 80: those near the landing are struck and pushed', () => {
    const { s, bus, enemies } = scene([[190, 40], [500, 0]]);
    cast(s, bus, IX.zmiana, 3, { kind: 'wskazanie', x: 800, y: 800 });
    tick(s, bus, 0.5);
    expect(lost(enemies[0]!)).toBe(hit(1.2));
    expect(Math.hypot(enemies[0]!.x - 800, enemies[0]!.y - 800)).toBeGreaterThan(Math.hypot(190 - 200, 40) + 30);
    expect(lost(enemies[1]!)).toBe(0);
  });
});

describe('the ultimates', () => {
  function cast3(s: RunState, bus: Bus, id: string, n: ParagraphNo): boolean {
    s.hero.ultimateId = id;
    setUltimateParagraph(s, n);
    s.player.meter = 1;
    return castUltimate(s, bus);
  }

  it('keep the limits: 8 s, radius at most 220, patches of at most four fields, a cost somewhere', () => {
    for (const u of heroById('nalesnik').ultimates ?? []) {
      expect(u.radius === null || u.radius <= MAX_ULT_RADIUS, u.id).toBe(true);
      for (const p of u.list) {
        expect(ultimateSeconds(u, p.n), `${u.id} ${p.n}`).toBeLessThanOrEqual(MAX_ULT_S);
        expect(patchFields(p.patch)).toBeLessThanOrEqual(PATCH_FIELD_LIMIT);
      }
      expect(u.list.some((p) => (p.patch.cost ?? 0) > 0), u.id).toBe(true);
    }
    expect((heroById('nalesnik').ultimates ?? []).filter((u) => u.pageWide)).toHaveLength(0);
    // the three are of three types, the first the auto's
    expect((heroById('nalesnik').ultimates ?? []).map((u) => u.type)).toEqual(['regulaminowy', 'mechaniczny', 'egzystencjalny']);
  });

  it('are closed below their level, and end by themselves in every paragraph', () => {
    const closed = scene([[80, 0]]);
    closed.s.player.level = 23;
    expect(cast3(closed.s, closed.bus, 'zderzenie', 1)).toBe(false);
    closed.s.player.level = 35;
    expect(cast3(closed.s, closed.bus, 'pelnia', 1)).toBe(false);
    for (const id of ['decyzjaKomisji', 'zderzenie', 'pelnia']) {
      for (const n of [1, 2, 3] as const) {
        const { s, bus } = scene([[80, 0], [-90, 30]]);
        expect(cast3(s, bus, id, n), `${id} ${n}`).toBe(true);
        expect(ultimateActive(s)).toBe(true);
        const def = heroById('nalesnik').ultimates?.find((u) => u.id === id);
        if (!def) throw new Error(id);
        tick(s, bus, ultimateSeconds(def, n) + 0.2);
        expect(ultimateActive(s), `${id} ${n}`).toBe(false);
      }
    }
  });

  it('Zderzenie § 1 rolls through the crowd (toward its heart), strikes everyone on the path 3x once, and leaves a crater that marks', () => {
    const { s, bus, enemies } = scene([[120, 0], [200, 10], [300, -5], [-200, 0], [150, 200]]);
    expect(cast3(s, bus, 'zderzenie', 1)).toBe(true);
    tick(s, bus, 0.8);
    expect(s.player.x).toBeGreaterThan(600 + 450);
    expect(lost(enemies[0]!)).toBe(blow(3));
    expect(lost(enemies[1]!)).toBe(blow(3));
    expect(lost(enemies[2]!)).toBe(blow(3));
    expect(lost(enemies[3]!)).toBe(0);
    expect(lost(enemies[4]!)).toBe(0);
    expect(s.zones.some((z) => z.variant === 'krater')).toBe(true);
    // a crater: whoever stands in it waits for verification
    enemies[2]!.x = s.player.x + 10;
    enemies[2]!.y = s.player.y;
    tick(s, bus, 0.1);
    expect(hasStatus(enemies[2]!, 'do_weryfikacji')).toBe(true);
    tick(s, bus, 4.2);
    expect(s.zones.some((z) => z.variant === 'krater')).toBe(false);
  });

  it('Zderzenie is stopped by a wall and leaves the crater there', () => {
    const { s, bus } = scene([[150, 0]]);
    s.player.x = s.page.w - s.page.inset - 200;
    s.enemies[0]!.x = s.player.x + 120;
    s.enemies[0]!.y = s.player.y;
    cast3(s, bus, 'zderzenie', 1);
    tick(s, bus, 0.8);
    expect(s.player.x).toBeLessThanOrEqual(s.page.w);
    expect(s.zones.some((z) => z.variant === 'krater')).toBe(true);
  });

  it('Zderzenie § 2 is egzystencjalny and lays the path as Teren nieistniejacy; § 3 is regulaminowy, reach 300, 4x', () => {
    const a = scene([[120, 0], [300, 0]]);
    cast3(a.s, a.bus, 'zderzenie', 2);
    tick(a.s, a.bus, 0.8);
    expect(a.s.zones.filter((z) => z.variant === 'teren').length).toBeGreaterThanOrEqual(4);
    const b = scene([[120, 0], [450, 0]]);
    cast3(b.s, b.bus, 'zderzenie', 3);
    tick(b.s, b.bus, 0.8);
    expect(b.s.player.x).toBeGreaterThan(600 + 250);
    expect(b.s.player.x).toBeLessThan(600 + 330);
    expect(lost(b.enemies[0]!)).toBe(blow(4));
    expect(lost(b.enemies[1]!)).toBe(0);
  });

  it('Pelnia § 1 makes three moons for 8 s whose orbits widen from 90 to 160, with +30 upor while it runs; all taken back at the end', () => {
    const { s, bus, enemies } = scene([[100, 0], [-120, 20], [0, 140]]);
    const upor = s.player.stats.upor;
    expect(cast3(s, bus, 'pelnia', 1)).toBe(true);
    const moons = s.summons.filter((m) => m.variant === 'moon');
    expect(moons).toHaveLength(3);
    expect(moons[0]?.ttl).toBeGreaterThan(7.9);
    tick(s, bus, 0.3);
    expect(s.player.stats.upor).toBe(upor + 30);
    const reach = (): number => Math.max(...moons.map((m) => Math.hypot(m.x - s.player.x, m.y - s.player.y)));
    const early = reach();
    tick(s, bus, 5);
    expect(reach()).toBeGreaterThan(early + 20);
    expect(reach()).toBeLessThanOrEqual(161);
    expect(enemies.some((e) => lost(e) > 0)).toBe(true);
    tick(s, bus, 3);
    expect(s.summons.filter((m) => m.variant === 'moon')).toHaveLength(0);
    expect(s.player.stats.upor).toBe(upor);
  });

  it('Pelnia § 2 is mechaniczny and the moons knock back; § 3 is regulaminowy with two moons that stay 14 s', () => {
    const a = scene([[90, 0]]);
    cast3(a.s, a.bus, 'pelnia', 2);
    expect(a.s.summons.filter((m) => m.variant === 'moon' && m.orbit?.knock === 40)).toHaveLength(3);
    tick(a.s, a.bus, 3);
    expect(Math.hypot(a.enemies[0]!.x - 690, a.enemies[0]!.y - 800)).toBeGreaterThan(20);
    const b = scene([[500, 0]]);
    cast3(b.s, b.bus, 'pelnia', 3);
    const moons = b.s.summons.filter((m) => m.variant === 'moon');
    expect(moons).toHaveLength(2);
    expect(moons[0]?.ttl).toBeGreaterThan(13.9);
    tick(b.s, b.bus, 9);
    expect(ultimateActive(b.s)).toBe(false);
    expect(b.s.summons.filter((m) => m.variant === 'moon')).toHaveLength(2);
    tick(b.s, b.bus, 5.5);
    expect(b.s.summons.filter((m) => m.variant === 'moon')).toHaveLength(0);
    expect(b.s.player.stats.upor).toBe(heroDef('nalesnik').baseStats.upor);
  });

  it('Decyzja Komisji keeps working as the first ultimate', () => {
    const { s, bus, enemies } = scene([[120, 0]]);
    expect(cast3(s, bus, 'decyzjaKomisji', 1)).toBe(true);
    tick(s, bus, 0.2);
    expect(hasStatus(enemies[0]!, 'zablokowany')).toBe(true);
  });
});

describe('passives', () => {
  it('8 Pory: a skimmed shot returns 0.3x mechaniczny to the enemy that fired it; without the passive, nothing', () => {
    for (const taken of [true, false]) {
      const { s, bus, enemies } = scene([[200, 0]]);
      s.player.hp = s.player.hpMax; // flat above 90%: projectiles skim off
      if (taken) s.hero.upgrades['passive8'] = 1;
      s.projectiles.push({ kind: 'projectile', id: nextId(s), x: s.player.x + 2, y: s.player.y, r: 5, vx: 0, vy: 0, ttl: 1, damage: 10, damageType: 'mechaniczny', owner: 'enemy', from: enemies[0]!.id });
      updateEnemyProjectiles(s, bus, DT);
      expect(lost(enemies[0]!), String(taken)).toBe(taken ? 3 : 0);
    }
  });

  it('8 Pory does not answer a shot that was not skimmed (racja below 90%)', () => {
    const { s, bus, enemies } = scene([[200, 0]]);
    s.player.hp = Math.round(s.player.hpMax * 0.5);
    s.hero.upgrades['passive8'] = 1;
    s.projectiles.push({ kind: 'projectile', id: nextId(s), x: s.player.x + 2, y: s.player.y, r: 5, vx: 0, vy: 0, ttl: 1, damage: 10, damageType: 'mechaniczny', owner: 'enemy', from: enemies[0]!.id });
    updateEnemyProjectiles(s, bus, DT);
    expect(lost(enemies[0]!)).toBe(0);
  });

  it('9 Masa krytyczna: each enemy Grawitacja pulls adds 3% (at most 30%) to the next Plywy, which spends it', () => {
    const offs: [number, number][] = [];
    for (let k = 0; k < 12; k++) offs.push([Math.cos(k) * 120 + (k % 2) * 25, Math.sin(k) * 120]);
    const strike = (taken: boolean): { bonus: number; dmg: number; after: number } => {
      const { s, bus, enemies } = scene(offs);
      if (taken) s.hero.upgrades['passive9'] = 1;
      cast(s, bus, IX.grawitacja, 1);
      tick(s, bus, 2.2);
      const bonus = nalState(s).mass;
      for (const e of enemies) e.hp = e.hpMax;
      cast(s, bus, IX.plywy, 1);
      tick(s, bus, 0.6);
      const dmg = lost(enemies[0]!);
      const after = nalState(s).mass;
      return { bonus, dmg, after };
    };
    const base = strike(false);
    const mass = strike(true);
    expect(base.bonus).toBe(0);
    expect(mass.bonus).toBeCloseTo(0.3, 5);
    expect(mass.after).toBe(0);
    expect(mass.dmg).toBe(Math.round(base.dmg * 1.3));
  });

  it('10 Satelita staly: the satellite of Orbita stays past 3 s and takes 0.2x a second; without it, it is let go at 3 s', () => {
    for (const taken of [true, false]) {
      const { s, bus, enemies } = scene([[60, 0]]);
      if (taken) s.hero.upgrades['passive10'] = 1;
      cast(s, bus, IX.orbita, 1, { kind: 'kierunek', dx: 1, dy: 0 });
      tick(s, bus, 0.6);
      expect(s.hero.orbit, String(taken)).not.toBeNull();
      const caught = lost(enemies[0]!);
      tick(s, bus, 5);
      expect(s.hero.orbit !== null, String(taken)).toBe(taken);
      if (taken) expect(lost(enemies[0]!) - caught).toBeGreaterThanOrEqual(hit(0.2) * 3);
      else expect(lost(enemies[0]!)).toBe(caught);
    }
  });

  it('7 Rownowaga hydrostatyczna is the rule: always on, never offered', () => {
    expect(heroById('nalesnik').passives[6]?.rule).toBe(true);
    const { s } = scene([]);
    s.player.hp = s.player.hpMax;
    expect(projectileDamageMul(s.player)).toBe(0.7);
  });

  it('applyDamage is untouched for the others: no bonus without passive 9', () => {
    const { s, bus, enemies } = scene([[100, 0]]);
    applyDamage(s, bus, enemies[0]!, 100, false, 'mechaniczny');
    expect(lost(enemies[0]!)).toBe(100);
  });
});
