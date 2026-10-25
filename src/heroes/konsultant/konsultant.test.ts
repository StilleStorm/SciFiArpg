/** The Konsultant filled (S19): skills 6 to 10 in every paragraph and aim, the two new ultimates, passives 8 to 10, the folder's data. */
import { describe, expect, it } from 'vitest';
import { getStatus, hasStatus } from '../../combat/status';
import { createBus, type Bus } from '../../core/events';
import { createEnemy } from '../../entities/factory';
import type { Enemy } from '../../entities/types';
import { recomputeStats } from '../../items/stats';
import { t } from '../../i18n';
import { setRunParagraph } from '../../progression/paragraphs';
import { createRun, nextId, type RunState } from '../../world/run';
import type { Aim } from '../aim';
import { heroDef, skillAt, type SkillIndex } from '../defs';
import { assignPad } from '../loadout';
import { patchFields, PATCH_FIELD_LIMIT, type ParagraphNo } from '../paragraphs';
import { heroById } from '../registry';
import { castSkill } from '../skills';
import { heroStep } from '../system';
import { castUltimate, setUltimateParagraph, ultimateActive, ultimateSeconds } from '../ultimate';
import { MAX_ULT_RADIUS, MAX_ULT_S } from '../ultimateDefs';
import { IX, NUMEREK_MAX, OPLATY_MAX } from './numbers';
import { konsState } from './state';
import { priceCut } from './quirk';
import { priceCut as dispatchPriceCut } from '../quirks';
import { feeOf, totalOf } from '../../economy/sklep';
import { createRng } from '../../core/rng';
import { equipItem } from '../../items/inventory';
import { makeSetPiece } from '../../items/setPieces';
import type { SetId } from '../../items/sets';

const DT = 1 / 60;
const SKILL_IDS = ['zgloszenie', 'formularz', 'muzyka', 'przerwaTechniczna', 'oddzwonimy'] as const;
const FIRST_NEW = IX.zgloszenie;

function scene(offsets: [number, number][], hp = 5000): { s: RunState; bus: Bus; enemies: Enemy[] } {
  const bus = createBus();
  const s = createRun(5, { heroId: 'konsultant' });
  s.enemies.length = 0;
  s.page.obstacles.length = 0;
  s.player.x = 600;
  s.player.y = 800;
  s.player.baseStats.stats.dmgMin = 10;
  s.player.baseStats.stats.dmgMax = 10;
  s.player.baseStats.stats.critChance = 0;
  recomputeStats(s.player);
  s.player.hp = s.player.hpMax = 1e6;
  s.player.level = 36;
  for (let i = 3; i <= 9; i++) s.hero.ranks[i] = 1; // every skill installed
  const enemies = offsets.map(([dx, dy]) => {
    const e = createEnemy(nextId(s), s.player.x + dx, s.player.y + dy, 1);
    e.hp = e.hpMax = hp;
    e.stats.upor = 0;
    e.stats.resist = {};
    e.claim = undefined;
    e.attackTimer = 999;
    s.enemies.push(e);
    return e;
  });
  return { s, bus, enemies };
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
  expect(assignPad(s, 0, i)).toBe(true);
  expect(setRunParagraph(s, skillAt(heroDef('konsultant'), i).id, n, true)).toBe(true);
  return castSkill(s, bus, 0, false, aim);
}

