/** The ten paragraph uniques and the set effects that reach the heroes (S17, ITEMS 4.2, 12.2): ranks, unlock while worn, the carried paragraph. */
import { describe, expect, it } from 'vitest';
import { createBus } from '../core/events';
import { createRng } from '../core/rng';
import { applyPetla } from '../death/outcomes';
import { BASES_BY_ID } from '../items/bases';
import { equipItem, unequipSlot } from '../items/inventory';
import { trialMultiplier } from '../items/reviews';
import { makeSetPiece } from '../items/setPieces';
import type { SetId } from '../items/sets';
import { UNIQUES, UNIQUES_BY_ID, makeUnique } from '../items/uniques';
import { createRun, type RunState } from '../world/run';
import { grantSkill, heroOfSkill, itemRanksOf, layPatch, paragraphAt, patchAt, rankOf, skillIndexOf } from './grants';
import type { SkillIndex } from './defs';
import { HERO_IDS, heroById, type HeroId } from './registry';
import { cooldownOf, durationOf, patchOf, power } from './helpers';
import { effectiveSkill, fixPads, isInstalled } from './loadout';
import { projectileDamageMul } from './shield';
import { castSkill } from './skills';
import { mergeCapstone, runCapstone } from './specializations';
import { quirk as pralkaQuirk } from './pralka/quirk';
import { quirk as nalesnikQuirk } from './nalesnik/quirk';

const GRANTED = UNIQUES.filter((u) => u.grant);

const wearUnique = (s: RunState, id: string, uid = 4000): void => {
  const def = UNIQUES_BY_ID.get(id);
  const item = def ? makeUnique(def, uid, 5) : null;
  if (!item) throw new Error(id);
  item.number = uid;
  s.player.inventory.push(item);
  equipItem(s.player, item);
};

const wearSet = (s: RunState, set: SetId): void => {
  for (let i = 0; i < 3; i++) {
    const item = makeSetPiece(createRng(30 + i), set, 5, i as 0 | 1 | 2);
    if (!item) throw new Error(set);
    item.number = 100 + i;
    s.player.inventory.push(item);
    equipItem(s.player, item);
  }
};

const ownerOf = (id: string): HeroId => {
  const skill = UNIQUES_BY_ID.get(id)?.grant?.skill ?? '';
  const owner = heroOfSkill(skill);
  if (!owner) throw new Error(`no hero owns ${skill}`);
  return owner;
};

describe('the ten paragraph uniques', () => {
  it('are ten, two for each hero, each on an existing § 2 or § 3 of a skill the hero has', () => {
    expect(GRANTED).toHaveLength(10);
    const perHero = new Map<string, number>();
    for (const u of GRANTED) {
      const grant = u.grant;
      expect(grant, u.id).toBeDefined();
      if (!grant) continue;
      const owner = heroOfSkill(grant.skill);
      expect(owner, `${u.id} -> ${grant.skill}`).not.toBeNull();
      if (!owner) continue;
      perHero.set(owner, (perHero.get(owner) ?? 0) + 1);
      expect([2, 3]).toContain(grant.para);
      expect([1, 2]).toContain(grant.ranks);
      const para = heroById(owner).paragraphs[grant.skill]?.list[grant.para - 1];
      expect(para, `${u.id}`).toBeDefined();
      expect(para?.patch).not.toEqual({});
      expect(BASES_BY_ID.get(u.baseId), u.id).toBeDefined();
    }
    for (const id of HERO_IDS) expect(perHero.get(id) ?? 0, id).toBe(HERO_IDS.indexOf(id) < 5 ? 2 : 0); // a hero in the making has none yet
  });

  it('use flat stats only (makeUnique scales every number by the level)', () => {
    for (const u of GRANTED) for (const k of ['tempo', 'zasieg', 'gwiazdki', 'proba'] as const) expect(u.stats[k], `${u.id} ${k}`).toBeUndefined();
  });
});

