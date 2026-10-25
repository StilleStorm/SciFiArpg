/**
 * The filled Pętlowiec (S20): ten skills, three ultimates, ten passives. Every skill x paragraph x aim kind is cast and stepped, each new
 * skill is checked at work in its three paragraphs, the passives 8..10 and the two later ultimates likewise, and the update form's
 * schedule for the skills past the fifth.
 */
import { describe, expect, it } from 'vitest';
import { hasStatus } from '../../combat/status';
import { createBus, type Bus } from '../../core/events';
import { createEnemy } from '../../entities/factory';
import { t } from '../../i18n';
import { applyUpgrade, availableEntries, confirmUpdate, newSkillOf, rollOffer } from '../../progression';
import { setRunParagraph } from '../../progression/paragraphs';
import { padsFrom } from '../../progression/persist';
import { createRng } from '../../core/rng';
import { equipItem } from '../../items/inventory';
import { makeSetPiece } from '../../items/setPieces';
import { applyDamage } from '../../systems/combat';
import { createRun, nextId, type RunState } from '../../world/run';
import { previewOf, radiusOf, reachOf, type Aim } from '../aim';
import { heroDef, skillIndicesOf, type SkillIndex } from '../defs';
import { assignPad, effectiveSkill, installedSkills } from '../loadout';
import { patchFields, PATCH_FIELD_LIMIT } from '../paragraphs';
import { heroById } from '../registry';
import { castSkill } from '../skills';
import { heroStep } from '../system';
import { castUltimate, setUltimateParagraph, ultimateSeconds } from '../ultimate';
import { MAX_ULT_RADIUS, MAX_ULT_S } from '../ultimateDefs';
import { durationOf, power } from '../helpers';
import { areaOf } from '../helpers';
import { PARADOKS_ECHO, PARADOKS_R, POWTORZENIE_REACH } from './numbers';
import { copiesOf } from './quirk';
import { petlStateIfAny } from './state';

const DT = 1 / 60;
const hero = heroById('petlowiec');
const def = heroDef('petlowiec');
const ids = def.skills.map((k) => k.id);
const NEW: readonly SkillIndex[] = [5, 6, 7, 8, 9];
const IXS = { przybycie: 0, spor: 1, petla: 2, juzBylo: 3, start: 4, uwaga: 5, powtorzenie: 6, paradoks: 7, opoznienie: 8, zamiana: 9 } as const;

const AIMS: Record<string, Aim> = {
  auto: { kind: 'auto' },
  kierunek: { kind: 'kierunek', dx: 0.8, dy: -0.6 },
  wskazanie: { kind: 'wskazanie', x: 700, y: 800 },
};

type Enemy = ReturnType<typeof createEnemy>;

/** One Pętlowiec at (600, 800) with his whole kit installed and enemies at fixed offsets (none attacks, none moves, all are tough). */
function scene(offsets: readonly [number, number][] = [[80, 0], [120, -40], [150, 30], [-90, 10], [100, -90]]): { s: RunState; bus: Bus } {
  const bus = createBus();
  const s = createRun(5, { heroId: 'petlowiec' });
  s.enemies.length = 0;
  s.page.obstacles.length = 0;
  const p = s.player;
  p.x = 600;
  p.y = 800;
  p.baseStats.stats.dmgMin = 10;
  p.baseStats.stats.dmgMax = 10;
  p.baseStats.stats.critChance = 0;
  p.baseStats.stats.pewnoscSiebie = 1e6;
  p.hp = p.hpMax = 1e5;
  p.level = 40;
  for (const i of NEW) s.hero.ranks[i] = 1;
  for (const i of [3, 4] as const) s.hero.ranks[i] = 1;
  for (const [dx, dy] of offsets) addEnemy(s, dx, dy);
  return { s, bus };
}

