/**
 * The filled Pralka (S19): ten skills, three ultimates, ten passives. Every skill x paragraph x aim kind is cast and stepped, each new
 * skill is checked at work in its three paragraphs, the passives 8..10 and the two later ultimates likewise, and the update form's
 * schedule for the skills past the fifth.
 */
import { describe, expect, it } from 'vitest';
import { hasStatus } from '../../combat/status';
import { createBus, type Bus, type GameEvents } from '../../core/events';
import { createEnemy, createPickup } from '../../entities/factory';
import { t } from '../../i18n';
import { recomputeStats } from '../../items/stats';
import { applyUpgrade, availableEntries, confirmUpdate, newSkillOf, rollOffer } from '../../progression';
import { setRunParagraph } from '../../progression/paragraphs';
import { padsFrom } from '../../progression/persist';
import { createRun, nextId, type RunState } from '../../world/run';
import { previewOf, radiusOf, type Aim } from '../aim';
import { heroDef, skillIndicesOf, type SkillIndex } from '../defs';
import { assignPad, effectiveSkill, installedSkills } from '../loadout';
import { patchFields, PATCH_FIELD_LIMIT } from '../paragraphs';
import { heroById } from '../registry';
import { castSkill } from '../skills';
import { heroStep } from '../system';
import { castUltimate, setUltimateParagraph, ultimateSeconds } from '../ultimate';
import { MAX_ULT_RADIUS, MAX_ULT_S } from '../ultimateDefs';
import { onPlayerHit } from '../quirks';
import { BEBEN_CAP, ECO_RESIST, GWARANCJA_SHIELD, PROGRAM_R } from './numbers';
import { runOf } from './running';

const DT = 1 / 60;
const hero = heroById('pralka');
const def = heroDef('pralka');
const ids = def.skills.map((k) => k.id);
const NEW: readonly SkillIndex[] = [5, 6, 7, 8, 9];

const AIMS: Record<string, Aim> = {
  auto: { kind: 'auto' },
  kierunek: { kind: 'kierunek', dx: 0.8, dy: -0.6 },
  wskazanie: { kind: 'wskazanie', x: 720, y: 800 },
};

/** One Pralka at (600, 800) with her whole kit installed and enemies at fixed offsets (none of them attacks, all are tough). */
function scene(offsets: readonly [number, number][] = [[60, 0], [110, -30], [150, 20], [-70, 10], [96, -72], [120, 0]]): { s: RunState; bus: Bus } {
  const bus = createBus();
  const s = createRun(5, { heroId: 'pralka' });
  s.enemies.length = 0;
  s.page.obstacles.length = 0;
  const p = s.player;
  p.x = 600;
  p.y = 800;
  p.baseStats.stats.dmgMin = 10;
  p.baseStats.stats.dmgMax = 10;
  p.baseStats.stats.critChance = 0;
  p.baseStats.stats.pewnoscSiebie = 1e6;
  recomputeStats(p);
  p.hp = p.hpMax = 1e5;
  p.level = 40;
  for (const i of NEW) s.hero.ranks[i] = 1;
  for (const i of [3, 4] as const) s.hero.ranks[i] = 1;
  for (const [dx, dy] of offsets) addEnemy(s, dx, dy);
  return { s, bus };
}

function addEnemy(s: RunState, dx: number, dy: number, hp = 5000): ReturnType<typeof createEnemy> {
  const e = createEnemy(nextId(s), s.player.x + dx, s.player.y + dy, 1);
  e.hp = e.hpMax = hp;
  e.stats.upor = 0;
  e.stats.resist = {};
  e.claim = undefined;
  e.attackTimer = 999;
  e.speed = 0;
  s.enemies.push(e);
  return e;
}

function run(s: RunState, bus: Bus, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    s.time += DT;
    for (const e of s.enemies) for (const st of e.statuses) st.remaining -= DT;
    for (const e of s.enemies) e.statuses = e.statuses.filter((st) => st.remaining > 0);
    for (const st of s.player.statuses) st.remaining -= DT;
    s.player.statuses = s.player.statuses.filter((st) => st.remaining > 0);
    heroStep(s, bus, DT);
  }
}