describe('ranks from a worn unique', () => {
  it('add to the skill of the hero it concerns, over the cap of 3, and nothing for the others', () => {
    const owner = ownerOf('program95'); // wirowanie §3, +2 ranks
    const s = createRun(5, { heroId: owner });
    const i = skillIndexOf(owner, 'wirowanie');
    expect(rankOf(s, i as 0)).toBe(0);
    const before = power(s, i as 0);
    wearUnique(s, 'program95');
    expect(itemRanksOf(s.player, i as 0)).toBe(2);
    expect(rankOf(s, i as 0)).toBe(2);
    expect(power(s, i as 0)).toBeGreaterThan(before);
    s.hero.ranks[i] = 3; // the cap of an update form
    expect(rankOf(s, i as 0)).toBe(5);
    expect(power(s, i as 0)).toBeCloseTo((1 + 0.25 * 5) * s.hero.mods.dmg * (patchOf(s, i as 0)?.dmg ?? 1));
    expect(durationOf(s, i as 0)).toBeGreaterThan(1);
    expect(cooldownOf(s, i as 0, 10)).toBeLessThan(10);
    unequipSlot(s.player, 'przyrzad');
    expect(rankOf(s, i as 0)).toBe(3);
  });

  it('are stats only for another hero: no ranks, no paragraph', () => {
    const s = createRun(5, { heroId: 'konsultant' });
    wearUnique(s, 'program95');
    for (const i of [0, 1, 2, 3, 4] as const) {
      expect(rankOf(s, i)).toBe(0);
      expect(patchAt(s, i)).toBeUndefined();
    }
    expect(s.player.grants).toHaveLength(1); // the grant is on the player, it just concerns nobody here
    expect(grantSkill('konsultant', { skill: 'wirowanie' })).toBeNull();
  });

  it('a niekompatybilny unique gives nothing', () => {
    const s = createRun(5, { heroId: ownerOf('program95') });
    const older = makeSetPiece(createRng(2), 'awaria', 5, 0); // likes chaos, which «Program 95°» does not stand
    if (!older) throw new Error('piece');
    older.number = 1;
    s.player.inventory.push(older);
    equipItem(s.player, older);
    wearUnique(s, 'program95');
    expect(s.player.equipment.przyrzad?.blockedBy).toBeDefined();
    expect(s.player.grants).toBeUndefined();
    expect(rankOf(s, 0)).toBe(0);
  });
});

describe('a worn unique unlocks its skill', () => {
  it.each([['windykacja'], ['atmosfera']])('%s: the granted skill is installed while it is worn, and leaves the pads when it is taken off', (id) => {
    const owner = ownerOf(id);
    const s = createRun(5, { heroId: owner });
    const i = skillIndexOf(owner, UNIQUES_BY_ID.get(id)?.grant?.skill ?? '') as SkillIndex;
    expect(i).toBeGreaterThanOrEqual(4); // a skill the hero does not start with
    expect(isInstalled(s, i)).toBe(false);
    wearUnique(s, id);
    expect(isInstalled(s, i)).toBe(true);
    s.hero.pads = [0, 1, i];
    fixPads(s);
    expect(s.hero.pads[2]).toBe(i);
    const slot = s.player.equipment.nakrycie ? 'nakrycie' : 'odziez';
    unequipSlot(s.player, slot);
    fixPads(s);
    expect(isInstalled(s, i)).toBe(false);
    expect(s.hero.pads).not.toContain(i);
  });

  it('«Atmosfera szczątkowa» carries Zaokrąglenie § 3 w dół: cast at level 1, he lies flat and every shot skims off (ITEMS §12)', () => {
    expect(UNIQUES_BY_ID.get('atmosfera')?.grant).toEqual({ skill: 'zaokraglenie', para: 3, ranks: 2 });
    const s = createRun(5, { heroId: 'nalesnik' });
    const i = skillIndexOf('nalesnik', 'zaokraglenie') as SkillIndex;
    wearUnique(s, 'atmosfera');
    expect(paragraphAt(s, i)).toBe(3);
    s.hero.pads = [0, 1, i];
    fixPads(s);
    expect(castSkill(s, createBus(), 2)).toBe(true);
    expect(s.player.flat).toBe(true);
    expect(projectileDamageMul(s.player)).toBe(0);
  });
});

describe('the paragraph a unique carries', () => {
  it('is active while it is worn without being unlocked, and the skill is cast with it', () => {
    const owner = ownerOf('oczekiwanie'); // prosze §3: cooldown +4, egzystencjalny
    const s = createRun(5, { heroId: owner });
    const i = skillIndexOf(owner, 'prosze') as 0;
    const base = effectiveSkill(s, i);
    expect(s.player.level).toBe(1); // § 3 opens at level 15 by level alone
    wearUnique(s, 'oczekiwanie');
    expect(paragraphAt(s, i)).toBe(3);
    const worn = effectiveSkill(s, i);
    expect(worn.cooldown).toBeGreaterThan(base.cooldown);
    expect(worn.type).toBe('egzystencjalny');
    expect(patchAt(s, i)).toEqual(heroById(owner).paragraphs['prosze']?.list[2]?.patch);
    unequipSlot(s.player, 'przyrzad');
    expect(paragraphAt(s, i)).toBe(1);
    expect(effectiveSkill(s, i).cooldown).toBe(base.cooldown);
  });

  it('yields to a higher paragraph the character chose itself', () => {
    const owner = ownerOf('pralnia'); // pranieWstepne §2
    const s = createRun(5, { heroId: owner });
    const i = skillIndexOf(owner, 'pranieWstepne') as 1;
    s.hero.para = [1, 3, 1, 1, 1];
    s.hero.patch = [undefined, heroById(owner).paragraphs['pranieWstepne']?.list[2]?.patch, undefined, undefined, undefined];
    wearUnique(s, 'pralnia');
    expect(paragraphAt(s, i)).toBe(3);
    expect(patchAt(s, i)).toEqual(s.hero.patch[1]);
  });

  it('a carried paragraph and the cast capstone apply together, during the cast only', () => {
    const owner = ownerOf('program95'); // wirowanie §3
    const s = createRun(5, { heroId: owner });
    const i = skillIndexOf(owner, 'wirowanie') as 0;
    s.hero.pads = [0, 1, 2];
    s.hero.spec = 'pralnia'; // its capstone is on wirowanie
    wearUnique(s, 'program95');
    const carried = heroById(owner).paragraphs['wirowanie']?.list[2]?.patch;
    const cap = runCapstone(s);
    if (!carried || !cap) throw new Error('setup');
    let seen: unknown = null;
    const bus = createBus();
    bus.on('skill:cast', () => {
      seen = patchAt(s, i);
    });
    expect(castSkill(s, bus, 0)).toBe(true);
    expect(seen).toEqual(mergeCapstone(carried, cap.capstone.patch));
    expect(patchAt(s, i)).toEqual(carried); // the capstone is gone after the cast, the carried paragraph stays
  });

  it('lays on top of the cast capstone the way a capstone does', () => {
    expect(layPatch({ dur: 2, cd: 1 }, { dur: 1.5, cd: -2, count: 1 })).toEqual({ dur: 3, cd: -1, count: 1 });
    expect(layPatch(undefined, { reach: 1.3 })).toEqual({ reach: 1.3 });
  });
});