function addEnemy(s: RunState, dx: number, dy: number, hp = 5000): Enemy {
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

/** Two copies of Przybycie, standing where the scene put them (they are made at the cast; their own steps are not run). */
function withCopies(s: RunState, bus: Bus): void {
  expect(cast(s, bus, 0, 2)).toBe(true); // § 2: two at once
  s.hero.cd[0] = 0;
  for (const m of copiesOf(s)) m.attackTimer = 999; // they shoot only when a test lets them
}

const shots = (s: RunState): RunState['projectiles'] => s.projectiles.filter((x) => x.owner === 'player' && !x.roll);

describe('the filled kit as data', () => {
  it('has ten skills in the order of SKILLS.md, the first five unchanged', () => {
    expect(ids).toEqual(['przybycie', 'spor', 'petla', 'juzBylo', 'start', 'uwaga', 'powtorzenie', 'paradoks', 'opoznienie', 'zamiana']);
    expect(skillIndicesOf(def)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(def.skills.slice(5).every((k) => k.requires === undefined)).toBe(true);
    expect(Object.keys(hero.casts).sort()).toEqual([...ids].sort());
  });

  it('covers the categories 2 / 2-3 / 2 / 2-3, every damage type and every aim mode', () => {
    const cats = ids.map((id) => hero.specs?.categories[id]);
    const count = (c: string): number => cats.filter((x) => x === c).length;
    expect([count('podstawowa'), count('obronna'), count('uzytkowa'), count('ofensywna')]).toEqual([2, 2, 3, 3]);
    expect(new Set(def.skills.map((k) => k.type)).size).toBe(3);
    expect(new Set(def.skills.map((k) => k.aim)).size).toBe(3);
  });

  it('draws a pad, sounds a recipe, opens by a level and says its name for each skill', () => {
    expect(hero.pads).toHaveLength(10);
    expect(new Set(hero.sounds.skills).size).toBe(10);
    for (const k of def.skills) for (const key of [k.nameKey, k.padKey, k.descKey]) expect(t(key), key).not.toBe(key);
    expect(NEW.map((i) => hero.paragraphs[ids[i] ?? '']?.level)).toEqual([1, 5, 11, 3, 14]);
  });

  it('has ten paragraphs of texts and patches that stay in the vocabulary, each § 3 with a price', () => {
    for (const k of def.skills) {
      const list = hero.paragraphs[k.id]?.list ?? [];
      expect(list, k.id).toHaveLength(3);
      for (const p of list) {
        expect(t(p.nameKey), p.nameKey).not.toBe(p.nameKey);
        expect(t(p.descKey), p.descKey).not.toBe(p.descKey);
        expect(patchFields(p.patch)).toBeLessThanOrEqual(PATCH_FIELD_LIMIT);
      }
    }
    for (const i of NEW) {
      const p = hero.paragraphs[ids[i] ?? '']?.list[2].patch ?? {};
      expect((p.cd ?? 0) > 0 || (p.cost ?? 0) > 0 || (p.dur ?? 1) < 1 || (p.dmg ?? 1) < 1, ids[i]).toBe(true);
    }
  });

  it('has ten passives: 7 is the rule and never offered, 8..10 are in the pool and have texts', () => {
    expect(hero.passives).toHaveLength(10);
    expect(hero.passives[6]?.rule).toBe(true);
    const s = createRun(5, { heroId: 'petlowiec' });
    s.player.permissions.push('wygenerowane');
    const pool = availableEntries(s).map((e) => e.id);
    expect(pool).toEqual(expect.arrayContaining(['passive8', 'passive9', 'passive10']));
    expect(pool).not.toContain('passive7');
    for (let n = 1; n <= 10; n++) {
      expect(t(`forms.update.passive.petlowiec.${n}.name`)).not.toContain('forms.update');
      expect(t(`forms.update.passive.petlowiec.${n}.desc`)).not.toContain('forms.update');
    }
  });

  it('has three ultimates at 12 / 24 / 36 of three types, one page-wide, each inside the limits', () => {
    const list = hero.ultimates ?? [];
    expect(list.map((u) => u.level)).toEqual([12, 24, 36]);
    expect(list.map((u) => u.type)).toEqual(['regulaminowy', 'mechaniczny', 'egzystencjalny']);
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
          withCopies(s, bus); // Zamiana, Już to było and Uwaga look for copies
          if (id === 'juzBylo') expect(cast(s, bus, IXS.uwaga)).toBe(true); // something to repeat
          if (id === 'petla') run(s, bus, 1); // a place to return to
          const hp = s.player.hp;
          expect(cast(s, bus, i as SkillIndex, n, aim)).toBe(true);
          expect(s.hero.cdTotal[i]).toBeGreaterThan(0);
          run(s, bus, 4);
          expect(Number.isFinite(s.player.hp)).toBe(true);
          expect(s.player.hp).toBeLessThanOrEqual(hp);
          expect(Number.isFinite(s.player.x) && Number.isFinite(s.player.y)).toBe(true);
          expect(s.player.statuses.every((st) => st.remaining > 0)).toBe(true);
          expect(s.enemies.every((e) => Number.isFinite(e.x) && Number.isFinite(e.y) && Number.isFinite(e.hp))).toBe(true);
        });
      }
    }
  }
});