const lost = (e: { hp: number; hpMax: number }): number => e.hpMax - e.hp;

/** Put skill `i` on pad 1 (slot 0) in paragraph `n` and cast it. */
function cast(s: RunState, bus: Bus, i: SkillIndex, n = 1, aim: Aim = AIMS['auto'] as Aim): boolean {
  assignPad(s, 0, i);
  expect(setRunParagraph(s, ids[i] ?? '', n as 1 | 2 | 3, true)).toBe(true);
  s.hero.cd[i] = 0;
  return castSkill(s, bus, 0, false, aim);
}

describe('the filled kit as data', () => {
  it('has ten skills in the order of SKILLS.md, the first five unchanged', () => {
    expect(ids).toEqual(['wirowanie', 'pranieWstepne', 'odwirowanie', 'beben', 'osobowosc', 'plukanie', 'program90', 'trybOszczedny', 'zmianaProgramu', 'odpompowanie']);
    expect(skillIndicesOf(def)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(def.skills.slice(5).every((k) => k.requires === undefined)).toBe(true);
    expect(Object.keys(hero.casts).sort()).toEqual([...ids].sort());
  });

  it('covers the categories 2 / 2-3 / 2 / 2-3 and every damage type', () => {
    const cats = ids.map((id) => hero.specs?.categories[id]);
    const count = (c: string): number => cats.filter((x) => x === c).length;
    expect([count('podstawowa'), count('obronna'), count('uzytkowa'), count('ofensywna')]).toEqual([2, 2, 3, 3]);
    expect(new Set(def.skills.map((k) => k.type)).size).toBe(3);
    expect(def.skills.filter((k) => k.aim === 'wskazanie')).toHaveLength(1);
  });

  it('draws a pad, sounds a recipe, opens by a level and says its name for each skill', () => {
    expect(hero.pads).toHaveLength(10);
    expect(new Set(hero.sounds.skills).size).toBe(10);
    for (const k of def.skills) for (const key of [k.nameKey, k.padKey, k.descKey]) expect(t(key), key).not.toBe(key);
    for (const k of def.skills) expect(hero.paragraphs[k.id]?.level, k.id).toBeGreaterThanOrEqual(1);
    expect(NEW.map((i) => hero.paragraphs[ids[i] ?? '']?.level)).toEqual([3, 9, 3, 7, 14]);
  });

  it('has ten paragraphs of texts and patches that stay in the vocabulary', () => {
    for (const k of def.skills) {
      const list = hero.paragraphs[k.id]?.list ?? [];
      expect(list, k.id).toHaveLength(3);
      for (const p of list) {
        expect(t(p.nameKey), p.nameKey).not.toBe(p.nameKey);
        expect(t(p.descKey), p.descKey).not.toBe(p.descKey);
        expect(patchFields(p.patch)).toBeLessThanOrEqual(PATCH_FIELD_LIMIT);
      }
      expect(list.slice(1).some((p) => (p.patch.cd ?? 0) > 0 || (p.patch.cost ?? 0) > 0), `${k.id} carries a price`).toBe(true);
    }
  });

  it('has ten passives: 7 is the rule and never offered, 8..10 are in the pool and have texts', () => {
    expect(hero.passives).toHaveLength(10);
    expect(hero.passives[6]?.rule).toBe(true);
    const s = createRun(5, { heroId: 'pralka' });
    s.player.permissions.push('urzadzenia');
    const pool = availableEntries(s).map((e) => e.id);
    expect(pool).toEqual(expect.arrayContaining(['passive8', 'passive9', 'passive10']));
    expect(pool).not.toContain('passive7');
    for (let n = 7; n <= 10; n++) for (const part of ['name', 'desc']) expect(t(`forms.update.passive.pralka.${n}.${part}`)).not.toContain('forms.update');
  });

  it('has three ultimates at 12 / 24 / 36 of three types, the first mechaniczny, one page-wide, each inside the limits', () => {
    const list = hero.ultimates ?? [];
    expect(list.map((u) => u.level)).toEqual([12, 24, 36]);
    expect(list.map((u) => u.type)).toEqual(['mechaniczny', 'egzystencjalny', 'regulaminowy']);
    expect(list.filter((u) => u.pageWide)).toHaveLength(1);
    expect(Object.keys(hero.sounds.ultimate as object).sort()).toEqual(list.map((u) => u.id).sort());
    for (const u of list) {
      expect(u.radius === null || u.radius <= MAX_ULT_RADIUS, u.id).toBe(true);
      for (const key of [u.nameKey, u.descKey, u.stampKey, u.noteKey, ...u.list.flatMap((p) => [p.nameKey, p.descKey])]) expect(t(key), key).not.toBe(key);
      expect(t(u.stampKey)).toBe(t(u.stampKey).toUpperCase());
      expect(t(u.stampKey)).not.toContain('!');
      for (const p of u.list) {
        expect(ultimateSeconds(u, p.n), `${u.id} ${p.n}`).toBeLessThanOrEqual(MAX_ULT_S);
        expect(patchFields(p.patch)).toBeLessThanOrEqual(PATCH_FIELD_LIMIT);
        expect(p.tune.radius ?? 0).toBeLessThanOrEqual(MAX_ULT_RADIUS);
      }
      expect(u.list.some((p) => (p.patch.cost ?? 0) > 0), `${u.id} carries a cost`).toBe(true);
    }
  });
});

describe('every skill x paragraph x aim kind', () => {
  for (const [i, id] of ids.entries()) {
    for (const n of [1, 2, 3] as const) {
      for (const [aimName, aim] of Object.entries(AIMS)) {
        it(`${id} § ${n} with the ${aimName} aim casts, starts its cooldown and steps for four seconds without a fault`, () => {
          const { s, bus } = scene();
          if (id === 'zmianaProgramu') {
            expect(cast(s, bus, 0)).toBe(true); // something to change: Wirowanie first
            s.hero.cd[0] = 5;
          }
          const hp = s.player.hp;
          expect(cast(s, bus, i as SkillIndex, n, aim)).toBe(true);
          expect(s.hero.cdTotal[i]).toBeGreaterThan(0);
          run(s, bus, 4);
          expect(Number.isFinite(s.player.hp)).toBe(true);
          expect(s.player.hp).toBeLessThanOrEqual(hp);
          expect(Number.isFinite(s.player.x) && Number.isFinite(s.player.y)).toBe(true); // Odwirowanie carries her along
          expect(Number.isFinite(s.player.speed) && s.player.speed > 0).toBe(true);
          expect(s.player.statuses.every((st) => st.remaining > 0)).toBe(true);
        });
      }
    }
  }
});

describe('Płukanie', () => {
  it('splashes the nearest enemy and the ones round it, and rinses one status off her', () => {
    const { s, bus } = scene([[60, 0], [100, 10], [-120, 0]]);
    s.player.statuses.push({ kind: 'przeczytane', remaining: 5, source: null }, { kind: 'zgloszony', remaining: 5, source: null });
    expect(cast(s, bus, 5)).toBe(true);
    const [a, b, far] = s.enemies;
    expect(lost(a ?? { hp: 0, hpMax: 0 })).toBeGreaterThan(0);
    expect(lost(b ?? { hp: 0, hpMax: 0 })).toBeGreaterThan(0);
    expect(lost(far ?? { hp: 0, hpMax: 0 })).toBe(0);
    expect(s.player.statuses).toHaveLength(1);
  });

  it('with nobody near and nothing on her, does nothing and spends no cooldown', () => {
    const { s, bus } = scene([]);
    expect(cast(s, bus, 5)).toBe(false);
    expect(s.hero.cd[5] ?? 0).toBe(0);
  });

  it('§ 2 is egzystencjalny and marks the struck zgłoszony; § 3 makes Wirowanie ready on every third cast', () => {
    const two = scene();
    expect(cast(two.s, two.bus, 5, 2)).toBe(true);
    expect(two.s.enemies.some((e) => hasStatus(e, 'zgloszony'))).toBe(true);
    const three = scene();
    three.s.hero.cd[0] = 9;
    expect(cast(three.s, three.bus, 5, 3)).toBe(true);
    expect(cast(three.s, three.bus, 5, 3)).toBe(true);
    expect(three.s.hero.cd[0]).toBe(9);
    expect(cast(three.s, three.bus, 5, 3)).toBe(true);
    expect(three.s.hero.cd[0]).toBe(0);
  });
});

describe('Program 90°', () => {
  it('strikes whoever stands in the zone every half second for three seconds and slows her meanwhile', () => {
    const { s, bus } = scene([[40, 0], [200, 0]]);
    expect(cast(s, bus, 6)).toBe(true);
    run(s, bus, 0.1);
    expect(s.player.speed).toBeCloseTo(def.speed * 0.7, 6);
    run(s, bus, 3.6); // 3 s, and the first rank adds 15%
    const [inside, outside] = s.enemies;
    expect(lost(inside ?? { hp: 0, hpMax: 0 })).toBeGreaterThan(0);
    expect(lost(outside ?? { hp: 0, hpMax: 0 })).toBe(0);
    expect(s.player.speed).toBe(def.speed); // and she is quick again
    const after = lost(inside ?? { hp: 0, hpMax: 0 });
    run(s, bus, 2);
    expect(lost(inside ?? { hp: 0, hpMax: 0 })).toBe(after); // the zone is gone
  });

  it('§ 2 lasts five seconds and does not slow her; § 3 strikes an enemy that leaves', () => {
    const two = scene([[40, 0]]);
    cast(two.s, two.bus, 6, 2);
    run(two.s, two.bus, 0.1);
    expect(two.s.player.speed).toBe(def.speed);
    run(two.s, two.bus, 4);
    const early = lost(two.s.enemies[0] ?? { hp: 0, hpMax: 0 });
    run(two.s, two.bus, 1.5);
    expect(lost(two.s.enemies[0] ?? { hp: 0, hpMax: 0 })).toBeGreaterThan(early); // still going after the third second

    const three = scene([[40, 0]]);
    cast(three.s, three.bus, 6, 3);
    run(three.s, three.bus, 0.1);
    const e = three.s.enemies[0];
    if (!e) throw new Error('no enemy');
    const before = lost(e);
    e.x += PROGRAM_R * 3;
    run(three.s, three.bus, 0.1);
    expect(lost(e)).toBeGreaterThan(before);
  });
});

describe('Tryb oszczędny', () => {
  it('adds resist to every type for four seconds, slows her, and takes both back', () => {
    const { s, bus } = scene();
    const base = s.player.stats.resist.mechaniczny ?? 0;
    expect(cast(s, bus, 7)).toBe(true);
    run(s, bus, 0.1);
    expect(s.player.stats.resist.mechaniczny).toBeCloseTo(Math.min(75, base + ECO_RESIST), 6);
    expect(s.player.stats.resist.regulaminowy).toBeCloseTo(Math.min(75, ECO_RESIST), 6);
    expect(s.player.speed).toBeCloseTo(def.speed * 0.7, 6);
    run(s, bus, 5); // 4 s, and the first rank adds 15%
    expect(s.player.stats.resist.mechaniczny).toBeCloseTo(base, 6);
    expect(s.player.stats.resist.regulaminowy ?? 0).toBeCloseTo(0, 6);
    expect(s.player.speed).toBe(def.speed);
  });

  it('counts a hit on her double for the rule while it runs', () => {
    const { s, bus } = scene();
    cast(s, bus, 7);
    run(s, bus, 0.1);
    for (let k = 0; k < 4; k++) onPlayerHit(s, bus);
    expect(s.hero.hitsTaken).toBe(8);
    run(s, bus, 5);
    onPlayerHit(s, bus);
    expect(s.hero.hitsTaken).toBe(9);
  });

  it('§ 2 is gentler and does not slow; § 3 is regulaminowy, two seconds, and no status holds her', () => {
    const two = scene();
    cast(two.s, two.bus, 7, 2);
    run(two.s, two.bus, 0.1);
    expect(two.s.player.stats.resist.regulaminowy).toBeCloseTo(25, 6);
    expect(two.s.player.speed).toBe(def.speed);
    const three = scene();
    cast(three.s, three.bus, 7, 3);
    three.s.player.statuses.push({ kind: 'zablokowany', remaining: 9, source: null });
    run(three.s, three.bus, 0.1);
    expect(three.s.player.statuses).toHaveLength(0);
    run(three.s, three.bus, 3);
    expect(three.s.player.stats.resist.regulaminowy ?? 0).toBeCloseTo(0, 6);
  });
});

describe('Zmiana programu', () => {
  it('does nothing before anything was cast, and never changes itself', () => {
    const { s, bus } = scene();
    expect(cast(s, bus, 8)).toBe(false);
    expect(s.hero.cd[8] ?? 0).toBe(0);
  });

  it('makes the last skill ready again and costs ten racja', () => {
    const { s, bus } = scene();
    expect(cast(s, bus, 0)).toBe(true);
    expect(s.hero.cd[0]).toBeGreaterThan(0);
    const hp = s.player.hp;
    expect(cast(s, bus, 8)).toBe(true);
    expect(s.hero.cd[0]).toBe(0);
    expect(s.player.hp).toBe(hp - 10);
    expect(cast(s, bus, 8)).toBe(false); // the last cast is now itself
  });

  it('never kills: the price stops at one racja', () => {
    const { s, bus } = scene();
    cast(s, bus, 0);
    s.player.hp = 4;
    expect(cast(s, bus, 8)).toBe(true);
    expect(s.player.hp).toBeGreaterThanOrEqual(1);
  });

  it('§ 2 fires the last skill again at once; § 3 costs no racja but waits longer', () => {
    const two = scene();
    cast(two.s, two.bus, 0);
    const firstHit = lost(two.s.enemies[0] ?? { hp: 0, hpMax: 0 });
    const cd = two.s.hero.cd[0];
    expect(cast(two.s, two.bus, 8, 2)).toBe(true);
    expect(lost(two.s.enemies[0] ?? { hp: 0, hpMax: 0 })).toBeGreaterThan(firstHit);
    expect(cd).toBeGreaterThan(0);
    expect(two.s.hero.cd[0]).toBe(0);

    const three = scene();
    cast(three.s, three.bus, 0);
    const hp = three.s.player.hp;
    expect(cast(three.s, three.bus, 8, 3)).toBe(true);
    expect(three.s.player.hp).toBe(hp);
    expect(three.s.hero.cdTotal[8]).toBeGreaterThan(two.s.hero.cdTotal[8] ?? 0);
  });
});

describe('Odpompowanie', () => {
  it('lays a puddle at the aimed point: whoever stands in it waits for verification, loot slides to the rim, five seconds', () => {
    const { s, bus } = scene([[120, 0], [-150, 0]]);
    s.pickups.push(createPickup(nextId(s), 725, 800, 1, undefined, 1));
    expect(cast(s, bus, 9, 1, AIMS['wskazanie'])).toBe(true);
    run(s, bus, 0.3);
    const [inside, outside] = s.enemies;
    expect(hasStatus(inside ?? s.player, 'do_weryfikacji')).toBe(true);
    expect(hasStatus(outside ?? s.player, 'do_weryfikacji')).toBe(false);
    run(s, bus, 4);
    const k = s.pickups[0];
    expect(Math.hypot((k?.x ?? 0) - 720, (k?.y ?? 0) - 800)).toBeGreaterThan(90);
    run(s, bus, 1.5);
    expect(runOf(s).puddle).toBeNull();
  });

  it('§ 2 is mechaniczny, narrower, and strikes inside; § 3 pulls toward the centre', () => {
    const two = scene([[120, 0], [120, 85]]);
    cast(two.s, two.bus, 9, 2, AIMS['wskazanie']);
    run(two.s, two.bus, 2);
    expect(lost(two.s.enemies[0] ?? { hp: 0, hpMax: 0 })).toBeGreaterThan(0);
    expect(lost(two.s.enemies[1] ?? { hp: 0, hpMax: 0 })).toBe(0); // outside the radius of 60
    const three = scene([[170, 0]]);
    cast(three.s, three.bus, 9, 3, AIMS['wskazanie']);
    const e = three.s.enemies[0];
    if (!e) throw new Error('no enemy');
    const d0 = Math.hypot(e.x - 720, e.y - 800);
    run(three.s, three.bus, 2);
    expect(Math.hypot(e.x - 720, e.y - 800)).toBeLessThan(d0 - 20);
  });
});

describe('Odpompowanie as aimed', () => {
  it('previews a circle at the aimed point (held to 260 from her), of the paragraph\'s radius', () => {
    const { s } = scene();
    expect(setRunParagraph(s, 'odpompowanie', 1, true)).toBe(true);
    const sk = effectiveSkill(s, 9);
    expect(sk.aim).toBe('wskazanie');
    expect(previewOf(s, sk, AIMS['wskazanie'] as Aim)).toEqual({ kind: 'circle', x: 720, y: 800, r: radiusOf(s, sk) });
    expect(radiusOf(s, sk)).toBeCloseTo(100 * 1.12, 6); // the first rank widens it by 12%
    const far = previewOf(s, sk, { kind: 'wskazanie', x: 1200, y: 800 });
    expect(far && far.kind === 'circle' ? far.x : 0).toBeCloseTo(860, 3);
    expect(setRunParagraph(s, 'odpompowanie', 2, true)).toBe(true);
    expect(radiusOf(s, effectiveSkill(s, 9))).toBeCloseTo(60 * 1.12, 6);
  });
});

describe('the passives 8..10', () => {
  it('8, Wersja 1.1: the rule fires every seventh hit instead of the tenth', () => {
    const plain = scene();
    const fired: string[] = [];
    plain.bus.on('footnote', (e: GameEvents['footnote']) => fired.push(e.text));
    for (let k = 0; k < 7; k++) onPlayerHit(plain.s, plain.bus);
    expect(fired.some((x) => x === t('heroes.pralka.quirkNote'))).toBe(false);
    const quick = scene();
    quick.s.hero.upgrades['passive8'] = 1;
    const quickFired: string[] = [];
    quick.bus.on('footnote', (e: GameEvents['footnote']) => quickFired.push(e.text));
    for (let k = 0; k < 7; k++) onPlayerHit(quick.s, quick.bus);
    expect(quickFired.filter((x) => x === t('heroes.pralka.quirkNote'))).toHaveLength(1);
  });

  it('9, Gwarancja: below a fifth of racja a foam shield of 40, once a page', () => {
    const { s, bus } = scene();
    s.hero.upgrades['passive9'] = 1;
    run(s, bus, 0.1);
    expect(s.player.shield).toBe(0);
    s.player.hp = s.player.hpMax * 0.15;
    run(s, bus, 0.1);
    expect(s.player.shield).toBe(GWARANCJA_SHIELD);
    s.player.shield = 0;
    run(s, bus, 0.2);
    expect(s.player.shield).toBe(0); // once on this page
    s.pageIndex++;
    run(s, bus, 0.2);
    expect(s.player.shield).toBe(GWARANCJA_SHIELD);
  });

  it('10, Bęben pełny: Wirowanie adds 4% an enemy pulled (up to 24%) to the next Bęben, which spends it', () => {
    const base = scene([[40, 0], [60, 20], [-50, 10]]);
    const baseHits = (): number => {
      cast(base.s, base.bus, 3, 1, AIMS['kierunek']);
      return lost(base.s.enemies[0] ?? { hp: 0, hpMax: 0 });
    };
    const plain = baseHits();
    const boosted = scene([[40, 0], [60, 20], [-50, 10]]);
    boosted.s.hero.upgrades['passive10'] = 1;
    cast(boosted.s, boosted.bus, 0);
    expect(runOf(boosted.s).bonus).toBeCloseTo(0.12, 6);
    const e0 = boosted.s.enemies[0];
    if (!e0) throw new Error('no enemy');
    const start = lost(e0);
    boosted.s.player.x = 600;
    cast(boosted.s, boosted.bus, 3, 1, AIMS['kierunek']);
    expect(runOf(boosted.s).bonus).toBe(0);
    expect(lost(e0) - start).toBeGreaterThanOrEqual(plain);
    const many = scene(Array.from({ length: 12 }, (_, k) => [30 + k * 3, k * 4 - 20] as [number, number]));
    many.s.hero.upgrades['passive10'] = 1;
    cast(many.s, many.bus, 0);
    expect(runOf(many.s).bonus).toBeCloseTo(BEBEN_CAP, 6);
  });
});

describe('the update form and the schedule of the later skills', () => {
  it('offers a skill past the fifth only from its level', () => {
    const s = createRun(5, { heroId: 'pralka' });
    s.player.level = 2;
    const has = (id: string): boolean => availableEntries(s).some((e) => e.id === id);
    expect(has('skill6')).toBe(false);
    expect(has('skill8')).toBe(false);
    s.player.level = 3;
    expect(has('skill6')).toBe(true);
    expect(has('skill8')).toBe(true);
    expect(has('skill9')).toBe(false);
    s.player.level = 7;
    expect(has('skill9')).toBe(true);
    expect(has('skill7')).toBe(false);
    s.player.level = 9;
    expect(has('skill7')).toBe(true);
    expect(has('skill10')).toBe(false);
    s.player.level = 14;
    expect(has('skill10')).toBe(true);
  });

  it('leads the form with the new skill, installs it free of any permission, and asks for its pad', () => {
    const s = createRun(5, { heroId: 'pralka' });
    s.player.level = 3;
    const offer = rollOffer(s, 0);
    expect(['skill6', 'skill8']).toContain(offer.entries[0]?.id);
    expect(offer.entries[0]?.locked).toBe(false);
    s.hero.offer = offer;
    const before = [...s.hero.ranks];
    expect(confirmUpdate(s, offer.entries[0]?.id ?? '')).toBe(true);
    const fresh = newSkillOf(before, s.hero.ranks);
    expect([5, 7]).toContain(fresh);
    expect(installedSkills(s)).toContain(fresh);
    expect(assignPad(s, 1, fresh ?? 0)).toBe(true);
  });

  it('keeps a pad on the tenth skill through a save', () => {
    expect(padsFrom([0, 1, 9])).toEqual([0, 1, 9]);
    expect(padsFrom([0, 1, 11])).toEqual([0, 1, 2]);
    const s = createRun(5, { heroId: 'pralka' });
    s.player.level = 14;
    expect(applyUpgrade(s, 'skill10')).toBe(true);
    expect(assignPad(s, 2, 9)).toBe(true);
    expect(s.hero.pads).toEqual([0, 1, 9]);
  });
});

describe('Uznanie osobowości (ultimate 2) and Reklamacja (ultimate 3)', () => {
  function cast2(offsets: readonly [number, number][], id: string, para: 1 | 2 | 3, level = 40): { s: RunState; bus: Bus; log: string[] } {
    const { s, bus } = scene(offsets);
    s.hero.ultimateId = id;
    s.player.level = level;
    setUltimateParagraph(s, para);
    s.player.meter = 1;
    const log: string[] = [];
    for (const name of ['stamp', 'margin:note', 'ultimate:cast'] as const) bus.on(name, () => log.push(name));
    expect(castUltimate(s, bus)).toBe(true);
    return { s, bus, log };
  }

  it('open at their own levels and not before', () => {
    for (const [id, level] of [['uznanieOsobowosci', 24], ['reklamacja', 36]] as const) {
      const { s, bus } = scene([[60, 0]]);
      s.hero.ultimateId = id;
      s.player.meter = 1;
      s.player.level = level - 1;
      expect(castUltimate(s, bus), id).toBe(false);
      s.player.level = level;
      expect(castUltimate(s, bus), id).toBe(true);
    }
  });

  it('stamp once, write one margin note, announce the cast, in every paragraph', () => {
    for (const id of ['uznanieOsobowosci', 'reklamacja']) {
      for (const para of [1, 2, 3] as const) {
        const { log } = cast2([[80, 0], [-90, 30]], id, para);
        expect(log.filter((x) => x === 'stamp'), `${id} ${para}`).toHaveLength(1);
        expect(log.filter((x) => x === 'margin:note'), `${id} ${para}`).toHaveLength(1);
        expect(log.filter((x) => x === 'ultimate:cast'), `${id} ${para}`).toHaveLength(1);
      }
    }
  });

  it('Uznanie: +30 upór and no status for the length of it, 0.8x a second on whoever is within 160, then everything back', () => {
    const { s, bus } = cast2([[60, 0], [300, 0]], 'uznanieOsobowosci', 1);
    const upor = s.player.stats.upor;
    run(s, bus, 0.1);
    s.player.statuses.push({ kind: 'zablokowany', remaining: 9, source: null });
    run(s, bus, 0.1);
    expect(s.player.statuses).toHaveLength(0);
    run(s, bus, 5.9);
    const [near, far] = s.enemies;
    expect(lost(near ?? { hp: 0, hpMax: 0 })).toBeGreaterThan(0);
    expect(lost(far ?? { hp: 0, hpMax: 0 })).toBe(0);
    expect(s.hero.ult?.active ?? []).toHaveLength(0);
    expect(s.player.stats.upor).toBeLessThan(upor);
    expect(runOf(s).ultUpor).toBe(0);
  });

  it('Uznanie § 3: she cannot move while it runs and can again after', () => {
    const { s, bus } = cast2([[60, 0]], 'uznanieOsobowosci', 3);
    run(s, bus, 0.2);
    expect(s.player.speed).toBe(0);
    run(s, bus, 4);
    expect(s.player.speed).toBe(def.speed);
  });

  it('Uznanie holds the existence of the generated to 0.3', () => {
    const { s, bus } = cast2([[60, 0]], 'uznanieOsobowosci', 2);
    const e = s.enemies[0];
    if (!e) throw new Error('no enemy');
    e.existence = 1;
    run(s, bus, 0.2);
    expect(e.existence).toBeLessThanOrEqual(0.3);
  });

  it('Reklamacja marks everyone on the page zgłoszony for 8 s and strikes once; § 2 also locks the three nearest', () => {
    const offsets: [number, number][] = [[60, 0], [100, 0], [140, 0], [180, 0], [900, 0]];
    const one = cast2(offsets, 'reklamacja', 1);
    expect(one.s.enemies.every((e) => hasStatus(e, 'zgloszony'))).toBe(true);
    expect(one.s.enemies.every((e) => lost(e) > 0)).toBe(true);
    expect(one.s.enemies.some((e) => hasStatus(e, 'zablokowany'))).toBe(false);
    const two = cast2(offsets, 'reklamacja', 2);
    expect(two.s.enemies.filter((e) => hasStatus(e, 'zablokowany'))).toHaveLength(3);
    expect(hasStatus(two.s.enemies[3] ?? two.s.player, 'zablokowany')).toBe(false);
  });

  it('Reklamacja § 3 touches only enemies whose claim still stands, with twice the blow', () => {
    const { s, bus } = scene([[60, 0], [100, 0], [140, 0]]);
    const [a, b, c] = s.enemies;
    if (!a || !b || !c) throw new Error('no enemies');
    a.claim = { textKey: 'x', type: 'regulaminowy' };
    b.claim = { textKey: 'x', type: 'regulaminowy', struck: true };
    s.hero.ultimateId = 'reklamacja';
    s.player.level = 40;
    setUltimateParagraph(s, 3);
    s.player.meter = 1;
    expect(castUltimate(s, bus)).toBe(true);
    expect(hasStatus(a, 'zgloszony')).toBe(true);
    expect(lost(a)).toBeGreaterThan(0);
    for (const e of [b, c]) {
      expect(hasStatus(e, 'zgloszony')).toBe(false);
      expect(lost(e)).toBe(0);
    }
  });

  it('end by themselves within their seconds in every paragraph', () => {
    for (const id of ['uznanieOsobowosci', 'reklamacja']) {
      for (const para of [1, 2, 3] as const) {
        const { s, bus } = cast2([[80, 0]], id, para);
        const u = (hero.ultimates ?? []).find((x) => x.id === id);
        if (!u) throw new Error(id);
        run(s, bus, ultimateSeconds(u, para) + 0.2);
        expect(s.hero.ult?.active ?? [], `${id} ${para}`).toHaveLength(0);
      }
    }
  });
});