describe('set patches on skills (three pieces)', () => {
  it('«Ostatnia mila» lengthens the mobility skill of the hero that has it; «Infolinia» strengthens its one skill', () => {
    const s = createRun(5, { heroId: heroOfSkill('odwirowanie') ?? 'pralka' });
    const i = skillIndexOf(s.player.heroId, 'odwirowanie') as 2;
    expect(patchAt(s, i)).toBeUndefined();
    wearSet(s, 'ostatnia-mila');
    expect(patchAt(s, i)?.reach).toBe(1.3);
    const j = skillIndexOf(s.player.heroId, 'wirowanie') as 0;
    expect(patchAt(s, j)).toBeUndefined();
    unequipSlot(s.player, 'nakrycie');
    expect(patchAt(s, i)).toBeUndefined();
    const t2 = createRun(5, { heroId: heroOfSkill('wirowanie') ?? 'pralka' });
    wearSet(t2, 'infolinia');
    expect(patchAt(t2, j)?.area).toBe(1.5);
  });

  it('two pieces lay no patch', () => {
    const s = createRun(5, { heroId: 'pralka' });
    const item = makeSetPiece(createRng(1), 'ostatnia-mila', 5, 0);
    if (!item) throw new Error('piece');
    s.player.inventory.push(item);
    equipItem(s.player, item);
    expect(patchAt(s, 2)).toBeUndefined();
  });
});

describe('«Awaria»: the rule of the hero doubles', () => {
  it('Konsultant trials go from 2 to 3', () => {
    const s = createRun(5, { heroId: 'konsultant' });
    expect(trialMultiplier(s.player)).toBe(2);
    wearSet(s, 'awaria');
    expect(trialMultiplier(s.player)).toBe(3);
    const other = createRun(5, { heroId: 'pralka' });
    wearSet(other, 'awaria');
    expect(trialMultiplier(other.player)).toBe(1);
  });

  it('Pralka errors every 5th hit instead of every 10th', () => {
    const fires = (set: boolean): number => {
      const s = createRun(7, { heroId: 'pralka' });
      if (set) wearSet(s, 'awaria');
      s.status = 'running';
      const bus = createBus();
      let n = 0;
      bus.on('footnote', () => n++);
      for (let k = 0; k < 20; k++) pralkaQuirk.onHit?.(s, bus);
      return n;
    };
    expect(fires(false)).toBe(2);
    expect(fires(true)).toBe(4);
  });

  it('the Petlowiec copy stays 20 s', () => {
    const s = createRun(4, { heroId: 'petlowiec' });
    wearSet(s, 'awaria');
    s.status = 'dead';
    applyPetla(s, createBus());
    expect(s.summons.find((m) => m.variant === 'ghost')?.ttl).toBe(20);
  });

  it('Naleśnik lies flat from 80% and rounds up below half', () => {
    const s = createRun(4, { heroId: 'nalesnik' });
    s.player.hp = s.player.hpMax * 0.85;
    expect(projectileDamageMul(s.player)).toBe(1);
    wearSet(s, 'awaria');
    s.player.hp = Math.min(s.player.hp, s.player.hpMax * 0.85);
    expect(projectileDamageMul(s.player)).toBe(0.7);
    s.player.hp = s.player.hpMax * 0.45;
    s.time = 100;
    s.hero.roundReadyAt = 0;
    nalesnikQuirk.tick?.(s, createBus());
    expect(s.player.round).toBe(true);
  });
});