describe('Uwaga na marginesie', () => {
  it('throws his remark and one from each copy at its own target', () => {
    const { s, bus } = scene([[100, 0], [-100, 0]]);
    withCopies(s, bus);
    const [a, b] = copiesOf(s);
    if (!a || !b) throw new Error('copies');
    a.x = 560;
    a.y = 800;
    b.x = 640;
    b.y = 800;
    const before = shots(s).length;
    expect(cast(s, bus, IXS.uwaga)).toBe(true);
    expect(shots(s).length - before).toBe(3);
    run(s, bus, 1);
    expect(s.enemies.every((e) => lost(e) > 0)).toBe(true);
  });

  it('with nobody in range does nothing and spends no cooldown', () => {
    const { s, bus } = scene([[900, 0]]);
    expect(cast(s, bus, IXS.uwaga)).toBe(false);
    expect(s.hero.cdTotal[IXS.uwaga] ?? 0).toBe(0);
  });

  it('§ 2 zbiorcza aims every copy at his target; § 3 nie na temat is his alone and hits harder', () => {
    const { s, bus } = scene([[100, 0], [-130, 40]]);
    withCopies(s, bus);
    const [a, b] = copiesOf(s);
    if (!a || !b) throw new Error('copies');
    a.x = 520;
    a.y = 820;
    b.x = 560;
    b.y = 830;
    const first = s.enemies[0];
    if (!first) throw new Error('enemy');
    expect(cast(s, bus, IXS.uwaga, 2, { kind: 'auto', target: first })).toBe(true);
    const flying = shots(s);
    expect(flying).toHaveLength(3);
    for (const pr of flying) expect(pr.vx, 'all fly toward the one target').toBeGreaterThan(0);
    s.projectiles.length = 0;
    expect(cast(s, bus, IXS.uwaga, 3)).toBe(true);
    const own = shots(s);
    expect(own).toHaveLength(1);
    expect(own[0]?.damage ?? 0).toBeGreaterThan(0.9 * 1.4);
  });

  it('a paragraph\'s or a set\'s count adds remarks to his own volley', () => {
    const { s, bus } = scene([[100, 0]]);
    assignPad(s, 0, IXS.uwaga);
    s.hero.para = [1, 1, 1, 1, 1];
    s.hero.patch = [undefined, undefined, undefined, undefined, undefined, { count: 1 }];
    s.hero.cd[IXS.uwaga] = 0;
    expect(castSkill(s, bus, 0)).toBe(true);
    expect(shots(s)).toHaveLength(2);
  });
});

describe('Powtórzenie', () => {
  it('strikes the ruled line from him and from each copy', () => {
    const { s, bus } = scene([[100, 0]]);
    const off = addEnemy(s, 100, -200); // on the line of a copy standing 200 above him, not on his own
    const near = s.enemies[0] as Enemy;
    expect(cast(s, bus, IXS.powtorzenie, 1, { kind: 'kierunek', dx: 1, dy: 0 })).toBe(true);
    expect(lost(near)).toBeGreaterThan(0);
    expect(lost(off)).toBe(0);
    s.hero.cd[IXS.powtorzenie] = 0;
    withCopies(s, bus);
    const [a, b] = copiesOf(s);
    if (!a || !b) throw new Error('copies');
    a.x = 600;
    a.y = 600;
    b.x = 600;
    b.y = 1000;
    expect(cast(s, bus, IXS.powtorzenie, 1, { kind: 'kierunek', dx: 1, dy: 0 })).toBe(true);
    expect(lost(off)).toBeGreaterThan(0);
  });

  it('§ 2 is regulaminowy and the struck are wyciszone for a second', () => {
    const { s, bus } = scene([[100, 0]]);
    const e = s.enemies[0];
    if (!e) throw new Error('enemy');
    expect(cast(s, bus, IXS.powtorzenie, 2, { kind: 'kierunek', dx: 1, dy: 0 })).toBe(true);
    expect(effectiveSkill(s, IXS.powtorzenie).type).toBe('regulaminowy');
    expect(hasStatus(e, 'wyciszony')).toBe(true);
  });

  it('§ 3 leaves the line standing for two seconds and strikes along it every half second', () => {
    const { s, bus } = scene([[100, 0]]);
    const e = s.enemies[0];
    if (!e) throw new Error('enemy');
    expect(cast(s, bus, IXS.powtorzenie, 3, { kind: 'kierunek', dx: 1, dy: 0 })).toBe(true);
    expect(s.zones.filter((z) => z.variant === 'zapis')).toHaveLength(1);
    const first = lost(e);
    run(s, bus, 1.1);
    expect(lost(e)).toBeGreaterThan(first);
    run(s, bus, 1.5);
    expect(s.zones.filter((z) => z.variant === 'zapis')).toHaveLength(0);
    const after = lost(e);
    run(s, bus, 1);
    expect(lost(e)).toBe(after);
  });

  it('aims as a direction: the preview is an arrow of 180', () => {
    const { s } = scene();
    const sk = effectiveSkill(s, IXS.powtorzenie);
    expect(reachOf(s, sk)).toBeCloseTo(POWTORZENIE_REACH * areaOf(s, 6), 6);
    const pv = previewOf(s, sk, { kind: 'kierunek', dx: 1, dy: 0 });
    expect(pv?.kind).toBe('arrow');
  });
});

