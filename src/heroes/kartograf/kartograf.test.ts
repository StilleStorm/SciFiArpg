/** The Kartograf filled (S20): skills 6 to 10 in every paragraph and aim, the two new ultimates, passives 7 to 10, the folder's data. */
import { describe, expect, it } from 'vitest';
import { getStatus, hasStatus } from '../../combat/status';
import { createBus, type Bus } from '../../core/events';
import { createEnemy } from '../../entities/factory';
import type { Enemy } from '../../entities/types';
import { t } from '../../i18n';
import { recomputeStats } from '../../items/stats';
import { setRunParagraph } from '../../progression/paragraphs';
import { applyDamage } from '../../systems/combat';
import { createRun, nextId, type RunState } from '../../world/run';
import type { Aim } from '../aim';
import { benchmarkNear } from '../steps2';
import { heroDef, skillAt, type SkillIndex } from '../defs';
import { assignPad } from '../loadout';
import { patchFields, PATCH_FIELD_LIMIT, type ParagraphNo } from '../paragraphs';
import { heroById } from '../registry';
import { castSkill } from '../skills';
import { heroStep } from '../system';
import { castUltimate, setUltimateParagraph, ultimateActive, ultimateSeconds } from '../ultimate';
import { MAX_ULT_RADIUS, MAX_ULT_S } from '../ultimateDefs';
import { IX } from './numbers';
import { distanceMul, misnamedSlow } from './quirk';
import { kartState } from './state';

const DT = 1 / 60;
const SKILL_IDS = ['pomiar', 'przekroj', 'granica', 'punktOdniesienia', 'rozaWiatrow'] as const;

function scene(offsets: [number, number][], hp = 5000): { s: RunState; bus: Bus; enemies: Enemy[]; notes: { text: string; correction?: boolean }[] } {
  const bus = createBus();
  const notes: { text: string; correction?: boolean }[] = [];
  bus.on('footnote', (e) => notes.push(e));
  const s = createRun(5, { heroId: 'kartograf' });
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
  for (let i = 3; i <= 10; i++) s.hero.ranks[i] = 1; // every skill installed
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
  expect(setRunParagraph(s, skillAt(heroDef('kartograf'), i).id, n, true)).toBe(true);
  s.hero.cd[i] = 0;
  return castSkill(s, bus, 0, false, aim);
}

describe('the folder', () => {
  const m = heroById('kartograf');
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
    expect(ids.slice(0, 5)).toEqual(['triangulacja', 'teren', 'korekta', 'skala', 'legenda']);
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

  it('has Polish text for every key it names, the first-cast notes and the rule', () => {
    for (const sk of m.def.skills) for (const k of [sk.nameKey, sk.padKey, sk.descKey]) expect(t(k), k).not.toBe(k);
    for (const u of m.ultimates ?? []) {
      for (const k of [u.nameKey, u.descKey, u.stampKey, u.noteKey, ...u.list.flatMap((p) => [p.nameKey, p.descKey])]) expect(t(k), k).not.toBe(k);
      expect(t(u.stampKey)).toBe(t(u.stampKey).toUpperCase());
      expect(t(u.stampKey)).not.toContain('!');
    }
    for (const sp of Object.values(m.paragraphs)) for (const p of sp.list) for (const k of [p.nameKey, p.descKey]) expect(t(k), k).not.toBe(k);
    for (const n of [7, 8, 9, 10]) for (const part of ['name', 'desc']) expect(t(`forms.update.passive.kartograf.${n}.${part}`)).not.toContain('forms.update');
    for (const id of ['pomiar', 'przekroj', 'granica', 'odniesienia', 'roza']) expect(t(`heroes.kartograf.note.${id}`)).not.toContain('heroes.kartograf');
    for (const f of ['urzadzenia', 'powiadomienia', 'wygenerowane']) for (const part of ['wrong', 'right']) expect(t(`heroes.kartograf.rule.${f}.${part}`)).not.toContain('heroes.kartograf');
  });
});