describe('the folder', () => {
  const m = heroById('konsultant');
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

  it('puts every skill in one column of the chart, in one category, and keeps the old ids', () => {
    const specs = m.specs;
    expect(specs).toBeDefined();
    const ids = m.def.skills.map((k) => k.id);
    expect(ids.slice(0, 5)).toEqual(['prosze', 'przekierowuje', 'pomoc', 'numer', 'rozlaczenie']);
    expect(ids).toContain('muzyka');
    expect(ids).toContain('przerwaTechniczna');
    const columns = (specs?.list ?? []).flatMap((c) => c.skills);
    expect([...columns].sort()).toEqual([...ids].sort());
    for (const id of ids) expect(specs?.categories[id], id).toBeDefined();
    const count = (c: string): number => ids.filter((id) => specs?.categories[id] === c).length;
    expect([count('podstawowa'), count('ofensywna'), count('obronna'), count('uzytkowa')]).toEqual([2, 3, 2, 3]);
  });

  it('opens the new skills by level as SKILLS.md says, and keeps one skill of each damage type by level 7', () => {
    const lvl = (id: string): number => m.paragraphs[id]?.level ?? 99;
    expect([lvl('zgloszenie'), lvl('formularz'), lvl('muzyka'), lvl('przerwaTechniczna'), lvl('oddzwonimy')]).toEqual([1, 3, 1, 3, 14]);
    const types = new Set(m.def.skills.filter((k) => lvl(k.id) <= 7).map((k) => k.type));
    expect(types).toEqual(new Set(['regulaminowy', 'egzystencjalny', 'mechaniczny']));
  });

  it('has Polish text for every key it names, and the first-cast notes', () => {
    for (const sk of m.def.skills) for (const k of [sk.nameKey, sk.padKey, sk.descKey]) expect(t(k), k).not.toBe(k);
    for (const u of m.ultimates ?? []) {
      for (const k of [u.nameKey, u.descKey, u.stampKey, u.noteKey, ...u.list.flatMap((p) => [p.nameKey, p.descKey])]) expect(t(k), k).not.toBe(k);
      expect(t(u.stampKey)).toBe(t(u.stampKey).toUpperCase());
    }
    for (const n of [7, 8, 9, 10]) for (const part of ['name', 'desc']) expect(t(`forms.update.passive.konsultant.${n}.${part}`)).not.toContain('forms.update');
    for (const id of ['zgloszenie', 'formularz', 'przerwa', 'oddzwonimy']) expect(t(`heroes.konsultant.note.${id}`)).not.toContain('heroes.konsultant');
  });
});

describe('every new skill in every paragraph and aim', () => {
  const aims: Record<string, Aim> = {
    auto: { kind: 'auto' },
    kierunek: { kind: 'kierunek', dx: 1, dy: 0 },
    wskazanie: { kind: 'wskazanie', x: 700, y: 800 },
  };
  for (const [offset, id] of SKILL_IDS.entries()) {
    const i = (FIRST_NEW + offset) as SkillIndex;
    for (const n of [1, 2, 3] as const) {
      for (const [aimName, aim] of Object.entries(aims)) {
        it(`${id} § ${n} with ${aimName} aim casts, spends its cooldown, and leaves something`, () => {
          const { s, bus, enemies } = scene([[90, 0], [140, 20], [60, -50], [-80, 10]]);
          expect(cast(s, bus, i, n, aim), id).toBe(true);
          expect(s.hero.cd[i] ?? 0).toBeGreaterThan(0);
          tick(s, bus, 0.4);
          const hurt = enemies.some((e) => lost(e) > 0);
          const marked = enemies.some((e) => e.statuses.length > 0);
          const things = s.zones.length + s.summons.length;
          const kons = konsState(s);
          const pending = kons.timers.length + kons.forms.size + kons.chairs.size + (kons.aura ? 1 : 0);
          expect(hurt || marked || things > 0 || pending > 0 || s.player.x !== 600 || s.player.y !== 800, `${id} § ${n} ${aimName}`).toBe(true);
          expect(s.player.hp).toBeGreaterThan(0);
        });
      }
    }
  }
});