describe('Paradoks', () => {
  it('lays a clock face at the aimed point for four seconds and echoes a hit inside half a second later at half', () => {
    const { s, bus } = scene([[120, 0], [400, 0]]);
    const inside = s.enemies[0];
    const outside = s.enemies[1];
    if (!inside || !outside) throw new Error('enemies');
    expect(cast(s, bus, IXS.paradoks, 1, { kind: 'wskazanie', x: 720, y: 800 })).toBe(true);
    const z = s.zones.find((x) => x.variant === 'paradoks');
    expect(z?.r).toBeCloseTo(PARADOKS_R * areaOf(s, 7), 6);
    expect(z?.ttl).toBeCloseTo(4 * durationOf(s, 7), 1);
    run(s, bus, 0.05);
    applyDamage(s, bus, inside, 40, false, 'mechaniczny', false);
    applyDamage(s, bus, outside, 40, false, 'mechaniczny', false);
    expect(lost(inside)).toBe(40);
    run(s, bus, 0.3);
    expect(lost(inside)).toBe(40);
    run(s, bus, 0.3);
    const echo = Math.round(40 * PARADOKS_ECHO * power(s, 7));
    expect(lost(inside)).toBe(40 + echo); // the echo: half of the hit (and of the rank), and no echo of the echo
    run(s, bus, 1);
    expect(lost(inside)).toBe(40 + echo);
    expect(lost(outside)).toBe(40);
  });

  it('the zone goes at four seconds and the echoes with it', () => {
    const { s, bus } = scene([[120, 0]]);
    const e = s.enemies[0];
    if (!e) throw new Error('enemy');
    cast(s, bus, IXS.paradoks, 1, { kind: 'wskazanie', x: 720, y: 800 });
    run(s, bus, 4 * durationOf(s, 7) + 0.2);
    expect(s.zones.some((x) => x.variant === 'paradoks')).toBe(false);
    const before = lost(e);
    applyDamage(s, bus, e, 40, false, 'mechaniczny', false);
    run(s, bus, 1);
    expect(lost(e) - before).toBe(40);
  });

  it('§ 2 dziadka: mechaniczny, 0.8 of the hit, a radius of 70', () => {
    const { s, bus } = scene([[120, 0]]);
    const e = s.enemies[0];
    if (!e) throw new Error('enemy');
    cast(s, bus, IXS.paradoks, 2, { kind: 'wskazanie', x: 720, y: 800 });
    const z = s.zones.find((x) => x.variant === 'paradoks');
    expect(z?.r).toBeCloseTo(PARADOKS_R * areaOf(s, 7), 6);
    expect((z?.r ?? 0) / PARADOKS_R).toBeLessThan(0.8); // 70, before the rank's 12%
    run(s, bus, 0.05);
    applyDamage(s, bus, e, 50, false, 'mechaniczny', false);
    run(s, bus, 0.7);
    expect(power(s, 7)).toBeGreaterThan(1.6); // the paragraph's 1.6 and the rank
    expect(lost(e)).toBe(50 + Math.round(50 * PARADOKS_ECHO * power(s, 7)));
  });

  it('§ 3 urzędowy: whoever stands inside waits for verification', () => {
    const { s, bus } = scene([[120, 0], [400, 0]]);
    cast(s, bus, IXS.paradoks, 3, { kind: 'wskazanie', x: 720, y: 800 });
    run(s, bus, 0.2);
    expect(hasStatus(s.enemies[0] as Enemy, 'do_weryfikacji')).toBe(true);
    expect(hasStatus(s.enemies[1] as Enemy, 'do_weryfikacji')).toBe(false);
  });

  it('previews a circle of 110 at the aimed point, held to 260 from him', () => {
    const { s } = scene();
    const sk = effectiveSkill(s, IXS.paradoks);
    const pv = previewOf(s, sk, { kind: 'wskazanie', x: 1400, y: 800 });
    expect(pv?.kind).toBe('circle');
    expect(radiusOf(s, sk)).toBeCloseTo(PARADOKS_R * areaOf(s, 7), 6);
    if (pv?.kind === 'circle') expect(pv.x).toBeLessThanOrEqual(600 + 260 + 1);
  });
});

