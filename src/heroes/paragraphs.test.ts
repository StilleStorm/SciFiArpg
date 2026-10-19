/** Paragraphs (S2): the 75 of the data, and each kind of patch seen at work in a real cast. */
import { describe, expect, it } from 'vitest';
import { createBus, type Bus } from '../core/events';
import { createEnemy } from '../entities/factory';
import { t } from '../i18n';
import { createRun, nextId, type RunState } from '../world/run';
import { AUTO_AIM, fitAim, reachOf } from './aim';
import { HEROES, type SkillIndex } from './defs';
import { effectiveSkill, padSkill } from './loadout';
import { applyParagraph, patchFields, PATCH_FIELD_LIMIT, PATCH_KEYS, type ParagraphPatch } from './paragraphs';
import { heroById, HERO_IDS, type HeroId } from './registry';
import { castSkill } from './skills';
import { heroStep } from './system';

/** A run with `n` enemies at the given offsets from the hero (huge racja, harmless), the hero at (600, 800). */
function scene(heroId: HeroId, offsets: [number, number][], patch: (ParagraphPatch | undefined)[] = []): { s: RunState; bus: Bus } {
  const bus = createBus();
  const s = createRun(5, { heroId });
  s.enemies.length = 0;
  s.page.obstacles.length = 0;
  s.player.x = 600;
  s.player.y = 800;
  s.player.baseStats.stats.dmgMin = 10;
  s.player.baseStats.stats.dmgMax = 10;
  s.player.baseStats.stats.critChance = 0;
  s.player.hp = s.player.hpMax = 1000;
  for (const [dx, dy] of offsets) {
    const e = createEnemy(nextId(s), s.player.x + dx, s.player.y + dy, 1);
    e.hp = e.hpMax = 5000;
    e.stats.upor = 0;
    e.stats.resist = {};
    e.attackTimer = 999;
    s.enemies.push(e);
  }
  if (patch.some((p) => p)) {
    s.hero.para = [1, 1, 1, 1, 1];
    s.hero.patch = patch;
  }
  for (const i of [3, 4] as const) s.hero.ranks[i] = 1;
  return { s, bus };
}

const patchAt = (i: SkillIndex, p: ParagraphPatch): (ParagraphPatch | undefined)[] => {
  const out: (ParagraphPatch | undefined)[] = [undefined, undefined, undefined, undefined, undefined];
  out[i] = p;
  return out;
};

describe('the 75 paragraphs', () => {
  it('every skill of every hero has three, § 1 unpatched, the others at most four fields from the vocabulary', () => {
    let count = 0;
    for (const id of HERO_IDS) {
      const m = heroById(id);
      expect(Object.keys(m.paragraphs).sort(), id).toEqual(m.def.skills.map((k) => k.id).sort());
      for (const sk of m.def.skills) {
        const list = m.paragraphs[sk.id]?.list ?? [];
        expect(list, `${id}.${sk.id}`).toHaveLength(3);
        expect(patchFields(list[0]?.patch ?? { dmg: 1 }), `${id}.${sk.id} 1`).toBe(0);
        for (const p of list) {
          count++;
          expect(patchFields(p.patch), `${id}.${sk.id}.${p.n}`).toBeLessThanOrEqual(PATCH_FIELD_LIMIT);
          for (const k of Object.keys(p.patch)) expect(PATCH_KEYS as readonly string[], `${id}.${sk.id}.${p.n} ${k}`).toContain(k);
        }
        expect(list.map((p) => p.n)).toEqual([1, 2, 3]);
        expect(list.map((p) => patchFields(p.patch) > 0)).toEqual([false, true, true]);
      }
    }
    expect(count).toBe(75);
  });

  it('every § 3 carries a price: a longer cooldown, racja, a shorter or weaker skill', () => {
    for (const id of HERO_IDS) {
      for (const [skill, sp] of Object.entries(heroById(id).paragraphs)) {
        const p = sp.list[2].patch;
        const price = (p.cd ?? 0) > 0 || (p.cost ?? 0) > 0 || (p.dur ?? 1) < 1 || (p.dmg ?? 1) < 1;
        expect(price, `${id}.${skill}`).toBe(true);
      }
    }
  });

  it('names and one-line descriptions exist in Polish, are not shouted, and no two paragraphs of a skill share a name', () => {
    for (const id of HERO_IDS) {
      for (const [skill, sp] of Object.entries(heroById(id).paragraphs)) {
        const names = new Set<string>();
        for (const p of sp.list) {
          const name = t(p.nameKey);
          const desc = t(p.descKey);
          expect(name, p.nameKey).not.toBe(p.nameKey);
          expect(desc, p.descKey).not.toBe(p.descKey);
          expect(desc, `${id}.${skill}.${p.n}`).not.toContain('!');
          expect(desc.length, `${id}.${skill}.${p.n}`).toBeLessThanOrEqual(120);
          names.add(name);
        }
        expect(names.size, `${id}.${skill}`).toBe(3);
      }
    }
  });

  it('each skill opens at the level SKILLS.md gives it', () => {
    for (const id of HERO_IDS) for (const sp of Object.values(heroById(id).paragraphs)) expect(sp.level).toBeGreaterThanOrEqual(1);
    expect(heroById('pralka').paragraphs['beben']?.level).toBe(5);
    expect(heroById('konsultant').paragraphs['pomoc']?.level).toBe(9);
  });
});