describe('Zgloszenie przyjete', () => {
  it('§ 1 hits the target for 0.8x and bounces to the nearest other enemy within 90, not to one further', () => {
    const { s, bus, enemies } = scene([[100, 0], [160, 0], [100, 200]]);
    cast(s, bus, IX.zgloszenie, 1);
    expect(lost(enemies[0]!)).toBe(hit(0.8));
    expect(lost(enemies[1]!)).toBe(hit(0.8));
    expect(lost(enemies[2]!)).toBe(0);
  });

  it('§ 2 fires three tickets in a fan for 0.5x each and does not bounce', () => {
    const { s, bus, enemies } = scene([[120, 0], [120, 50], [120, -50], [190, 10]]);
    cast(s, bus, IX.zgloszenie, 2);
    const hurt = enemies.filter((e) => lost(e) > 0);
    expect(hurt.length).toBeGreaterThanOrEqual(2);
    for (const e of hurt) expect(lost(e)).toBe(hit(0.5));
    expect(enemies[3]!.hp).toBe(enemies[3]!.hpMax);
  });

  it('§ 3 is egzystencjalny, 1.3x, with no bounce', () => {
    const { s, bus, enemies } = scene([[100, 0], [150, 0]]);
    cast(s, bus, IX.zgloszenie, 3);
    expect(lost(enemies[0]!)).toBe(hit(1.3));
    expect(lost(enemies[1]!)).toBe(0);
  });

  it('is refused when nobody is in reach', () => {
    const { s, bus } = scene([[900, 0]]);
    expect(cast(s, bus, IX.zgloszenie, 1)).toBe(false);
    expect(s.hero.cd[IX.zgloszenie] ?? 0).toBe(0);
  });
});

describe('Formularz kontaktowy', () => {
  it('§ 1 lays a form of 60 for 3 s: those on it are slowed and take 0.3x a second, those off it nothing', () => {
    const { s, bus, enemies } = scene([[80, 0], [100, 20], [250, 0]]);
    cast(s, bus, IX.formularz, 1, { kind: 'wskazanie', x: 690, y: 810 });
    const z = s.zones.find((x) => x.variant === 'formularz');
    expect(z?.r).toBe(60 * 1.12);
    tick(s, bus, 2.1);
    expect(hasStatus(enemies[0]!, 'do_weryfikacji')).toBe(true);
    expect(lost(enemies[0]!)).toBe(2 * hit(0.3));
    expect(lost(enemies[2]!)).toBe(0);
    tick(s, bus, 1.5);
    expect(s.zones.some((x) => x.variant === 'formularz')).toBe(false);
  });

  it('§ 2 zablokowany the first enemy on it for 1 s, not the others', () => {
    const { s, bus, enemies } = scene([[80, 0], [100, 25]]);
    cast(s, bus, IX.formularz, 2, { kind: 'wskazanie', x: 685, y: 805 });
    const blocked = enemies.filter((e) => hasStatus(e, 'zablokowany'));
    expect(blocked).toHaveLength(1);
    expect(getStatus(blocked[0]!, 'zablokowany')?.remaining).toBeCloseTo(1, 1);
  });

  it('§ 3 holds those inside on the circle for 1.5 s, and lets them go after', () => {
    const { s, bus, enemies } = scene([[80, 0]]);
    cast(s, bus, IX.formularz, 3, { kind: 'wskazanie', x: 680, y: 800 });
    const e = enemies[0]!;
    for (let i = 0; i < 60; i++) {
      e.x += 3;
      tick(s, bus, DT);
    }
    expect(Math.hypot(e.x - 680, e.y - 800)).toBeLessThanOrEqual(60 * 1.12);
    tick(s, bus, 1);
    e.x += 200;
    tick(s, bus, DT);
    expect(Math.hypot(e.x - 680, e.y - 800)).toBeGreaterThan(100);
  });
});

