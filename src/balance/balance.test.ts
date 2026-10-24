import { describe, expect, it } from 'vitest';
import { PRIORITIES, PRIORITY_IDS, enemyScaleFor } from '../world/campaign';
import { DROPS, DROP_TIER_WEIGHTS, PRIORITY_STAR_MUL, QUEST_STARS, TIER_BUDGET, TIER_PRICE_MUL } from './loot';
import { HEAL_SHARE, POTWIERDZENIE_DROP } from './recovery';
import { METER_KILL, METER_KILL_BOSS, METER_KILL_ELITE, METER_REBUTTAL, METER_SPOR } from './meter';
import { PRIORITY_ROWS } from './campaign';
import { AUTO_FLOOR, VACUUM_RADIUS } from '../systems/recovery';
import { killFill } from '../combat/meter';

/** Shape checks on the numbers a balance pass changes: whatever the tuning, these orderings are the game's meaning. */
describe('balance numbers keep their order', () => {
  it('the game files read the numbers from the balance files', () => {
    expect(PRIORITIES.normalny.xp).toBe(PRIORITY_ROWS.normalny[4]);
    expect(PRIORITIES.krytyczny.hp).toBe(PRIORITY_ROWS.krytyczny[0]);
    expect(VACUUM_RADIUS).toBeGreaterThan(0);
    expect(killFill('elite')).toBe(METER_KILL_ELITE);
  });
  it('priorities rise: hp, damage, xp, stars, loot, item level', () => {
    for (let i = 1; i < PRIORITY_IDS.length; i++) {
      const a = PRIORITIES[PRIORITY_IDS[i - 1] ?? 'niski'];
      const b = PRIORITIES[PRIORITY_IDS[i] ?? 'niski'];
      expect(b.hp).toBeGreaterThan(a.hp);
      expect(b.dmg).toBeGreaterThan(a.dmg);
      expect(b.xp).toBeGreaterThanOrEqual(a.xp);
      expect(b.stars).toBeGreaterThan(a.stars);
      expect(b.ilvl).toBeGreaterThan(a.ilvl);
    }
    expect(PRIORITY_STAR_MUL.krytyczny).toBeGreaterThan(PRIORITY_STAR_MUL.normalny);
  });
  it('enemies grow with the planet and never shrink', () => {
    for (let p = 1; p < 9; p++) {
      expect(enemyScaleFor(p, 'normalny').hp).toBeGreaterThan(enemyScaleFor(p - 1, 'normalny').hp);
      expect(enemyScaleFor(p, 'normalny').dmg).toBeGreaterThan(enemyScaleFor(p - 1, 'normalny').dmg);
    }
  });
  it('drops: tier weights sum to 100, ranks give more than the rank below', () => {
    for (const w of Object.values(DROP_TIER_WEIGHTS)) expect(w.reduce((a, b) => a + b, 0)).toBe(100);
    expect(DROPS.elite.starMin).toBeGreaterThan(DROPS.common.starMax);
    expect(DROPS.boss.starMin).toBeGreaterThan(DROPS.elite.starMax);
    expect(POTWIERDZENIE_DROP.common).toBeLessThan(POTWIERDZENIE_DROP.elite);
    expect(POTWIERDZENIE_DROP.elite).toBeLessThan(POTWIERDZENIE_DROP.boss);
    expect(POTWIERDZENIE_DROP.boss).toBeLessThanOrEqual(1);
  });
  it('items: a higher tier is worth more and costs more', () => {
    expect(TIER_BUDGET.nietypowy).toBeGreaterThan(TIER_BUDGET.zwykly);
    expect(TIER_BUDGET.rzadki).toBeGreaterThan(TIER_BUDGET.nietypowy);
    expect(TIER_PRICE_MUL.rzadki).toBeGreaterThan(TIER_PRICE_MUL.nietypowy);
    expect(QUEST_STARS.base).toBeGreaterThan(0);
  });
  it('recovery: a slip heals a part, the auto-use floor is below it', () => {
    expect(HEAL_SHARE).toBeGreaterThan(0);
    expect(HEAL_SHARE).toBeLessThan(1);
    expect(AUTO_FLOOR).toBeLessThan(HEAL_SHARE);
  });
  it('meter: a rebuttal beats a kill, a boss kill beats an elite, a right reply is the biggest step', () => {
    expect(METER_REBUTTAL).toBeGreaterThan(METER_KILL);
    expect(METER_KILL_ELITE).toBeGreaterThan(METER_KILL);
    expect(METER_KILL_BOSS).toBeGreaterThan(METER_KILL_ELITE);
    expect(METER_SPOR).toBeGreaterThan(METER_KILL_BOSS);
  });
});