describe('every new skill in every paragraph and aim', () => {
  const aims: Record<string, Aim> = {
    auto: { kind: 'auto' },
    kierunek: { kind: 'kierunek', dx: 1, dy: 0 },
    wskazanie: { kind: 'wskazanie', x: 700, y: 800 },
  };
  for (const [offset, id] of SKILL_IDS.entries()) {
    const i = (IX.pomiar + offset) as SkillIndex;
    for (const n of [1, 2, 3] as const) {
      for (const [aimName, aim] of Object.entries(aims)) {
        it(`${id} § ${n} with ${aimName} aim casts, spends its cooldown, and leaves something`, () => {
          const { s, bus, enemies } = scene([[90, 0], [120, 20], [60, -50], [-80, 10]]);
          expect(cast(s, bus, i, n, aim), id).toBe(true);
          expect(s.hero.cd[i] ?? 0).toBeGreaterThan(0);
          tick(s, bus, 0.4);
          const hurt = enemies.some((e) => lost(e) > 0);
          const marked = enemies.some((e) => e.statuses.length > 0);
          const moved = enemies.some((e, k) => Math.hypot(e.x - (600 + [90, 120, 60, -80][k]!), e.y - (800 + [0, 20, -50, 10][k]!)) > 1);
          const things = s.zones.length + s.summons.length;
          expect(hurt || marked || moved || things > 0, `${id} § ${n} ${aimName}`).toBe(true);
          expect(s.player.hp).toBeGreaterThan(0);
        });
      }
    }
  }
});