describe('Muzyka w sluchawce', () => {
  const resist = (s: RunState): number => s.player.stats.resist['regulaminowy'] ?? 0;

  it('§ 1 lifts the resist by 30 for 4 s, slows those within 120, and gives the points back', () => {
    const { s, bus, enemies } = scene([[100, 0], [300, 0]]);
    const before = resist(s);
    cast(s, bus, IX.muzyka, 1);
    expect(resist(s)).toBe(Math.min(75, before + 30));
    tick(s, bus, 1);
    expect(hasStatus(enemies[0]!, 'do_weryfikacji')).toBe(true);
    expect(hasStatus(enemies[1]!, 'do_weryfikacji')).toBe(false);
    expect(s.zones.some((z) => z.variant === 'stave')).toBe(true);
    tick(s, bus, 4);
    expect(resist(s)).toBe(before);
    expect(s.zones.some((z) => z.variant === 'stave')).toBe(false);
  });

  it('playing it twice does not stack the points', () => {
    const { s, bus } = scene([[100, 0]]);
    const before = resist(s);
    cast(s, bus, IX.muzyka, 1);
    s.hero.cd[IX.muzyka] = 0;
    castSkill(s, bus, 0, false);
    expect(resist(s)).toBe(Math.min(75, before + 30));
    tick(s, bus, 6);
    expect(resist(s)).toBe(before);
  });

  it('§ 2 reaches 180 and takes off 15; § 3 plays 2 s and silences those within 120', () => {
    const a = scene([[150, 0], [100, 0]]);
    const before = resist(a.s);
    cast(a.s, a.bus, IX.muzyka, 2);
    expect(resist(a.s)).toBe(before + 15);
    tick(a.s, a.bus, 0.5);
    expect(hasStatus(a.enemies[0]!, 'do_weryfikacji')).toBe(true);
    const b = scene([[100, 0], [160, 0]]);
    cast(b.s, b.bus, IX.muzyka, 3);
    tick(b.s, b.bus, 0.5);
    expect(hasStatus(b.enemies[0]!, 'wyciszony')).toBe(true);
    expect(hasStatus(b.enemies[1]!, 'wyciszony')).toBe(false);
    tick(b.s, b.bus, 2.5);
    expect(b.s.zones.some((z) => z.variant === 'stave')).toBe(false);
  });
});

describe('Przerwa techniczna', () => {
  it('§ 1 steps back 120 along the aim and leaves a chair that holds those within 100 for 2 s', () => {
    const { s, bus, enemies } = scene([[60, 0], [90, 40]]);
    cast(s, bus, IX.przerwa, 1, { kind: 'kierunek', dx: -1, dy: 0 });
    expect(s.player.x).toBeCloseTo(480, 0);
    const chair = s.summons.find((m) => m.variant === 'chair');
    expect(chair?.x).toBeCloseTo(600, 0);
    tick(s, bus, 0.5);
    const taunt = getStatus(enemies[0]!, 'przeczytane');
    expect(taunt?.source).toBe(chair?.id);
    tick(s, bus, 2.5);
    expect(s.summons.some((m) => m.variant === 'chair')).toBe(false);
  });

  it('a tap steps away from the nearest enemy', () => {
    const { s, bus } = scene([[70, 0]]);
    cast(s, bus, IX.przerwa, 1);
    expect(s.player.x).toBeLessThan(500);
  });

  it('§ 2 steps 80 and keeps the chair 4 s', () => {
    const { s, bus } = scene([[70, 0]]);
    cast(s, bus, IX.przerwa, 2, { kind: 'kierunek', dx: 0, dy: -1 });
    expect(s.player.y).toBeCloseTo(720, 0);
    tick(s, bus, 3);
    expect(s.summons.some((m) => m.variant === 'chair')).toBe(true);
    tick(s, bus, 2);
    expect(s.summons.some((m) => m.variant === 'chair')).toBe(false);
  });

  it('§ 3 is regulaminowy and the chair strikes those who touch it for 0.6x a second', () => {
    const { s, bus, enemies } = scene([[20, 0], [200, 0]]);
    cast(s, bus, IX.przerwa, 3, { kind: 'kierunek', dx: -1, dy: 0 });
    tick(s, bus, 0.55);
    expect(lost(enemies[0]!)).toBe(hit(0.6));
    expect(lost(enemies[1]!)).toBe(0);
  });
});