describe('Opóźnienie', () => {
  const hurt = (s: RunState, bus: Bus, amount: number): void => void applyDamage(s, bus, s.player, amount, false, 'mechaniczny', false);

  it('gives the blows back at once and pays half of them three seconds (and the rank) later', () => {
    const { s, bus } = scene([[300, 0]]);
    s.player.hp = s.player.hpMax = 1000;
    expect(cast(s, bus, IXS.opoznienie)).toBe(true);
    const wait = 3 * durationOf(s, IXS.opoznienie);
    run(s, bus, 0.1);
    hurt(s, bus, 100);
    expect(s.player.hp).toBe(1000);
    run(s, bus, wait - 0.3);
    expect(s.player.hp).toBe(1000);
    run(s, bus, 0.6);
    expect(s.player.hp).toBe(950);
    run(s, bus, 5);
    expect(s.player.hp).toBe(950);
  });

  it('logs only while it runs, and never pays down to nothing', () => {
    const { s, bus } = scene([[300, 0]]);
    s.player.hp = s.player.hpMax = 1000;
    cast(s, bus, IXS.opoznienie);
    const wait = 3 * durationOf(s, IXS.opoznienie);
    run(s, bus, 0.1);
    hurt(s, bus, 5000); // a blow that would have killed him
    expect(s.status).toBe('running');
    expect(s.player.hp).toBe(1000);
    run(s, bus, wait + 0.2);
    expect(s.status).toBe('running');
    expect(s.player.hp).toBe(1);
    s.player.hp = 1000;
    hurt(s, bus, 100); // the window is over
    expect(s.player.hp).toBe(900);
  });

  it('§ 2 bezterminowe pays a quarter after two seconds; § 3 sends what is owed to the nearest enemy', () => {
    const { s, bus } = scene([[300, 0]]);
    s.player.hp = s.player.hpMax = 1000;
    cast(s, bus, IXS.opoznienie, 2);
    const wait = 3 * durationOf(s, IXS.opoznienie);
    expect(wait).toBeLessThan(3);
    run(s, bus, 0.1);
    hurt(s, bus, 100);
    run(s, bus, wait - 0.3);
    expect(s.player.hp).toBe(1000);
    run(s, bus, 0.6);
    expect(s.player.hp).toBe(975);
    const e = s.enemies[0];
    if (!e) throw new Error('enemy');
    run(s, bus, 5);
    cast(s, bus, IXS.opoznienie, 3);
    run(s, bus, 0.1);
    const hp = s.player.hp;
    hurt(s, bus, 100);
    run(s, bus, 3 * durationOf(s, IXS.opoznienie) + 0.2);
    expect(s.player.hp).toBe(hp);
    expect(lost(e)).toBe(50);
  });
});

describe('Zamiana miejsc', () => {
  it('does nothing with no copy and spends no cooldown', () => {
    const { s, bus } = scene();
    expect(cast(s, bus, IXS.zamiana)).toBe(false);
    expect(s.hero.cdTotal[IXS.zamiana] ?? 0).toBe(0);
  });

  it('changes places with the nearest copy and reads the enemies he left toward it', () => {
    const { s, bus } = scene([[30, 0], [400, 0]]);
    withCopies(s, bus);
    const [a, b] = copiesOf(s);
    if (!a || !b) throw new Error('copies');
    a.x = 700;
    a.y = 800;
    b.x = 900;
    b.y = 800;
    expect(cast(s, bus, IXS.zamiana)).toBe(true);
    expect(Math.round(s.player.x)).toBe(700);
    expect(Math.round(a.x)).toBe(600);
    expect(Math.round(b.x)).toBe(900);
    const near = s.enemies[0] as Enemy;
    const read = near.statuses.find((st) => st.kind === 'przeczytane');
    expect(read?.source).toBe(a.id);
    expect(hasStatus(s.enemies[1] as Enemy, 'przeczytane')).toBe(false);
  });

  it('§ 2 swaps with the nearest enemy that is not a boss; § 3 renews the copy\'s stay, longer', () => {
    const { s, bus } = scene([[150, 0], [-60, 0]]);
    const boss = s.enemies[1];
    if (!boss) throw new Error('enemy');
    boss.boss = true;
    const other = s.enemies[0];
    if (!other) throw new Error('enemy');
    expect(cast(s, bus, IXS.zamiana, 2)).toBe(true);
    expect(Math.round(s.player.x)).toBe(750);
    expect(Math.round(other.x)).toBe(600);
    expect(Math.round(boss.x)).toBe(540);
    const { s: s2, bus: bus2 } = scene([[150, 0]]);
    withCopies(s2, bus2);
    const [m] = copiesOf(s2);
    if (!m) throw new Error('copy');
    for (const c of copiesOf(s2)) c.ttl = 1;
    expect(cast(s2, bus2, IXS.zamiana, 3)).toBe(true);
    expect(Math.max(...copiesOf(s2).map((c) => c.ttl))).toBeGreaterThan(9);
    expect(m.ttl).toBeGreaterThan(0);
  });
});