describe('the data of the paragraphs', () => {
  it('every new skill has three, § 1 unpatched, § 3 with a price, at most four fields', () => {
    const m = heroById('kartograf');
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

describe('Pomiar', () => {
  it('§ 1 hits for 0.9x; the third measurement running on the same enemy marks it zgloszony for 3 s', () => {
    const { s, bus, enemies } = scene([[100, 0], [220, 0]]);
    cast(s, bus, IX.pomiar, 1);
    expect(lost(enemies[0]!)).toBe(hit(0.9));
    expect(lost(enemies[1]!)).toBe(0);
    cast(s, bus, IX.pomiar, 1);
    expect(hasStatus(enemies[0]!, 'zgloszony')).toBe(false);
    cast(s, bus, IX.pomiar, 1);
    const mark = getStatus(enemies[0]!, 'zgloszony');
    expect(mark).toBeDefined();
    expect(mark?.remaining).toBeGreaterThan(3);
    expect(mark?.remaining).toBeLessThan(3.6);
  });

  it('an interruption by another enemy begins the count again', () => {
    const { s, bus, enemies } = scene([[100, 0], [130, 0]]);
    cast(s, bus, IX.pomiar, 1);
    cast(s, bus, IX.pomiar, 1);
    enemies[0]!.x = 900; // out of the 300 reach: the second enemy is measured now
    cast(s, bus, IX.pomiar, 1);
    expect(hasStatus(enemies[1]!, 'zgloszony')).toBe(false);
    expect(hasStatus(enemies[0]!, 'zgloszony')).toBe(false);
  });

  it('§ 2 measures the two nearest, mechaniczny, and marks nobody', () => {
    const { s, bus, enemies } = scene([[100, 0], [150, 0], [250, 0]]);
    for (let k = 0; k < 3; k++) cast(s, bus, IX.pomiar, 2);
    expect(lost(enemies[0]!)).toBe(3 * hit(0.9));
    expect(lost(enemies[1]!)).toBe(3 * hit(0.9));
    expect(lost(enemies[2]!)).toBe(0);
    expect(enemies.some((e) => hasStatus(e, 'zgloszony'))).toBe(false);
  });

  it('§ 3 strikes 1.4x only an enemy that is zgloszony already', () => {
    const { s, bus, enemies } = scene([[100, 0]]);
    cast(s, bus, IX.pomiar, 3);
    expect(lost(enemies[0]!)).toBe(hit(0.9));
    const a = lost(enemies[0]!);
    enemies[0]!.statuses.push({ kind: 'zgloszony', remaining: 5, source: s.player.id });
    cast(s, bus, IX.pomiar, 3);
    expect(lost(enemies[0]!) - a).toBe(Math.round(Math.round(10 * 0.9 * 1.25 * 1.4) * 1.3));
  });

  it('is refused when nobody is in reach', () => {
    const { s, bus } = scene([[900, 0]]);
    expect(cast(s, bus, IX.pomiar, 1)).toBe(false);
    expect(s.hero.cd[IX.pomiar] ?? 0).toBe(0);
  });
});

describe('Przekroj', () => {
  const east: Aim = { kind: 'kierunek', dx: 1, dy: 0 };

  it('§ 1 fans five lines over 40 degrees: 0.5x on each enemy on a line, none outside the fan or beyond 220', () => {
    const { s, bus, enemies } = scene([[120, 0], [150, 40], [150, -40], [120, 130], [300, 0]]);
    cast(s, bus, IX.przekroj, 1, east);
    expect(lost(enemies[0]!)).toBeGreaterThanOrEqual(hit(0.5));
    expect(enemies[1]!.hp).toBeLessThan(enemies[1]!.hpMax);
    expect(enemies[2]!.hp).toBeLessThan(enemies[2]!.hpMax);
    expect(lost(enemies[3]!)).toBe(0);
    expect(lost(enemies[4]!)).toBe(0);
    expect(s.zones.filter((z) => z.variant === 'przekroj')).toHaveLength(5);
  });

  it('§ 2 is one thick line of 2.0x with a reach of 160', () => {
    const { s, bus, enemies } = scene([[100, 0], [100, 40], [200, 0]]);
    cast(s, bus, IX.przekroj, 2, east);
    expect(lost(enemies[0]!)).toBe(hit(2));
    expect(lost(enemies[1]!)).toBe(0);
    expect(lost(enemies[2]!)).toBe(0); // 200 > 160 + radius
    expect(s.zones.filter((z) => z.variant === 'przekroj')).toHaveLength(1);
  });

  it('§ 3 is egzystencjalny: the lines stay 1.5 s and hold whoever stands on one', () => {
    const { s, bus, enemies } = scene([[120, 0]]);
    cast(s, bus, IX.przekroj, 3, east);
    expect(kartState(s).lines).toHaveLength(5);
    enemies[0]!.statuses = [];
    tick(s, bus, 1);
    expect(hasStatus(enemies[0]!, 'do_weryfikacji')).toBe(true);
    tick(s, bus, 1);
    expect(kartState(s).lines).toHaveLength(0);
    expect(s.zones.some((z) => z.variant === 'przekroj')).toBe(false);
  });

  it('is refused when no line touches anybody', () => {
    const { s, bus } = scene([[-200, 0]]);
    expect(cast(s, bus, IX.przekroj, 1, east)).toBe(false);
    expect(s.hero.cd[IX.przekroj] ?? 0).toBe(0);
  });
});

describe('Granica', () => {
  const east: Aim = { kind: 'kierunek', dx: 1, dy: 0 };

  it('§ 1 puts a border across the aim: a crosser is pushed back 60 and waits for verification; one that stays put is left alone', () => {
    const { s, bus, enemies } = scene([[150, 0], [150, 30]]);
    cast(s, bus, IX.granica, 1, east);
    const z = s.zones.find((x) => x.variant === 'granica');
    expect(z).toBeDefined();
    expect(z?.x).toBe(670);
    tick(s, bus, 0.3);
    expect(enemies[1]!.x).toBe(750);
    enemies[0]!.x = 650; // over the border
    tick(s, bus, 0.1);
    expect(enemies[0]!.x).toBeGreaterThan(700);
    expect(hasStatus(enemies[0]!, 'do_weryfikacji')).toBe(true);
    expect(hasStatus(enemies[1]!, 'do_weryfikacji')).toBe(false);
  });

  it('a crosser beyond the end of the border is not stopped', () => {
    const { s, bus, enemies } = scene([[150, 0]]);
    cast(s, bus, IX.granica, 1, east);
    enemies[0]!.y = 800 + 140;
    tick(s, bus, 0.1);
    enemies[0]!.x = 640;
    tick(s, bus, 0.1);
    expect(enemies[0]!.x).toBe(640);
  });

  it('the border is gone after its 4 s', () => {
    const { s, bus, enemies } = scene([[150, 0]]);
    cast(s, bus, IX.granica, 1, east);
    tick(s, bus, 5);
    expect(s.zones.some((x) => x.variant === 'granica')).toBe(false);
    enemies[0]!.x = 640;
    tick(s, bus, 0.1);
    expect(enemies[0]!.x).toBe(640);
  });

  it('§ 2 is egzystencjalny: no push, a crosser takes 0.8x', () => {
    const { s, bus, enemies } = scene([[150, 0]]);
    cast(s, bus, IX.granica, 2, east);
    enemies[0]!.x = 650;
    tick(s, bus, 0.1);
    expect(enemies[0]!.x).toBe(650);
    expect(lost(enemies[0]!)).toBe(hit(0.8));
  });

  it('§ 3 is regulaminowa: it lasts 6 s and a crosser is zablokowany 1 s', () => {
    const { s, bus, enemies } = scene([[150, 0]]);
    cast(s, bus, IX.granica, 3, east);
    enemies[0]!.x = 650;
    tick(s, bus, 0.1);
    expect(getStatus(enemies[0]!, 'zablokowany')?.remaining).toBeGreaterThan(0.8);
    tick(s, bus, 5);
    expect(s.zones.some((x) => x.variant === 'granica')).toBe(true);
    tick(s, bus, 2);
    expect(s.zones.some((x) => x.variant === 'granica')).toBe(false);
  });
});

describe('Punkt odniesienia', () => {
  const at: Aim = { kind: 'wskazanie', x: 700, y: 800 };

  it('§ 1 puts a benchmark for 20 s; his autos pierce from within 60 of it and not from further', () => {
    const { s, bus } = scene([[200, 0]]);
    cast(s, bus, IX.odniesienia, 1, at);
    const m = s.summons.find((x) => x.variant === 'benchmark');
    expect(m?.ttl).toBeGreaterThan(20);
    expect(benchmarkNear(s)).toBe(false); // 100 away
    s.player.x = 660;
    expect(benchmarkNear(s)).toBe(true);
    s.player.x = 600;
    s.player.x = 500;
    expect(benchmarkNear(s)).toBe(false);
  });

  it('Korekta blinks to it from anywhere when dragged toward it; without a benchmark it stays short', () => {
    const { s, bus } = scene([[-200, 0]]);
    cast(s, bus, IX.odniesienia, 1, at);
    const m = s.summons.find((x) => x.variant === 'benchmark');
    if (!m) throw new Error('no benchmark');
    m.x = 1000;
    m.y = 800;
    cast(s, bus, 2, 1, { kind: 'wskazanie', x: 700, y: 810 });
    expect(s.player.x).toBeCloseTo(1000, 0);
    const b = scene([[-200, 0]]);
    cast(b.s, b.bus, 2, 1, { kind: 'wskazanie', x: 900, y: 800 });
    expect(b.s.player.x).toBeLessThan(760);
  });

  it('§ 2 puts two benchmarks of 12 s, the second where he stands', () => {
    const { s, bus } = scene([[200, 0]]);
    cast(s, bus, IX.odniesienia, 2, at);
    const ms = s.summons.filter((x) => x.variant === 'benchmark');
    expect(ms).toHaveLength(2);
    expect(ms.some((m) => m.x === 600)).toBe(true);
    for (const m of ms) expect(m.ttl).toBeLessThan(15);
  });

  it('§ 3 is egzystencjalny: every 4 s whoever is within 90 reads it', () => {
    const { s, bus, enemies } = scene([[100, 0], [400, 0]]);
    cast(s, bus, IX.odniesienia, 3, at);
    const m = s.summons.find((x) => x.variant === 'benchmark');
    tick(s, bus, 3.9);
    expect(hasStatus(enemies[0]!, 'przeczytane')).toBe(false);
    tick(s, bus, 0.3);
    expect(getStatus(enemies[0]!, 'przeczytane')?.source).toBe(m?.id);
    expect(hasStatus(enemies[1]!, 'przeczytane')).toBe(false);
  });
});

describe('Roza wiatrow', () => {
  it('§ 1 pushes whoever is within 140 by 90 along the nearest cardinal direction and holds it 1 s; the far are left', () => {
    const { s, bus, enemies } = scene([[100, 30], [-50, -90], [300, 0]]);
    cast(s, bus, IX.roza, 1);
    expect(enemies[0]!.x).toBeCloseTo(790, 0);
    expect(enemies[0]!.y).toBeCloseTo(830, 0);
    expect(enemies[1]!.y).toBeCloseTo(800 - 90 - 90, 0);
    expect(enemies[1]!.x).toBeCloseTo(550, 0);
    expect(hasStatus(enemies[0]!, 'do_weryfikacji')).toBe(true);
    expect(enemies[2]!.x).toBe(900);
    expect(s.zones.some((z) => z.variant === 'roza')).toBe(true);
  });

  it('§ 2 is mechaniczna: the pushed take 0.9x', () => {
    const { s, bus, enemies } = scene([[100, 0], [300, 0]]);
    cast(s, bus, IX.roza, 2);
    expect(lost(enemies[0]!)).toBe(hit(0.9));
    expect(lost(enemies[1]!)).toBe(0);
  });

  it('§ 3 is regulaminowa: it pulls toward him instead and lays no status', () => {
    const { s, bus, enemies } = scene([[130, 0]]);
    cast(s, bus, IX.roza, 3);
    expect(enemies[0]!.x).toBeLessThan(700);
    expect(enemies[0]!.x).toBeGreaterThan(600);
    expect(enemies[0]!.statuses).toHaveLength(0);
  });

  it('is refused when nobody is within the rose', () => {
    const { s, bus } = scene([[400, 0]]);
    expect(cast(s, bus, IX.roza, 1)).toBe(false);
  });

  it('leaves a boss where it stands but marks it', () => {
    const { s, bus, enemies } = scene([[100, 0]]);
    enemies[0]!.boss = true;
    cast(s, bus, IX.roza, 1);
    expect(enemies[0]!.x).toBe(700);
    expect(hasStatus(enemies[0]!, 'do_weryfikacji')).toBe(true);
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
    for (const u of heroById('kartograf').ultimates ?? []) {
      expect(u.radius === null || u.radius <= MAX_ULT_RADIUS, u.id).toBe(true);
      for (const p of u.list) {
        expect(ultimateSeconds(u, p.n), `${u.id} ${p.n}`).toBeLessThanOrEqual(MAX_ULT_S);
        expect(patchFields(p.patch)).toBeLessThanOrEqual(PATCH_FIELD_LIMIT);
      }
      expect(u.list.some((p) => (p.patch.cost ?? 0) > 0)).toBe(true);
    }
    expect((heroById('kartograf').ultimates ?? []).filter((u) => u.pageWide)).toHaveLength(1);
  });

  it('are closed below their level, and end by themselves in every paragraph', () => {
    const closed = scene([[80, 0]]);
    closed.s.player.level = 23;
    expect(cast3(closed.s, closed.bus, 'skreslenie', 1)).toBe(false);
    closed.s.player.level = 35;
    expect(cast3(closed.s, closed.bus, 'pomiarKontrolny', 1)).toBe(false);
    for (const id of ['skreslenie', 'pomiarKontrolny']) {
      for (const n of [1, 2, 3] as const) {
        const { s, bus } = scene([[80, 0], [-90, 30]]);
        expect(cast3(s, bus, id, n), `${id} ${n}`).toBe(true);
        expect(ultimateActive(s)).toBe(true);
        const def = heroById('kartograf').ultimates?.find((u) => u.id === id);
        if (!def) throw new Error(id);
        tick(s, bus, ultimateSeconds(def, n) + 0.2);
        expect(ultimateActive(s), `${id} ${n}`).toBe(false);
      }
    }
  });

  function generated(s: RunState, dx: number, dy: number, existence: number): Enemy {
    const e = createEnemy(nextId(s), s.player.x + dx, s.player.y + dy, 1);
    e.family = 'wygenerowane';
    e.existence = existence;
    e.hp = e.hpMax = 5000;
    e.stats.upor = 0;
    e.stats.resist = {};
    e.attackTimer = 999;
    s.enemies.push(e);
    return e;
  }

  it('Skreslenie § 1 crosses out Wygenerowane below 0.5 at once; the rest in the rectangle take 2.5x and are held at 0.3; those outside nothing', () => {
    const { s, bus, enemies } = scene([[120, 0], [160, 30], [-300, 0]]);
    const low = generated(s, 140, -20, 0.4);
    const high = generated(s, 100, 40, 0.9);
    expect(cast3(s, bus, 'skreslenie', 1)).toBe(true);
    expect(s.enemies.includes(low)).toBe(false);
    expect(lost(enemies[0]!)).toBe(blow(2.5));
    expect(lost(enemies[1]!)).toBe(blow(2.5));
    expect(lost(high)).toBe(Math.round(blow(2.5) * 0.9));
    expect(high.existence).toBe(0.3);
    expect(lost(enemies[2]!)).toBe(0);
    expect(s.zones.some((z) => z.variant === 'skreslenie')).toBe(true);
  });

  it('Skreslenie does not cross out a boss, and § 2 crosses out nobody but strikes 3.5x', () => {
    const a = scene([[120, 0]]);
    const boss = generated(a.s, 140, 0, 0.3);
    boss.boss = true;
    cast3(a.s, a.bus, 'skreslenie', 1);
    expect(a.s.enemies.includes(boss)).toBe(true);
    const b = scene([[120, 0]]);
    const low = generated(b.s, 140, 0, 0.4);
    cast3(b.s, b.bus, 'skreslenie', 2);
    expect(b.s.enemies.includes(low)).toBe(true);
    expect(lost(b.enemies[0]!)).toBe(blow(3.5));
  });

  it('Skreslenie § 3 stays 5 s and holds those inside as a Teren nieistniejacy', () => {
    const { s, bus, enemies } = scene([[120, 0]]);
    const g = generated(s, 140, 20, 1);
    cast3(s, bus, 'skreslenie', 3);
    expect(ultimateActive(s)).toBe(true);
    tick(s, bus, 4);
    expect(ultimateActive(s)).toBe(true);
    expect(hasStatus(enemies[0]!, 'do_weryfikacji')).toBe(true);
    expect(g.existence).toBe(0.3);
    tick(s, bus, 1.2);
    expect(ultimateActive(s)).toBe(false);
  });

  it('Pomiar kontrolny § 1 strikes along three lines from the point for 1.8x and crits where they cross', () => {
    const { s, bus, enemies } = scene([[140, 0], [140, 12], [300, 0]]);
    // the heart of the crowd is the first enemy; its rays leave toward 0, 120, 240 degrees from the hero
    const before = enemies.map((e) => ({ x: e.x, y: e.y }));
    expect(cast3(s, bus, 'pomiarKontrolny', 1)).toBe(true);
    const rec = s.hero.ult?.active[0];
    expect(rec?.x).toBeGreaterThan(700);
    expect(s.zones.filter((z) => z.variant === 'przekroj')).toHaveLength(3);
    const crossing = enemies.find((_e, k) => Math.hypot(before[k]!.x - (rec?.x ?? 0), before[k]!.y - (rec?.y ?? 0)) < 26);
    expect(crossing).toBeDefined();
    // a crit at the crossing: at least twice the plain blow, and a ray along 0 degrees hits it (and the far one at 300)
    expect(lost(crossing!)).toBeGreaterThanOrEqual(blow(1.8) * 2);
    expect(lost(enemies[2]!)).toBeGreaterThanOrEqual(blow(1.8));
  });

  it('Pomiar kontrolny § 2 sends six rays for 1.0x; § 3 is regulaminowy and the crossing becomes a benchmark of 20 s', () => {
    const a = scene([[140, 0]]);
    cast3(a.s, a.bus, 'pomiarKontrolny', 2);
    expect(a.s.zones.filter((z) => z.variant === 'przekroj')).toHaveLength(6);
    expect(lost(a.enemies[0]!)).toBe(blow(1.8 * (1 / 1.8)) * 2 * 6);
    const b = scene([[140, 0]]);
    cast3(b.s, b.bus, 'pomiarKontrolny', 3);
    const m = b.s.summons.find((x) => x.variant === 'benchmark');
    expect(m).toBeDefined();
    expect(m?.ttl).toBeGreaterThan(19);
  });

  it('Mapa ostateczna keeps working as the first ultimate', () => {
    const { s, bus, enemies } = scene([[120, 0]]);
    expect(cast3(s, bus, 'mapaOstateczna', 1)).toBe(true);
    expect(hasStatus(enemies[0]!, 'zgloszony')).toBe(true);
  });
});

describe('passives', () => {
  it('8 Odleglosc w linii prostej: +1% per ten units to the target, at most 20%', () => {
    const { s, bus, enemies } = scene([[50, 0], [150, 0], [400, 0]]);
    s.hero.upgrades['passive8'] = 1;
    expect(distanceMul(s, enemies[0]!)).toBeCloseTo(1.05, 5);
    expect(distanceMul(s, enemies[1]!)).toBeCloseTo(1.15, 5);
    expect(distanceMul(s, enemies[2]!)).toBeCloseTo(1.2, 5);
    applyDamage(s, bus, enemies[2]!, 100, false, 'mechaniczny');
    expect(lost(enemies[2]!)).toBe(120);
    s.hero.upgrades['passive8'] = 0;
    expect(distanceMul(s, enemies[2]!)).toBe(1);
    applyDamage(s, bus, enemies[1]!, 100, false, 'mechaniczny');
    expect(lost(enemies[1]!)).toBe(100);
  });

  it('9 Blad pomiaru: the decoy lasts 2 s longer and strikes whoever touches it for 0.5x', () => {
    const plain = scene([[300, 0]]);
    cast(plain.s, plain.bus, 2, 1, { kind: 'wskazanie', x: 650, y: 800 });
    const base = plain.s.summons.find((x) => x.variant === 'decoy')?.ttl ?? 0;
    const { s, bus, enemies } = scene([[8, 0]]);
    s.hero.upgrades['passive9'] = 1;
    cast(s, bus, 2, 1, { kind: 'wskazanie', x: 400, y: 800 });
    const decoy = s.summons.find((x) => x.variant === 'decoy');
    expect(decoy?.ttl).toBeCloseTo(base + 2, 1);
    enemies[0]!.x = decoy?.x ?? 0;
    enemies[0]!.y = decoy?.y ?? 0;
    tick(s, bus, 0.1);
    expect(lost(enemies[0]!)).toBe(blow(0.5));
    tick(s, bus, 0.5);
    expect(lost(enemies[0]!)).toBe(blow(0.5)); // once a second
    tick(s, bus, 0.6);
    expect(lost(enemies[0]!)).toBe(2 * blow(0.5));
  });

  it('10 Trzeci punkt: the third line hit on the same enemy is a rebuttal whatever the claim; two are not', () => {
    const { s, bus, enemies } = scene([[100, 0]]);
    s.hero.upgrades['passive10'] = 1;
    const e = enemies[0]!;
    e.claim = { textKey: 'enemies.urzadzenia.claim.update', type: 'egzystencjalny' };
    cast(s, bus, IX.pomiar, 1);
    cast(s, bus, IX.pomiar, 1);
    expect(e.claim?.struck).not.toBe(true);
    cast(s, bus, IX.pomiar, 1);
    expect(e.claim?.struck).toBe(true);
  });

  it('10 without the passive: three hits are three hits', () => {
    const { s, bus, enemies } = scene([[100, 0]]);
    const e = enemies[0]!;
    e.claim = { textKey: 'enemies.urzadzenia.claim.update', type: 'egzystencjalny' };
    for (let k = 0; k < 3; k++) cast(s, bus, IX.pomiar, 1);
    expect(e.claim?.struck).not.toBe(true);
  });

  it('7 Mapa z gory: the first enemy of each family in sight is named wrongly, once per page; its death corrects the note', () => {
    const { s, bus, enemies, notes } = scene([[100, 0], [160, 0]]);
    const other = createEnemy(nextId(s), 700, 900, 1);
    other.family = 'powiadomienia';
    other.attackTimer = 999;
    s.enemies.push(other);
    tick(s, bus, 0.5);
    expect(notes.map((n) => n.text)).toEqual([t('heroes.kartograf.rule.urzadzenia.wrong'), t('heroes.kartograf.rule.powiadomienia.wrong')]);
    // the first of the family falls
    s.enemies.splice(s.enemies.indexOf(enemies[0]!), 1);
    s.kills++;
    tick(s, bus, 0.5);
    const last = notes[notes.length - 1];
    expect(last?.text).toBe(t('heroes.kartograf.rule.urzadzenia.right'));
    expect(last?.correction).toBe(true);
    // the second of the family is not named again
    tick(s, bus, 1);
    expect(notes).toHaveLength(3);
  });

  it('7 with «Awaria» on (S20 integrator): the misnamed walk 20% slower, the rest and a set-less hero do not', () => {
    const { s, bus, enemies } = scene([[100, 0], [160, 0]]);
    tick(s, bus, 0.5);
    expect(misnamedSlow(s, enemies[0]!)).toBe(1);
    s.player.sets = { awaria: 3 };
    expect(misnamedSlow(s, enemies[0]!)).toBeCloseTo(0.8, 5);
    expect(misnamedSlow(s, enemies[1]!)).toBe(1);
    expect(heroById('kartograf').quirk?.enemySpeedMul?.(s, enemies[0]!)).toBeCloseTo(0.8, 5);
  });

  it('7 names nobody out of sight and no boss', () => {
    const { s, bus, enemies, notes } = scene([[600, 0], [90, 0]]);
    enemies[1]!.boss = true;
    tick(s, bus, 0.5);
    expect(notes).toHaveLength(0);
  });
});