describe('Oddzwonimy', () => {
  it('§ 1 rings after 3 s: those within 110 read it and are struck for 1.2x some time after; those outside are not', () => {
    const { s, bus, enemies } = scene([[110, 0], [150, 0], [330, 0]]);
    cast(s, bus, IX.oddzwonimy, 1, { kind: 'wskazanie', x: 730, y: 800 });
    const phone = s.summons.find((m) => m.variant === 'phone');
    expect(phone).toBeDefined();
    tick(s, bus, 2.9);
    expect(enemies.some((e) => hasStatus(e, 'przeczytane'))).toBe(false);
    tick(s, bus, 0.3);
    expect(getStatus(enemies[0]!, 'przeczytane')?.source).toBe(phone?.id);
    expect(hasStatus(enemies[2]!, 'przeczytane')).toBe(false);
    expect(lost(enemies[0]!)).toBe(0);
    tick(s, bus, 2);
    expect(lost(enemies[0]!)).toBe(hit(1.2));
    expect(lost(enemies[2]!)).toBe(0);
  });

  it('§ 2 rings after 1 s in a radius of 80', () => {
    const { s, bus, enemies } = scene([[110, 0], [230, 0]]);
    cast(s, bus, IX.oddzwonimy, 2, { kind: 'wskazanie', x: 710, y: 800 });
    tick(s, bus, 1.1);
    expect(hasStatus(enemies[0]!, 'przeczytane')).toBe(true);
    expect(hasStatus(enemies[1]!, 'przeczytane')).toBe(false);
  });

  it('§ 3 is mechaniczny and throws the nearest enemy 120 as it rings', () => {
    const { s, bus, enemies } = scene([[110, 0]]);
    cast(s, bus, IX.oddzwonimy, 3, { kind: 'wskazanie', x: 650, y: 800 });
    const x0 = enemies[0]!.x;
    tick(s, bus, 3.1);
    expect(Math.abs(enemies[0]!.x - x0)).toBeGreaterThan(60);
  });
});