describe('the passives 8..10', () => {
  it('8, Sprzeczność: a copy\'s shot of another type than his last hit is raised by 15%', () => {
    const { s, bus } = scene([[150, 0]]);
    s.hero.upgrades['passive8'] = 1;
    run(s, bus, 0.1);
    withCopies(s, bus);
    const [a] = copiesOf(s);
    if (!a) throw new Error('copy');
    a.x = 700;
    a.y = 800;
    cast(s, bus, IXS.opoznienie); // his last hit is regulaminowy, the copy's is egzystencjalny
    a.attackTimer = 0;
    run(s, bus, 0.05);
    const fired = shots(s).find((x) => x.x > 690);
    expect(fired?.damage).toBeCloseTo(a.damageMul * 1.15, 6);
  });

  it('8 does nothing when the copy\'s shot is of his last type, or without the passive', () => {
    const { s, bus } = scene([[150, 0]]);
    s.hero.upgrades['passive8'] = 1;
    run(s, bus, 0.1);
    withCopies(s, bus);
    const [a] = copiesOf(s);
    if (!a) throw new Error('copy');
    a.x = 700;
    a.y = 800;
    cast(s, bus, IXS.uwaga); // egzystencjalny, as the copy's shot
    s.projectiles.length = 0;
    a.attackTimer = 0;
    run(s, bus, 0.05);
    const fired = shots(s).find((x) => x.x > 690);
    expect(fired?.damage).toBeCloseTo(a.damageMul, 6);
  });

  it('9, Dziennik pokładowy: the third identical cast in a row is free', () => {
    const { s, bus } = scene([[150, 0]]);
    s.hero.upgrades['passive9'] = 1;
    run(s, bus, 0.1);
    for (let k = 0; k < 2; k++) {
      expect(cast(s, bus, IXS.uwaga)).toBe(true);
      expect(s.hero.cd[IXS.uwaga]).toBeGreaterThan(0);
    }
    expect(cast(s, bus, IXS.uwaga)).toBe(true);
    expect(s.hero.cd[IXS.uwaga]).toBe(0);
    expect(cast(s, bus, IXS.uwaga)).toBe(true);
    expect(s.hero.cd[IXS.uwaga]).toBeGreaterThan(0); // the count starts again
  });

  it('9 counts a different skill in between as the end of the row, and does nothing without the passive', () => {
    const { s, bus } = scene([[150, 0]]);
    s.hero.upgrades['passive9'] = 1;
    run(s, bus, 0.1);
    cast(s, bus, IXS.uwaga);
    cast(s, bus, IXS.uwaga);
    cast(s, bus, IXS.opoznienie);
    cast(s, bus, IXS.uwaga);
    expect(s.hero.cd[IXS.uwaga]).toBeGreaterThan(0);
    const { s: s2, bus: bus2 } = scene([[150, 0]]);
    for (let k = 0; k < 3; k++) cast(s2, bus2, IXS.uwaga);
    expect(s2.hero.cd[IXS.uwaga]).toBeGreaterThan(0);
  });

  it('10, Zapasowa kapsuła: Pętla gives the copies the whole of their stay again', () => {
    const { s, bus } = scene([[300, 0]]);
    s.hero.upgrades['passive10'] = 1;
    withCopies(s, bus);
    run(s, bus, 1);
    for (const m of copiesOf(s)) m.ttl = 2;
    expect(cast(s, bus, IXS.petla)).toBe(true);
    for (const m of copiesOf(s)) expect(m.ttl).toBeGreaterThan(4.9);
  });

  it('10 leaves the copies alone without the passive', () => {
    const { s, bus } = scene([[300, 0]]);
    withCopies(s, bus);
    run(s, bus, 1);
    for (const m of copiesOf(s)) m.ttl = 2;
    cast(s, bus, IXS.petla);
    for (const m of copiesOf(s)) expect(m.ttl).toBeLessThan(3);
  });
});

