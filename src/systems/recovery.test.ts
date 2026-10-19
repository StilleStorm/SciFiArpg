import { describe, expect, it } from 'vitest';
import { createBus } from '../core/events';
import { createPotwierdzeniePickup } from '../entities/factory';
import { serializeCharacter, toCharacter, applyCharacter } from '../save/character';
import { createRun, nextId, type RunState } from '../world/run';
import { applyDamage } from './combat';
import { dropLoot, takePickup, updateLoot } from './loot';
import { AUTO_FLOOR, HELD_CAP, POTWIERDZENIE_DROP, REGEN_DELAY, VACUUM_RADIUS, heldOf, useHeld } from './recovery';

function setup(seed = 1): { s: RunState; bus: ReturnType<typeof createBus> } {
  const s = createRun(seed);
  s.enemies.length = 0;
  s.pickups.length = 0;
  s.phase = 'run';
  return { s, bus: createBus() };
}
const slip = (s: RunState, dx = 0) => {
  const k = createPotwierdzeniePickup(nextId(s), s.player.x + dx, s.player.y);
  s.pickups.push(k);
  return k;
};

describe('taking a potwierdzenie', () => {
  it('restores 25% of max racja at once when racja is not full', () => {
    const { s, bus } = setup();
    s.player.hp = 10;
    expect(takePickup(s, bus, slip(s))).toBe(true);
    expect(s.player.hp).toBe(10 + Math.round(s.player.hpMax * 0.25));
    expect(heldOf(s.player)).toBe(0);
  });
  it('never heals past the maximum', () => {
    const { s, bus } = setup();
    s.player.hp = s.player.hpMax - 3;
    takePickup(s, bus, slip(s));
    expect(s.player.hp).toBe(s.player.hpMax);
    expect(heldOf(s.player)).toBe(0);
  });
  it('is kept when racja is full, up to five, and stays on the ground after that', () => {
    const { s, bus } = setup();
    for (let i = 1; i <= HELD_CAP; i++) {
      expect(takePickup(s, bus, slip(s))).toBe(true);
      expect(heldOf(s.player)).toBe(i);
    }
    expect(takePickup(s, bus, slip(s))).toBe(false);
    expect(heldOf(s.player)).toBe(HELD_CAP);
  });
  it('a full stack still heals when racja is not full', () => {
    const { s, bus } = setup();
    s.player.potwierdzenia = HELD_CAP;
    s.player.hp = 5;
    expect(takePickup(s, bus, slip(s))).toBe(true);
    expect(s.player.hp).toBeGreaterThan(5);
    expect(heldOf(s.player)).toBe(HELD_CAP);
  });
});

describe('the vacuum', () => {
  it('pulls a slip inside 90 units toward the player, and leaves one outside', () => {
    const { s, bus } = setup();
    s.player.hp = 5;
    const near = slip(s, 80);
    const far = slip(s, 200);
    updateLoot(s, bus, 0.1);
    expect(near.x).toBeLessThan(s.player.x + 80);
    expect(far.x).toBe(s.player.x + 200);
    expect(VACUUM_RADIUS).toBe(90);
  });
  it('does not pull a slip that cannot be taken (racja full, five held)', () => {
    const { s, bus } = setup();
    s.player.potwierdzenia = HELD_CAP;
    const k = slip(s, 50);
    updateLoot(s, bus, 0.1);
    expect(k.x).toBe(s.player.x + 50);
  });
});

