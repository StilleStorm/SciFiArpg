import { describe, expect, it } from 'vitest';
import { createBus } from '../core/events';
import { fillDemoInventory } from '../items/demo';
import { applyUpgrade, gainXp, MAX_LEVEL } from '../progression';
import { createRun, type RunState } from '../world/run';
import { applyCharacter, emptyCharacter, highestNumber, serializeCharacter, toCharacter } from './character';
import { SAVE_KEY, SAVE_VERSION, defaultMeta, loadMeta, migrate, saveMeta } from './save';

function memory(initial?: string) {
  const m = new Map<string, string>();
  if (initial !== undefined) m.set(SAVE_KEY, initial);
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

/** A hero who has played: gear, a purse, permissions, several levels and updates of every kind. */
function veteran(heroId: 'pralka' | 'konsultant' = 'konsultant'): RunState {
  const s = createRun(5, { heroId });
  fillDemoInventory(s.player);
  s.player.gwiazdki = 33;
  s.player.permissions.push('urzadzenia', 'powiadomienia');
  s.nextItemNumber = 40;
  gainXp(s, createBus(), 420);
  for (const id of ['skill1', 'skill1', 'skill1', 'skill2', 'racja', 'racja', 'pewnosc', 'upor', 'resist_mechaniczny', 'trial', 'gwiazdki', 'passive1', 'passive3']) {
    applyUpgrade(s, id);
  }
  s.hero.pendingLevels = 2;
  return s;
}

describe('the character record', () => {
  it('round-trips through JSON and gives the same stats after recomputeStats', () => {
    const a = veteran();
    expect(a.player.level).toBeGreaterThan(3);
    const saved = JSON.parse(JSON.stringify(serializeCharacter(a)));
    const c = toCharacter(saved);
    expect(c).not.toBeNull();
    if (!c) return;
    const b = createRun(99, { heroId: 'konsultant', character: c });
    expect(b.player.stats).toEqual(a.player.stats);
    expect(b.player.hpMax).toBe(a.player.hpMax);
    expect(b.player.hp).toBe(b.player.hpMax);
    expect(b.player.speed).toBe(a.player.speed);
    expect(b.player.trialSpeed).toBe(a.player.trialSpeed);
    expect(b.player.damageType).toBe(a.player.damageType);
    expect(b.player.attackRange).toBe(a.player.attackRange);
    expect(b.player.attackCooldown).toBe(a.player.attackCooldown);
    expect(b.player.level).toBe(a.player.level);
    expect(b.player.xp).toBe(a.player.xp);
    expect(b.player.gwiazdki).toBe(33);
    expect(b.player.permissions).toEqual(a.player.permissions);
    expect(b.player.equipment).toEqual(a.player.equipment);
    expect(b.player.inventory).toEqual(a.player.inventory);
    expect(b.hero.upgrades).toEqual(a.hero.upgrades);
    expect(b.hero.ranks).toEqual(a.hero.ranks);
    expect(b.hero.mods).toEqual(a.hero.mods);
    expect(b.hero.bonus).toEqual(a.hero.bonus);
    expect(b.hero.pendingLevels).toBe(2);
    // the next plate continues after the highest number carried, never below what the run already counts
    expect(b.nextItemNumber).toBeGreaterThan(highestNumber(c));
  });

  it('level, reputacja and updates now persist between runs, racja starts full', () => {
    const a = veteran('pralka');
    a.player.hp = 1;
    const meta = { ...defaultMeta(), character: serializeCharacter(a) };
    const store = memory();
    saveMeta(meta, store);
    const b = createRun(7, { heroId: 'pralka', character: loadMeta(store).character });
    expect(b.player.level).toBe(a.player.level);
    expect(b.hero.upgrades['skill1']).toBe(3);
    expect(b.player.hp).toBe(b.player.hpMax);
  });

  it('a different hero keeps the bag, the gear and the purse, but not the level or the updates', () => {
    const a = veteran('konsultant');
    const b = createRun(8, { heroId: 'kartograf', character: serializeCharacter(a) });
    expect(b.player.level).toBe(1);
    expect(b.hero.upgrades).toEqual({});
    expect(b.player.permissions).toEqual([]);
    expect(b.player.gwiazdki).toBe(33);
    expect(b.player.inventory).toHaveLength(a.player.inventory.length);
    expect(Object.keys(b.player.equipment)).toEqual(Object.keys(a.player.equipment));
  });

  it('applying a hand-made or damaged record never throws', () => {
    const s = createRun(1);
    const bad = toCharacter({ heroId: 'pralka', level: 9999, xp: -4, upgrades: { nonsense: 3, skill1: 99, racja: 'x' }, permissions: [1, 'urzadzenia'], inventory: [1, null, { uid: 1 }], equipment: { zly: {} } });
    expect(bad).not.toBeNull();
    if (!bad) return;
    expect(() => applyCharacter(s, bad)).not.toThrow();
    expect(s.player.level).toBe(MAX_LEVEL);
    expect(s.hero.upgrades['nonsense']).toBeUndefined();
    expect(s.hero.upgrades['skill1']).toBeLessThanOrEqual(3);
    expect(toCharacter(null)).toBeNull();
    expect(toCharacter({ heroId: 'nobody' })).toBeNull();
  });
});

describe('migration from the stash', () => {
  const item = { uid: 1, number: 12 };
  const old = { version: 1, heroId: 'pralka', stamps: 2, runsCompleted: 3, gwiazdki: 12, history: [], settings: { theme: 'day', leftHanded: false }, stash: { inventory: [item], equipment: { bron: { uid: 2, number: 20 } } } };

  it('folds the stash and the top-level gwiazdki into one character and drops both', () => {
    const m = migrate(old);
    expect(m.version).toBe(SAVE_VERSION);
    expect(m['stash']).toBeUndefined();
    expect(m['gwiazdki']).toBeUndefined();
    expect(m.character?.heroId).toBe('pralka');
    expect(m.character?.gwiazdki).toBe(12);
    expect(m.character?.inventory).toHaveLength(1);
    expect(m.character?.equipment.bron).toMatchObject({ uid: 2 });
    expect(m.character?.level).toBe(1);
    expect(m.runsCompleted).toBe(3);
    expect(highestNumber(m.character ?? emptyCharacter())).toBe(20);
  });

  it('an old save with gwiazdki but no stash still keeps the purse; one with neither makes no character', () => {
    expect(migrate({ ...old, stash: undefined }).character?.gwiazdki).toBe(12);
    expect(migrate({ version: 1, history: [], settings: {} }).character).toBeUndefined();
  });

  it('is stable: migrating a migrated save changes nothing', () => {
    const once = migrate(old);
    expect(migrate(JSON.parse(JSON.stringify(once)))).toEqual(once);
  });
});