describe('the update form and the schedule of the later skills', () => {
  it('offers a skill past the fifth only from its level', () => {
    const s = createRun(5, { heroId: 'petlowiec' });
    s.player.level = 2;
    const has = (id: string): boolean => availableEntries(s).some((e) => e.id === id);
    expect(has('skill6')).toBe(true); // Uwaga, level 1
    expect(has('skill9')).toBe(false);
    s.player.level = 3;
    expect(has('skill9')).toBe(true); // Opóźnienie
    expect(has('skill7')).toBe(false);
    s.player.level = 5;
    expect(has('skill7')).toBe(true); // Powtórzenie
    expect(has('skill8')).toBe(false);
    s.player.level = 11;
    expect(has('skill8')).toBe(true); // Paradoks
    expect(has('skill10')).toBe(false);
    s.player.level = 14;
    expect(has('skill10')).toBe(true); // Zamiana miejsc
  });

  it('leads the form with the new skill, installs it free of any permission, and asks for its pad', () => {
    const s = createRun(5, { heroId: 'petlowiec' });
    s.player.level = 3;
    const offer = rollOffer(s, 0);
    expect(['skill6', 'skill9']).toContain(offer.entries[0]?.id);
    expect(offer.entries[0]?.locked).toBe(false);
    s.hero.offer = offer;
    const before = [...s.hero.ranks];
    expect(confirmUpdate(s, offer.entries[0]?.id ?? '')).toBe(true);
    const fresh = newSkillOf(before, s.hero.ranks);
    expect([5, 8]).toContain(fresh);
    expect(installedSkills(s)).toContain(fresh);
    expect(assignPad(s, 1, fresh ?? 0)).toBe(true);
  });

  it('keeps a pad on the tenth skill through a save', () => {
    expect(padsFrom([0, 1, 9])).toEqual([0, 1, 9]);
    const s = createRun(5, { heroId: 'petlowiec' });
    s.player.level = 14;
    expect(applyUpgrade(s, 'skill10')).toBe(true);
    expect(assignPad(s, 2, 9)).toBe(true);
    expect(s.hero.pads).toEqual([0, 1, 9]);
  });
});

