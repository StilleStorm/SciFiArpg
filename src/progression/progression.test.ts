import { describe, expect, it } from 'vitest';
import { createBus } from '../core/events';
import { createRun, type RunState } from '../world/run';
import type { HeroId } from '../heroes';
import { applyUpgrade, availableEntries, confirmUpdate, entryView, openOffer, poolFor, reroll, requirementOf, rollOffer, upgradeById } from './update';
import { gainXp, xpForKill, xpToNext, xpTotalFor } from './xp';

const run = (heroId: HeroId = 'pralka', seed = 3): RunState => createRun(seed, { heroId });

describe('level curve', () => {
  it('starts at 30 and always rises', () => {
    expect(xpToNext(1)).toBe(30);
    for (let l = 1; l < 40; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
    expect(xpTotalFor(3)).toBe(xpToNext(1) + xpToNext(2));
  });

  it('elites and bosses are worth more than the common', () => {
    expect(xpForKill('elite')).toBeGreaterThan(xpForKill('common'));
    expect(xpForKill('boss')).toBeGreaterThan(xpForKill('elite'));
    expect(xpForKill(undefined)).toBe(xpForKill('common'));
  });

  it('gainXp levels up, carries the remainder, grows racja and emits one event per level', () => {
    const s = run();
    const bus = createBus();
    const levels: number[] = [];
    bus.on('player:levelup', (e) => levels.push(e.level));
    const hp0 = s.player.hpMax;
    expect(gainXp(s, bus, 10)).toBe(0);
    expect(s.player.level).toBe(1);
    expect(gainXp(s, bus, 20)).toBe(1);
    expect(s.player.level).toBe(2);
    expect(s.player.xp).toBe(0);
    expect(s.player.hpMax).toBeGreaterThan(hp0);
    expect(gainXp(s, bus, xpToNext(2) + xpToNext(3) + 5)).toBe(2);
    expect(s.player.level).toBe(4);
    expect(s.player.xp).toBe(5);
    expect(levels).toEqual([2, 3, 4]);
  });
});

describe('the upgrade pool', () => {
  it.each(['pralka', 'konsultant', 'petlowiec', 'kartograf'] as const)('%s: 5 skills x 3 ranks, 6 passives and stat upgrades', (id) => {
    const pool = poolFor(id);
    const skills = pool.filter((u) => u.kind === 'skill');
    expect(skills).toHaveLength(5);
    expect(skills.every((u) => u.maxRank === 3)).toBe(true);
    expect(pool.filter((u) => u.kind === 'passive')).toHaveLength(6);
    expect(pool.filter((u) => u.kind === 'stat').length).toBeGreaterThanOrEqual(6);
    expect(new Set(pool.map((u) => u.id)).size).toBe(pool.length);
  });
});

describe('update entries', () => {
  it('offers three distinct entries, at most one of them gated, the same for the same seed and level', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const s = run('pralka', seed);
      const offer = rollOffer(s, 0);
      expect(offer.entries).toHaveLength(3);
      expect(new Set(offer.entries.map((e) => e.id)).size).toBe(3);
      const gated = offer.entries.filter((e) => {
        const def = upgradeById('pralka', e.id);
        return def !== undefined && requirementOf(def, e.rank) !== undefined;
      });
      expect(gated.length).toBeLessThanOrEqual(1);
      expect(rollOffer(run('pralka', seed), 0)).toEqual(offer);
    }
  });

  it('without a permission a gated entry is shown but locked and cannot be taken', () => {
    let found = 0;
    for (let seed = 1; seed <= 400 && found < 5; seed++) {
      const s = run('konsultant', seed);
      s.hero.upgrades['passive6'] = 0;
      const offer = openOffer(s);
      const gated = offer.entries.find((e) => e.id === 'passive6');
      if (!gated) continue;
      found++;
      expect(gated.locked).toBe(true);
      const view = entryView(s, gated);
      expect(view.locked).toBe(true);
      expect(view.requires).toContain('powiadomienia');
      expect(confirmUpdate(s, 'passive6')).toBe(false);
      expect(s.hero.upgrades['passive6']).toBeFalsy();
      expect(s.hero.offer).not.toBeNull();
    }
    expect(found).toBeGreaterThan(0);
  });

  it('with the permission the same entry is unlocked and installs', () => {
    let tried = 0;
    for (let seed = 1; seed <= 400 && tried < 3; seed++) {
      const s = run('konsultant', seed);
      s.player.permissions.push('powiadomienia');
      const offer = openOffer(s);
      const gated = offer.entries.find((e) => e.id === 'passive6');
      if (!gated) continue;
      tried++;
      expect(gated.locked).toBe(false);
      expect(entryView(s, gated).locked).toBe(false);
      const dmg = s.hero.mods.dmg;
      expect(confirmUpdate(s, 'passive6')).toBe(true);
      expect(s.hero.mods.dmg).toBeGreaterThan(dmg);
      expect(s.hero.offer).toBeNull();
    }
    expect(tried).toBeGreaterThan(0);
  });

  it('a permission given while the form is open unlocks the entry', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const s = run('kartograf', seed);
      const offer = openOffer(s);
      const gated = offer.entries.find((e) => e.id === 'passive6');
      if (!gated) continue;
      expect(entryView(s, gated).locked).toBe(true);
      s.player.permissions.push('urzadzenia');
      expect(entryView(s, gated).locked).toBe(false);
      expect(confirmUpdate(s, 'passive6')).toBe(true);
      return;
    }
    throw new Error('no seed offered the gated passive');
  });

  it('skill ranks go in order and rank 3 needs the permission of its family', () => {
    const s = run('pralka');
    expect(applyUpgrade(s, 'skill1')).toBe(true);
    expect(applyUpgrade(s, 'skill1')).toBe(true);
    expect(s.hero.ranks[0]).toBe(2);
    expect(applyUpgrade(s, 'skill1')).toBe(false);
    expect(s.hero.ranks[0]).toBe(2);
    s.player.permissions.push('urzadzenia');
    expect(applyUpgrade(s, 'skill1')).toBe(true);
    expect(s.hero.ranks[0]).toBe(3);
    expect(applyUpgrade(s, 'skill1')).toBe(false);
    expect(availableEntries(s).some((e) => e.id === 'skill1')).toBe(false);
  });

  it('stat upgrades change the player', () => {
    const s = run('pralka');
    const hp = s.player.hpMax;
    const up = s.player.stats.upor;
    const res = s.player.stats.resist.egzystencjalny ?? 0;
    expect(applyUpgrade(s, 'racja')).toBe(true);
    expect(applyUpgrade(s, 'upor')).toBe(true);
    expect(applyUpgrade(s, 'resist_egzystencjalny')).toBe(true);
    expect(s.player.hpMax).toBe(hp + 12);
    expect(s.player.stats.upor).toBe(up + 8);
    expect(s.player.stats.resist.egzystencjalny).toBe(res + 8);
    const trial = s.player.trialSpeed;
    applyUpgrade(s, 'trial');
    expect(s.player.trialSpeed).toBe(trial + 0.5);
    applyUpgrade(s, 'gwiazdki');
    expect(s.hero.mods.gwiazdki).toBe(1);
  });

  it('every entry has text in the language file', () => {
    const s = run('petlowiec');
    for (const def of poolFor('petlowiec')) {
      const v = entryView(s, { id: def.id, rank: 1, locked: false });
      expect(v.title).not.toContain('forms.');
      expect(v.desc).not.toContain('forms.');
      expect(v.title.length).toBeGreaterThan(2);
    }
  });
});

describe('zglos problem z aktualizacja', () => {
  it('rerolls the three entries once per run', () => {
    const s = run('pralka', 9);
    const first = openOffer(s);
    const second = reroll(s);
    expect(second).not.toBeNull();
    expect(second?.entries).toHaveLength(3);
    const overlap = second?.entries.filter((e) => first.entries.some((f) => f.id === e.id)) ?? [];
    expect(overlap).toHaveLength(0);
    expect(s.hero.rerollUsed).toBe(true);
    expect(s.hero.offer).toEqual(second);
    // a second report, even at the next level, is refused
    s.player.level = 3;
    openOffer(s);
    expect(reroll(s)).toBeNull();
  });

  it('is refused when no form is open', () => {
    expect(reroll(run())).toBeNull();
  });
});