describe('applyParagraph', () => {
  const base = HEROES[0]?.skills[0];

  it('is the identity for no patch or an empty one, and never touches the original', () => {
    if (!base) throw new Error('no hero');
    expect(applyParagraph(base, undefined)).toBe(base);
    expect(applyParagraph(base, {})).toBe(base);
    const out = applyParagraph(base, { type: 'egzystencjalny', cd: 3 });
    expect(base.type).not.toBe('egzystencjalny');
    expect(out.id).toBe(base.id);
    expect(out.nameKey).toBe(base.nameKey);
  });

  it('type: retypes the skill, and the damage it deals runs against the new resist', () => {
    const dealt = (patch: ParagraphPatch | undefined): number => {
      const { s, bus } = scene('pralka', [[40, 0]], patch ? patchAt(0, patch) : []);
      const e = s.enemies[0];
      if (!e) throw new Error('no enemy');
      e.stats.resist = { mechaniczny: 50 };
      expect(castSkill(s, bus, 0)).toBe(true);
      return e.hpMax - e.hp;
    };
    expect(effectiveSkill(scene('pralka', [], patchAt(0, { type: 'regulaminowy' })).s, 0).type).toBe('regulaminowy');
    expect(dealt({ type: 'regulaminowy' })).toBeGreaterThan(dealt(undefined) * 1.5);
  });

  it('shape: area widens the radius, width narrows a cone, reach lengthens an aimed skill, count adds lines', () => {
    const hits = (patch: ParagraphPatch | undefined, i: SkillIndex, offsets: [number, number][], slot: 0 | 1 | 2 = 0): number => {
      const { s, bus } = scene('pralka', offsets, patch ? patchAt(i, patch) : []);
      s.hero.pads[slot] = i;
      castSkill(s, bus, slot, false, { kind: 'kierunek', dx: 1, dy: 0 });
      return s.enemies.filter((e) => e.hp < e.hpMax).length;
    };
    // Wirowanie: radius 96 -> 115 with area 1.2
    expect(hits(undefined, 0, [[110, 0]])).toBe(0);
    expect(hits({ area: 1.2 }, 0, [[110, 0]])).toBe(1);
    // Otwarcie bebna: half-angle 35 degrees; an enemy at 25 degrees is in the cone, not in a quarter of it
    const off: [number, number][] = [[100 * Math.cos(0.436), 100 * Math.sin(0.436)]];
    expect(hits(undefined, 3, off)).toBe(1);
    expect(hits({ width: 0.25 }, 3, off)).toBe(0);
    // reach reads through the skill data the aim geometry gets
    const s = scene('pralka', [], patchAt(2, { reach: 1.4 })).s;
    const plain = HEROES[0]?.skills[2];
    if (!plain) throw new Error('no skill');
    expect(reachOf(s, effectiveSkill(s, 2))).toBeCloseTo(reachOf(s, plain) * 1.4, 6);
    // Triangulacja: count 2 -> three lines
    const lines = (patch: ParagraphPatch | undefined): number => {
      const sc = scene('kartograf', [], patch ? patchAt(0, patch) : []);
      castSkill(sc.s, sc.bus, 0, false, { kind: 'kierunek', dx: 1, dy: 0 });
      return sc.s.projectiles.length;
    };
    expect(lines(undefined)).toBe(1);
    expect(lines({ count: 2 })).toBe(3);
  });

  it('aim: a paragraph can make a skill a tap, and the pad then reads the patched mode', () => {
    const { s, bus } = scene('pralka', [[80, 0]], patchAt(2, { aim: 'auto' }));
    s.hero.pads[0] = 2;
    expect(HEROES[0]?.skills[2]?.aim).toBe('kierunek');
    expect(padSkill(s, 0).aim).toBe('auto');
    expect(fitAim(effectiveSkill(s, 2), { kind: 'kierunek', dx: 0, dy: 1 })).toEqual(AUTO_AIM);
    expect(castSkill(s, bus, 0, false, { kind: 'kierunek', dx: 0, dy: -1 })).toBe(true); // runs as the auto cast
  });

  it('status: a marker is laid on whoever the cast strikes, and only that cast', () => {
    const kinds = (patch: ParagraphPatch | undefined): string[] => {
      const { s, bus } = scene('pralka', [[40, 0], [200, 0]], patch ? patchAt(0, patch) : []);
      castSkill(s, bus, 0);
      return s.enemies.flatMap((e) => e.statuses.map((x) => x.kind));
    };
    expect(kinds(undefined)).not.toContain('zgloszony');
    expect(kinds({ status: { kind: 'zgloszony', seconds: 2 } })).toEqual(['zgloszony']);
    // a statusApply cast (Przekierowuje) lays it too
    const { s, bus } = scene('konsultant', [[60, 0]], patchAt(1, { status: { kind: 'wyciszony', seconds: 2 } }));
    s.hero.pads[0] = 1;
    castSkill(s, bus, 0, false, { kind: 'kierunek', dx: 1, dy: 0 });
    expect(s.enemies[0]?.statuses.map((x) => x.kind)).toContain('wyciszony');
  });

  it('cost: racja is spent at the cast but never the last of it, and cd moves the cooldown', () => {
    const { s, bus } = scene('pralka', [[40, 0]], patchAt(0, { cost: 30, cd: 3 }));
    const was = s.player.hp;
    castSkill(s, bus, 0);
    expect(s.player.hp).toBe(was - 30);
    const plain = scene('pralka', [[40, 0]]);
    castSkill(plain.s, plain.bus, 0);
    expect(s.hero.cdTotal[0] - plain.s.hero.cdTotal[0]).toBeCloseTo(3, 6);
    const poor = scene('pralka', [[40, 0]], patchAt(0, { cost: 50 }));
    poor.s.player.hp = 20;
    castSkill(poor.s, poor.bus, 0);
    expect(poor.s.player.hp).toBe(1);
    // a cast that does nothing costs nothing
    const none = scene('pralka', [], patchAt(3, { cost: 30 }));
    none.s.hero.pads[0] = 3;
    expect(castSkill(none.s, none.bus, 0, false, { kind: 'kierunek', dx: 1, dy: 0 })).toBe(false);
    expect(none.s.player.hp).toBe(none.s.player.hpMax);
  });

  it('a zwolnienie stamp waives the price: no racja cost, no added cooldown', () => {
    const { s, bus } = scene('pralka', [[40, 0]], patchAt(0, { cost: 30, cd: 3 }));
    s.buffs = [{ id: 'zwolnienie', remaining: 30, total: 30 }];
    const was = s.player.hp;
    castSkill(s, bus, 0);
    expect(s.player.hp).toBe(was);
    const plain = scene('pralka', [[40, 0]]);
    castSkill(plain.s, plain.bus, 0);
    expect(s.hero.cdTotal[0]).toBeCloseTo(plain.s.hero.cdTotal[0], 6);
  });

  it('dur and dmg: the duration and the damage of the skill follow the patch', () => {
    const foam = (patch: ParagraphPatch | undefined): number => {
      const { s, bus } = scene('pralka', [], patch ? patchAt(1, patch) : []);
      s.hero.pads[0] = 1;
      castSkill(s, bus, 0);
      return s.hero.shieldUntil - s.time;
    };
    expect(foam({ dur: 1.6 }) / foam(undefined)).toBeCloseTo(1.6, 6);
    const dmg = (patch: ParagraphPatch | undefined): number => {
      const { s, bus } = scene('pralka', [[40, 0]], patch ? patchAt(0, patch) : []);
      castSkill(s, bus, 0);
      return (s.enemies[0]?.hpMax ?? 0) - (s.enemies[0]?.hp ?? 0);
    };
    expect(dmg({ dmg: 2 })).toBeGreaterThanOrEqual(dmg(undefined) * 1.9);
  });

  it('with no patch the hero system leaves the run as it was (no paragraph fields)', () => {
    const { s, bus } = scene('petlowiec', [[60, 0]]);
    castSkill(s, bus, 1);
    for (let i = 0; i < 30; i++) heroStep(s, bus, 1 / 60);
    expect(s.hero.para).toBeUndefined();
    expect(s.hero.patch).toBeUndefined();
  });
});