describe('Cofnięcie zgłoszenia (ultimate 2) and Przedwczesny powrót (ultimate 3)', () => {
  function cast2(offsets: readonly [number, number][], id: string, para: 1 | 2 | 3): { s: RunState; bus: Bus; log: string[] } {
    const { s, bus } = scene(offsets);
    s.hero.ultimateId = id;
    s.player.level = 40;
    setUltimateParagraph(s, para);
    s.player.meter = 1;
    const log: string[] = [];
    for (const name of ['stamp', 'margin:note', 'ultimate:cast'] as const) bus.on(name, () => log.push(name));
    return { s, bus, log };
  }

  it('open at their own levels and not before', () => {
    for (const [id, level] of [['cofniecie', 24], ['przedwczesny', 36]] as const) {
      const { s, bus } = scene([[60, 0]]);
      s.hero.ultimateId = id;
      s.player.meter = 1;
      s.player.level = level - 1;
      expect(castUltimate(s, bus), id).toBe(false);
      s.player.level = level;
      expect(castUltimate(s, bus), id).toBe(true);
    }
  });

  it('stamp once, write one margin note, announce the cast, in every paragraph; and end within their seconds', () => {
    for (const id of ['cofniecie', 'przedwczesny']) {
      for (const para of [1, 2, 3] as const) {
        const { s, bus, log } = cast2([[80, 0], [-90, 30]], id, para);
        expect(castUltimate(s, bus)).toBe(true);
        expect(log.filter((x) => x === 'stamp'), `${id} ${para}`).toHaveLength(1);
        expect(log.filter((x) => x === 'margin:note'), `${id} ${para}`).toHaveLength(1);
        expect(log.filter((x) => x === 'ultimate:cast'), `${id} ${para}`).toHaveLength(1);
        const u = (hero.ultimates ?? []).find((x) => x.id === id);
        if (!u) throw new Error(id);
        run(s, bus, ultimateSeconds(u, para) + 0.2);
        expect(s.hero.ult?.active ?? [], `${id} ${para}`).toHaveLength(0);
      }
    }
  });

  /** Walk for four seconds, then he and an enemy are somewhere else; cast Cofnięcie. */
  function displaced(para: 1 | 2 | 3): { s: RunState; bus: Bus; e: Enemy; boss: Enemy } {
    const { s, bus } = cast2([[100, 0], [0, 150]], 'cofniecie', para);
    s.player.hp = 800;
    s.player.hpMax = 1000;
    const e = s.enemies[0] as Enemy;
    const boss = s.enemies[1] as Enemy;
    boss.boss = true;
    run(s, bus, 4);
    s.player.x = 300;
    s.player.y = 500;
    s.player.hp = 300;
    e.x = 900;
    e.y = 900;
    boss.x = 900;
    boss.y = 300;
    run(s, bus, 0.6);
    expect(castUltimate(s, bus)).toBe(true);
    return { s, bus, e, boss };
  }

  it('Cofnięcie returns him and every enemy that is not a boss to where they stood, raises his racja, and strikes the rest 1.5x', () => {
    const { s, e, boss } = displaced(1);
    expect(Math.round(s.player.x)).toBe(600);
    expect(Math.round(s.player.y)).toBe(800);
    expect(s.player.hp).toBeGreaterThanOrEqual(800);
    expect(Math.round(e.x)).toBe(700);
    expect(Math.round(e.y)).toBe(800);
    expect(Math.round(boss.x)).toBe(900); // a boss is not moved
    expect(lost(e)).toBeGreaterThan(0);
    expect(lost(boss)).toBeGreaterThan(0);
  });

  it('Cofnięcie leaves the dead dead', () => {
    const { s, bus } = cast2([[100, 0], [0, 150]], 'cofniecie', 1);
    run(s, bus, 2);
    const gone = s.enemies[0] as Enemy;
    s.enemies.splice(0, 1);
    s.player.meter = 1;
    expect(castUltimate(s, bus)).toBe(true);
    expect(s.enemies).not.toContain(gone);
    expect(s.enemies).toHaveLength(1);
  });

  it('Cofnięcie § 2 withdraws ten seconds and strikes nobody; § 3 returns only him and locks everyone for two seconds', () => {
    const two = displaced(2);
    expect(lost(two.e)).toBe(0);
    expect(Math.round(two.e.x)).toBe(700);
    const three = displaced(3);
    expect(Math.round(three.s.player.x)).toBe(600);
    expect(Math.round(three.e.x)).toBe(900); // the enemy stays where it is
    expect(hasStatus(three.e, 'zablokowany')).toBe(true);
  });

  it('Cofnięcie does not return across a page turn', () => {
    const { s, bus } = cast2([[100, 0]], 'cofniecie', 1);
    run(s, bus, 2);
    s.pageIndex = 1;
    s.player.x = 300;
    s.player.meter = 1;
    expect(castUltimate(s, bus)).toBe(true);
    expect(Math.round(s.player.x)).toBe(300);
  });

  it('Przedwczesny powrót strikes 2.5x within 100 of him and of every copy at once, and holds the generated to 0.3', () => {
    const { s, bus } = cast2([[60, 0], [-300, 0], [300, 300]], 'przedwczesny', 1);
    withCopies(s, bus);
    const [a] = copiesOf(s);
    if (!a) throw new Error('copy');
    a.x = 300;
    a.y = 800;
    a.ttl = 99;
    const nearHim = s.enemies[0] as Enemy;
    const nearCopy = s.enemies[1] as Enemy;
    const far = s.enemies[2] as Enemy;
    (nearCopy as Enemy & { existence?: number }).existence = 1;
    s.player.meter = 1;
    expect(castUltimate(s, bus)).toBe(true);
    expect(lost(nearHim)).toBeGreaterThan(0);
    expect(lost(nearCopy)).toBeGreaterThan(0);
    expect(lost(far)).toBe(0);
    run(s, bus, 0.2);
    expect((nearCopy as Enemy & { existence?: number }).existence).toBeLessThanOrEqual(0.3);
  });

  it('Przedwczesny § 2 pushes the struck away by 90; § 3 falls three times, 0.5 s apart, on him only', () => {
    const { s, bus } = cast2([[60, 0]], 'przedwczesny', 2);
    const e = s.enemies[0] as Enemy;
    expect(castUltimate(s, bus)).toBe(true);
    expect(e.x).toBeGreaterThan(660 + 40);
    const three = cast2([[60, 0], [-400, 0]], 'przedwczesny', 3);
    const fallen: number[] = [];
    const watched = three.s.enemies[0] as Enemy;
    expect(castUltimate(three.s, three.bus)).toBe(true);
    fallen.push(lost(watched));
    run(three.s, three.bus, 0.6);
    fallen.push(lost(watched));
    run(three.s, three.bus, 0.5);
    fallen.push(lost(watched));
    run(three.s, three.bus, 1);
    fallen.push(lost(watched));
    expect(fallen[1]).toBeGreaterThan(fallen[0] ?? 0);
    expect(fallen[2]).toBeGreaterThan(fallen[1] ?? 0);
    expect(fallen[3]).toBe(fallen[2]);
  });
});

describe('the record the quirk keeps', () => {
  it('is made by the first step, and a run that has none leaves nothing behind', () => {
    const { s, bus } = scene([[100, 0]]);
    expect(petlStateIfAny(s)).toBeUndefined();
    run(s, bus, 1);
    expect(petlStateIfAny(s)?.snaps.length).toBeGreaterThan(0);
  });
});

describe('the S17 set patch that waited for his skill', () => {
  it('«Infolinia» adds one remark to Uwaga na marginesie', () => {
    const { s, bus } = scene([[100, 0]]);
    for (let i = 0; i < 3; i++) {
      const item = makeSetPiece(createRng(30 + i), 'infolinia', 5, i as 0 | 1 | 2);
      if (!item) throw new Error('infolinia');
      item.number = 100 + i;
      s.player.inventory.push(item);
      equipItem(s.player, item);
    }
    expect(cast(s, bus, IXS.uwaga)).toBe(true);
    expect(shots(s)).toHaveLength(2);
  });
});
