import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { effectiveResist, hitChance, rollDamage, type Attacker, type Defender } from './damage';

const att: Attacker = { pewnoscSiebie: 100, dmgMin: 4, dmgMax: 8, critChance: 0 };
const def: Defender = { upor: 100, resist: {} };

describe('hitChance', () => {
  it('is 95 percent at parity and clamps at both ends', () => {
    expect(hitChance(100, 100)).toBe(0.95);
    expect(hitChance(50, 100)).toBeCloseTo(2 / 3);
    expect(hitChance(1, 10000)).toBe(0.05);
    expect(hitChance(0, 0)).toBe(0.95);
  });
});

describe('effectiveResist', () => {
  it('caps at 75 and allows weakness', () => {
    expect(effectiveResist({ upor: 0, resist: { mechaniczny: 90 } }, 'mechaniczny')).toBe(75);
    expect(effectiveResist({ upor: 0, resist: { mechaniczny: -30 } }, 'mechaniczny')).toBe(-30);
    expect(effectiveResist({ upor: 0, resist: {} }, 'egzystencjalny')).toBe(0);
  });
});

describe('rollDamage', () => {
  it('stays inside min..max when it hits and never crits at 0 chance', () => {
    const rng = createRng(1);
    let hits = 0;
    for (let i = 0; i < 500; i++) {
      const r = rollDamage({ ...att, pewnoscSiebie: 1000 }, def, 'mechaniczny', rng);
      if (!r.hit) continue;
      hits++;
      expect(r.crit).toBe(false);
      expect(r.amount).toBeGreaterThanOrEqual(4);
      expect(r.amount).toBeLessThanOrEqual(8);
    }
    expect(hits).toBeGreaterThan(400);
  });
  it('doubles on a crit', () => {
    const rng = createRng(2);
    for (let i = 0; i < 200; i++) {
      const r = rollDamage({ ...att, pewnoscSiebie: 1000, critChance: 1 }, def, 'mechaniczny', rng);
      if (!r.hit) continue;
      expect(r.crit).toBe(true);
      expect(r.amount).toBeGreaterThanOrEqual(8);
      expect(r.amount).toBeLessThanOrEqual(16);
    }
  });
  it('applies resist (capped at 75) and deals at least 1', () => {
    const rng = createRng(3);
    const tough: Defender = { upor: 0, resist: { regulaminowy: 200 } };
    for (let i = 0; i < 100; i++) {
      const r = rollDamage({ ...att, pewnoscSiebie: 1000, dmgMin: 8, dmgMax: 8 }, tough, 'regulaminowy', rng);
      if (r.hit) expect(r.amount).toBe(2);
    }
    const lone = rollDamage({ ...att, pewnoscSiebie: 1000, dmgMin: 1, dmgMax: 1 }, tough, 'regulaminowy', createRng(4));
    if (lone.hit) expect(lone.amount).toBe(1);
  });
  it('misses deal nothing and are reproducible from a seed', () => {
    const weak: Attacker = { ...att, pewnoscSiebie: 1 };
    const strong: Defender = { upor: 100000, resist: {} };
    const a = rollDamage(weak, strong, 'mechaniczny', createRng(11));
    const b = rollDamage(weak, strong, 'mechaniczny', createRng(11));
    expect(a).toEqual(b);
    const results = Array.from({ length: 50 }, (_, i) => rollDamage(weak, strong, 'mechaniczny', createRng(i)));
    expect(results.some((r) => !r.hit && r.amount === 0)).toBe(true);
  });
});