describe('the ultimates 2 and 3', () => {
  const m = heroById('konsultant');
  const ult = (id: string) => {
    const u = m.ultimates?.find((x) => x.id === id);
    if (!u) throw new Error(id);
    return u;
  };

  it('keep the limits in every paragraph: at most 8 s, radius at most 220, patches of at most four fields, one price at least, one page-wide at most', () => {
    expect((m.ultimates ?? []).filter((u) => u.pageWide)).toHaveLength(1);
    for (const u of (m.ultimates ?? []).slice(1)) {
      expect(u.radius === null || u.radius <= MAX_ULT_RADIUS).toBe(true);
      for (const p of u.list) {
        expect(ultimateSeconds(u, p.n), `${u.id} ${p.n}`).toBeLessThanOrEqual(MAX_ULT_S);
        expect(patchFields(p.patch)).toBeLessThanOrEqual(PATCH_FIELD_LIMIT);
        for (const v of [p.tune.radius, p.tune.pull]) if (v !== undefined) expect(v).toBeLessThanOrEqual(MAX_ULT_RADIUS);
      }
      expect(patchFields(u.list[0].patch)).toBe(0);
      expect(u.list.some((p) => (p.patch.cost ?? 0) > 0)).toBe(true);
    }
  });

  function cast3(s: RunState, bus: Bus, id: string, n: ParagraphNo): boolean {
    s.hero.ultimateId = id;
    setUltimateParagraph(s, n);
    s.player.meter = 1;
    return castUltimate(s, bus);
  }

  it('are closed below their level', () => {
    const { s, bus } = scene([[80, 0]]);
    s.player.level = 23;
    expect(cast3(s, bus, 'koniecKolejki', 1)).toBe(false);
    s.player.level = 35;
    expect(cast3(s, bus, 'ankieta', 1)).toBe(false);
  });

  for (const id of ['koniecKolejki', 'ankieta']) {
    for (const n of [1, 2, 3] as const) {
      it(`${id} § ${n} casts once, ends by itself within its seconds, and leaves nobody stuck`, () => {
        const { s, bus, enemies } = scene([[80, 0], [130, 30], [-100, 20], [200, -60], [60, 120]]);
        expect(cast3(s, bus, id, n)).toBe(true);
        expect(ultimateActive(s)).toBe(true);
        tick(s, bus, ultimateSeconds(ult(id), n) + 0.2);
        expect(ultimateActive(s)).toBe(false);
        expect(enemies.some((e) => lost(e) > 0)).toBe(true);
      });
    }
  }

  it('Koniec kolejki § 1 puts the carriers of his status in a line before him and disconnects them one by one, nearest first, each for 1.6x', () => {
    const { s, bus, enemies } = scene([[150, 90], [-120, 40], [100, -150], [250, 0]]);
    for (const e of enemies.slice(0, 3)) e.statuses.push({ kind: 'do_weryfikacji', remaining: 10, source: s.player.id });
    cast3(s, bus, 'koniecKolejki', 1);
    const xs = enemies.slice(0, 3).map((e) => Math.hypot(e.x - 600, e.y - 800));
    for (const d of xs) expect(d).toBeLessThan(64 + 40 * 3 + 20);
    expect(lost(enemies[3]!)).toBe(0); // the fourth does not carry it, and three are already queued
    tick(s, bus, 1.1);
    const struck = enemies.slice(0, 3).filter((e) => lost(e) > 0).length;
    expect(struck).toBeGreaterThanOrEqual(1);
    expect(struck).toBeLessThan(3);
    tick(s, bus, 1.5);
    for (const e of enemies.slice(0, 3)) expect(lost(e)).toBe(blow(1.6));
    expect(lost(enemies[3]!)).toBe(0);
  });

  it('Koniec kolejki § 2 starts with the furthest; § 3 does not throw and blocks for 3 s', () => {
    const a = scene([[60, 0], [120, 0], [180, 0]]);
    for (const e of a.enemies) e.statuses.push({ kind: 'do_weryfikacji', remaining: 10, source: a.s.player.id });
    cast3(a.s, a.bus, 'koniecKolejki', 2);
    tick(a.s, a.bus, 0.9);
    const first = a.enemies.filter((e) => lost(e) > 0);
    expect(first).toHaveLength(1);
    expect(first[0]).toBe(a.enemies[2]);
    const b = scene([[60, 0], [120, 0]]);
    for (const e of b.enemies) e.statuses.push({ kind: 'do_weryfikacji', remaining: 10, source: b.s.player.id });
    cast3(b.s, b.bus, 'koniecKolejki', 3);
    expect(getStatus(b.enemies[0]!, 'zablokowany')?.remaining).toBeCloseTo(3, 0);
    const x = b.enemies[0]!.x;
    tick(b.s, b.bus, 3);
    expect(b.enemies[0]!.x).toBeCloseTo(x, 0);
  });

  it('Koniec kolejki queues the nearest when nobody carries his status, and leaves a boss out of the line', () => {
    const { s, bus, enemies } = scene([[100, 0], [140, 40], [-90, 30], [210, 0]]);
    enemies[3]!.boss = true;
    cast3(s, bus, 'koniecKolejki', 1);
    expect(enemies.slice(0, 3).every((e) => hasStatus(e, 'zablokowany'))).toBe(true);
    expect(enemies[3]!.x).toBe(810);
  });

  it('Ankieta § 1 puts the form where most stand, blocks those on it 2 s, then strikes for 2.0x; a death on it pays a gwiazdka more', () => {
    const { s, bus, enemies } = scene([[120, 0], [150, 30], [130, -30], [-150, 10]], 5000);
    enemies[1]!.hp = enemies[1]!.hpMax = 12; // falls to the rating
    const gw = s.player.gwiazdki;
    cast3(s, bus, 'ankieta', 1);
    const rec = s.hero.ult?.active[0];
    expect(rec?.x).toBeGreaterThan(650);
    expect(hasStatus(enemies[0]!, 'zablokowany')).toBe(true);
    expect(hasStatus(enemies[3]!, 'zablokowany')).toBe(false);
    tick(s, bus, 1.5);
    expect(lost(enemies[0]!)).toBe(0);
    tick(s, bus, 1.5);
    expect(lost(enemies[0]!)).toBe(blow(2));
    expect(s.enemies.includes(enemies[1]!)).toBe(false);
    expect(s.player.gwiazdki).toBeGreaterThan(gw);
    expect(lost(enemies[3]!)).toBe(0);
  });

  it('Ankieta § 2 has a radius of 100 and strikes for 3.0x; § 3 is regulaminowa and pulls those within 220 onto the form', () => {
    const a = scene([[130, 0], [130, 150]]);
    cast3(a.s, a.bus, 'ankieta', 2);
    expect(a.s.hero.ult?.active[0]?.r).toBe(100);
    expect(hasStatus(a.enemies[0]!, 'zablokowany')).toBe(true);
    expect(hasStatus(a.enemies[1]!, 'zablokowany')).toBe(false);
    tick(a.s, a.bus, 2.2);
    expect(lost(a.enemies[0]!)).toBe(blow(3));
    const b = scene([[130, 0], [130, 200]]);
    cast3(b.s, b.bus, 'ankieta', 3);
    const rec = b.s.hero.ult?.active[0];
    expect(rec).toBeDefined();
    expect(Math.hypot(b.enemies[1]!.x - (rec?.x ?? 0), b.enemies[1]!.y - (rec?.y ?? 0))).toBeLessThanOrEqual(160);
    expect(hasStatus(b.enemies[1]!, 'zablokowany')).toBe(true);
  });
});