describe('using a held slip', () => {
  it('a tap uses one and heals 25%; nothing happens when none is held or racja is full', () => {
    const { s, bus } = setup();
    expect(useHeld(s, bus)).toBe(false);
    s.player.potwierdzenia = 2;
    expect(useHeld(s, bus)).toBe(false); // full
    s.player.hp = 8;
    expect(useHeld(s, bus)).toBe(true);
    expect(heldOf(s.player)).toBe(1);
    expect(s.player.hp).toBe(8 + Math.round(s.player.hpMax * 0.25));
  });
  it('auto-uses before a blow that would leave under 15%, with a footnote, and heals first', () => {
    const { s, bus } = setup();
    const notes: string[] = [];
    bus.on('footnote', (e) => notes.push(e.text));
    const max = s.player.hpMax;
    s.player.potwierdzenia = 2;
    s.player.hp = Math.round(max * 0.4);
    const before = s.player.hp;
    const blow = Math.ceil(max * 0.3); // would leave 10%
    applyDamage(s, bus, s.player, blow, false);
    expect(heldOf(s.player)).toBe(1);
    expect(s.player.hp).toBe(before + Math.round(max * 0.25) - blow);
    expect(notes).toHaveLength(1);
  });
  it('auto-uses at full racja too: the slip is measured against the racja after the blow', () => {
    const { s, bus } = setup();
    const max = s.player.hpMax;
    s.player.potwierdzenia = 3;
    s.player.hp = max;
    const blow = Math.round(max * 0.9); // would leave 10%
    applyDamage(s, bus, s.player, blow, false);
    expect(heldOf(s.player)).toBe(2);
    expect(s.player.hp).toBe(max - blow + Math.round(max * 0.25));
    expect(s.player.hp).toBeLessThanOrEqual(max);
  });
  it('does not auto-use when the blow leaves 15% or more, or when none is held', () => {
    const { s, bus } = setup();
    s.player.potwierdzenia = 1;
    s.player.hp = s.player.hpMax;
    applyDamage(s, bus, s.player, 5, false);
    expect(heldOf(s.player)).toBe(1);
    s.player.potwierdzenia = 0;
    s.player.hp = Math.round(s.player.hpMax * 0.2);
    applyDamage(s, bus, s.player, 3, false);
    expect(s.player.hp).toBe(Math.round(s.player.hpMax * 0.2) - 3);
    expect(AUTO_FLOOR).toBe(0.15);
  });
});

describe('regeneration', () => {
  it('waits 4 s after a blow, then restores 2% of max per second', () => {
    const { s, bus } = setup();
    const max = s.player.hpMax;
    s.player.hp = max / 2;
    s.time = 10;
    applyDamage(s, bus, s.player, 1, false);
    const start = s.player.hp;
    s.time = 10 + REGEN_DELAY - 0.5;
    updateLoot(s, bus, 1);
    expect(s.player.hp).toBe(start);
    s.time = 10 + REGEN_DELAY + 0.1;
    updateLoot(s, bus, 1);
    expect(s.player.hp).toBeCloseTo(start + max * 0.02, 5);
  });
  it('never exceeds the maximum and does not run for the dead', () => {
    const { s, bus } = setup();
    s.player.hp = s.player.hpMax - 0.1;
    s.time = 100;
    updateLoot(s, bus, 5);
    expect(s.player.hp).toBe(s.player.hpMax);
    s.player.hp = 0;
    updateLoot(s, bus, 5);
    expect(s.player.hp).toBe(0);
  });
});

describe('drops and the save', () => {
  it('drop chances follow the table: common about 10%, bosses always', () => {
    const { s } = setup(3);
    let n = 0;
    const runs = 3000;
    for (let i = 0; i < runs; i++) {
      s.pickups.length = 0;
      dropLoot(s, 0, 0, 'common');
      if (s.pickups.some((k) => k.potwierdzenie)) n++;
    }
    expect(n / runs).toBeGreaterThan(POTWIERDZENIE_DROP.common - 0.03);
    expect(n / runs).toBeLessThan(POTWIERDZENIE_DROP.common + 0.03);
    s.pickups.length = 0;
    dropLoot(s, 0, 0, 'boss');
    expect(s.pickups.filter((k) => k.potwierdzenie)).toHaveLength(1);
  });
  it('the held count is saved with the character, capped at five, and old saves load without it', () => {
    const { s } = setup(4);
    s.player.potwierdzenia = 3;
    const c = serializeCharacter(s);
    expect(c.potwierdzenia).toBe(3);
    const back = toCharacter(JSON.parse(JSON.stringify(c)));
    expect(back?.potwierdzenia).toBe(3);
    expect(toCharacter({ ...c, potwierdzenia: 99 })?.potwierdzenia).toBe(HELD_CAP);
    const { potwierdzenia: _gone, ...old } = c;
    expect(toCharacter(old)?.potwierdzenia).toBeUndefined();
    const fresh = setup(4).s;
    applyCharacter(fresh, back ?? c);
    expect(heldOf(fresh.player)).toBe(3);
    s.player.potwierdzenia = 0;
    expect(serializeCharacter(s).potwierdzenia).toBeUndefined();
  });
});