describe('the passives 8 to 10', () => {
  it('8 Numerek: kills in the order of the numbers add 3% crit a step, at most 15%, out of order they drop the chain, and it runs out', () => {
    const { s, bus, enemies } = scene([[80, 0], [120, 0], [160, 0], [200, 0], [240, 0], [280, 0], [320, 0]], 50);
    s.hero.upgrades['passive8'] = 1;
    for (const e of enemies) e.statuses.push({ kind: 'zablokowany', remaining: 60, source: s.player.id });
    tick(s, bus, 0.1);
    const crit = (): number => s.player.stats.critChance;
    const base = crit();
    const kill = (e: Enemy): void => {
      s.enemies.splice(s.enemies.indexOf(e), 1);
      s.kills++;
      tick(s, bus, DT);
    };
    kill(enemies[0]!);
    expect(crit()).toBeCloseTo(base + 0.03, 5);
    kill(enemies[1]!);
    expect(crit()).toBeCloseTo(base + 0.06, 5);
    kill(enemies[3]!); // out of order
    expect(crit()).toBeCloseTo(base, 5);
    kill(enemies[2]!);
    kill(enemies[4]!);
    kill(enemies[5]!);
    kill(enemies[6]!);
    expect(crit()).toBeLessThanOrEqual(base + NUMEREK_MAX + 1e-9);
    expect(crit()).toBeGreaterThan(base);
    tick(s, bus, 9);
    expect(crit()).toBeCloseTo(base, 5);
  });

  it('without the passive nothing is numbered and the tick does nothing', () => {
    const { s, bus, enemies } = scene([[80, 0]]);
    enemies[0]!.statuses.push({ kind: 'zablokowany', remaining: 60, source: s.player.id });
    tick(s, bus, 0.5);
    expect(s.player.stats.critChance).toBe(0.1 * 0 + s.player.stats.critChance);
    expect(konsState(s).numbered.size).toBe(0);
  });

  it('9 Polaczenie nagrywane: a blocked enemy that falls leaves its claim on the floor 3 s; the next to step on it takes the claim', () => {
    const { s, bus, enemies } = scene([[100, 0], [400, 0], [300, 300]], 50);
    s.hero.upgrades['passive9'] = 1;
    enemies[0]!.claim = { textKey: 'enemies.claim.wygenerowane.resolution', type: 'mechaniczny' };
    enemies[0]!.statuses.push({ kind: 'zablokowany', remaining: 60, source: s.player.id });
    tick(s, bus, 0.1);
    s.enemies.splice(s.enemies.indexOf(enemies[0]!), 1);
    s.kills++;
    tick(s, bus, DT);
    const bubble = s.zones.find((z) => z.variant === 'nagranie');
    expect(bubble).toBeDefined();
    enemies[1]!.x = bubble?.x ?? 0;
    enemies[1]!.y = bubble?.y ?? 0;
    tick(s, bus, DT);
    expect(enemies[1]!.claim?.textKey).toBe('enemies.claim.wygenerowane.resolution');
    expect(enemies[1]!.claim?.type).toBe('mechaniczny');
    expect(s.zones.some((z) => z.variant === 'nagranie')).toBe(false);
    expect(enemies[2]!.claim).toBeUndefined();
  });

  it('9: a bubble nobody steps on is gone after 3 s, and a kill without a block leaves none', () => {
    const { s, bus, enemies } = scene([[100, 0], [200, 0]], 50);
    s.hero.upgrades['passive9'] = 1;
    enemies[0]!.claim = { textKey: 'k', type: 'mechaniczny' };
    enemies[1]!.claim = { textKey: 'k', type: 'mechaniczny' };
    enemies[0]!.statuses.push({ kind: 'zablokowany', remaining: 60, source: s.player.id });
    tick(s, bus, 0.1);
    for (const e of enemies) {
      s.enemies.splice(s.enemies.indexOf(e), 1);
      s.kills++;
    }
    tick(s, bus, DT);
    expect(s.zones.filter((z) => z.variant === 'nagranie')).toHaveLength(1);
    tick(s, bus, 3.2);
    expect(s.zones.some((z) => z.variant === 'nagranie')).toBe(false);
  });

  it('10 Wstrzymanie oplat: each Czy moge jeszcze w czyms pomoc cuts the fee 10%, at most 30%; without the passive nothing', () => {
    const { s, bus } = scene([[100, 0]]);
    expect(priceCut(s)).toBe(0);
    castOnce(s, bus);
    expect(priceCut(s)).toBe(0);
    s.hero.upgrades['passive10'] = 1;
    for (let k = 0; k < 5; k++) castOnce(s, bus);
    expect(priceCut(s)).toBeCloseTo(OPLATY_MAX, 9);
    expect(heroById('konsultant').quirk?.priceCut?.(s)).toBeCloseTo(OPLATY_MAX, 9);
    // the Sklep checkouts read it through heroes/quirks.ts: the 20% fee of a 100 listing becomes 14
    expect(dispatchPriceCut(s)).toBeCloseTo(OPLATY_MAX, 9);
    expect(feeOf(100, dispatchPriceCut(s))).toBe(14);
    expect(totalOf(100, dispatchPriceCut(s))).toBe(114);
  });

  function castOnce(s: RunState, bus: Bus): void {
    s.hero.cd[2] = 0;
    assignPad(s, 0, 2);
    castSkill(s, bus, 0, false);
  }
});

describe('the S17 set patches that waited for his skills (S19 integrator)', () => {
  const wearSet = (s: RunState, set: SetId): void => {
    for (let i = 0; i < 3; i++) {
      const item = makeSetPiece(createRng(30 + i), set, 5, i as 0 | 1 | 2);
      if (!item) throw new Error(set);
      item.number = 100 + i;
      s.player.inventory.push(item);
      equipItem(s.player, item);
    }
  };

  it('«Ostatnia mila» lengthens Przerwa techniczna\'s step 1.35x', () => {
    const { s, bus } = scene([[60, 0]]);
    wearSet(s, 'ostatnia-mila');
    cast(s, bus, IX.przerwa, 1, { kind: 'kierunek', dx: -1, dy: 0 });
    expect(s.player.x).toBeCloseTo(600 - 120 * 1.35, 0);
  });

  it('«Infolinia» widens Muzyka w sluchawce from 120 to 144', () => {
    const { s, bus, enemies } = scene([[135, 0]]);
    wearSet(s, 'infolinia');
    cast(s, bus, IX.muzyka, 1);
    tick(s, bus, 1);
    expect(hasStatus(enemies[0]!, 'do_weryfikacji')).toBe(true);
  });
});
