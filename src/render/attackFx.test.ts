import { describe, expect, it } from 'vitest';
import {
  ENEMY_MELEE_MS,
  ENEMY_RANGED_MS,
  HERO_ATTACK_MS,
  KICK,
  LUNGE,
  LURCH,
  THROW_DEG,
  WIND_UP,
  aimOf,
  attackAt,
  beginAttack,
  enemyOffset,
  heroPose,
  keyframes,
  measureSegment,
  measureStart,
  whipPath,
} from './attackFx';

const fakeFigure = (): SVGGElement => ({}) as unknown as SVGGElement;

describe('keyframes', () => {
  it('passes through its keys and holds outside them', () => {
    const keys = [[0, 0], [0.5, 10], [1, 0]] as const;
    expect(keyframes(-1, keys)).toBe(0);
    expect(keyframes(0.5, keys)).toBeCloseTo(10, 6);
    expect(keyframes(1, keys)).toBe(0);
    expect(keyframes(2, keys)).toBe(0);
    expect(keyframes(0.25, keys)).toBeGreaterThan(0);
    expect(keyframes(0.25, keys)).toBeLessThan(10);
  });
});

describe('enemy melee offset', () => {
  it('leans back 6, lunges 12 forward and is home after 220 ms', () => {
    expect(enemyOffset(0, false)).toBe(0);
    expect(enemyOffset(120, false)).toBeCloseTo(-WIND_UP, 6);
    expect(enemyOffset(170, false)).toBeCloseTo(LUNGE, 6);
    expect(enemyOffset(ENEMY_MELEE_MS, false)).toBe(0);
    expect(enemyOffset(500, false)).toBe(0);
    let lo = 0;
    let hi = 0;
    for (let t = 0; t <= ENEMY_MELEE_MS; t++) {
      const o = enemyOffset(t, false);
      lo = Math.min(lo, o);
      hi = Math.max(hi, o);
    }
    expect(lo).toBeGreaterThanOrEqual(-WIND_UP - 1e-9);
    expect(hi).toBeLessThanOrEqual(LUNGE + 1e-9);
  });

  it('winds up for 120 ms before the lunge starts', () => {
    for (let t = 1; t < 120; t++) expect(enemyOffset(t, false)).toBeLessThan(0);
    expect(enemyOffset(160, false)).toBeGreaterThan(0);
  });

  it('a ranged enemy only recoils, and is home after 140 ms', () => {
    expect(enemyOffset(70, true)).toBeCloseTo(-4, 6);
    for (let t = 0; t <= ENEMY_RANGED_MS; t++) expect(enemyOffset(t, true)).toBeLessThanOrEqual(0);
    expect(enemyOffset(ENEMY_RANGED_MS, true)).toBe(0);
  });
});

describe('hero poses', () => {
  it('Pralka lurches 10 over 180 ms, turns the drum 180 degrees and swings the door', () => {
    expect(HERO_ATTACK_MS.pralka).toBeGreaterThanOrEqual(180);
    expect(heroPose('pralka', 0).lurch).toBe(0);
    expect(heroPose('pralka', 90).lurch).toBeCloseTo(LURCH, 6);
    expect(heroPose('pralka', 180).lurch).toBeCloseTo(0, 6);
    expect(heroPose('pralka', 180).drum).toBeCloseTo(180, 6);
    expect(heroPose('pralka', 0).door).toBe(1);
    expect(heroPose('pralka', 90).door).toBeLessThan(0.2);
    expect(heroPose('pralka', 180).door).toBeCloseTo(1, 6);
  });

  it('the whip appears on the peak of the swing and is visible for 120 ms', () => {
    const visible = (t: number): boolean => {
      const p = heroPose('pralka', t);
      return p.draw > 0 && p.erase < 1;
    };
    expect(visible(89)).toBe(false);
    expect(visible(91)).toBe(true);
    expect(visible(209)).toBe(true);
    expect(visible(210)).toBe(false);
    let ms = 0;
    for (let t = 0; t < HERO_ATTACK_MS.pralka; t++) if (visible(t + 0.5)) ms++;
    expect(ms).toBe(120);
  });

  it('Konsultant throws with a 40 degree arm and the ticket leaves the hand', () => {
    let peak = 0;
    for (let t = 0; t <= 160; t++) peak = Math.min(peak, heroPose('konsultant', t).arm);
    expect(peak).toBeCloseTo(-THROW_DEG, 0);
    expect(heroPose('konsultant', 160).arm).toBeCloseTo(0, 6);
    expect(heroPose('konsultant', 0).ticketOut).toBe(false);
    expect(heroPose('konsultant', 80).ticketOut).toBe(true);
    expect(heroPose('konsultant', 159).ticketOut).toBe(false);
  });

  it('Petlowiec dips the helmet and writes the remark, then rubs it out', () => {
    expect(heroPose('petlowiec', 0).dip).toBe(0);
    expect(heroPose('petlowiec', 100).dip).toBeGreaterThan(2);
    expect(heroPose('petlowiec', 200).dip).toBeCloseTo(0, 6);
    expect(heroPose('petlowiec', 100).draw).toBe(1);
    expect(heroPose('petlowiec', 100).erase).toBe(0);
    expect(heroPose('petlowiec', 200).erase).toBe(1);
  });

  it('Kartograf kicks the instrument back 6, draws the line in 80 ms and erases it in 120', () => {
    expect(heroPose('kartograf', 25).kick).toBeCloseTo(KICK, 6);
    expect(heroPose('kartograf', 0).kick).toBe(0);
    expect(heroPose('kartograf', 150).kick).toBe(0);
    expect(heroPose('kartograf', 40).draw).toBeCloseTo(0.5, 6);
    expect(heroPose('kartograf', 80).draw).toBe(1);
    expect(heroPose('kartograf', 80).erase).toBe(0);
    expect(heroPose('kartograf', 140).erase).toBeCloseTo(0.5, 6);
    expect(heroPose('kartograf', 200).erase).toBe(1);
  });

  it('every pose is neutral after its animation ends', () => {
    for (const id of ['pralka', 'konsultant', 'petlowiec', 'kartograf'] as const) {
      const p = heroPose(id, HERO_ATTACK_MS[id]);
      expect(Math.abs(p.lurch) + Math.abs(p.arm) + Math.abs(p.kick) + Math.abs(p.dip), id).toBeLessThan(1e-6);
      expect(p.ticketOut, id).toBe(false);
    }
  });
});

describe('geometry', () => {
  it('aimOf gives a unit direction and survives a zero distance', () => {
    const a = aimOf(10, 10, 13, 14);
    expect(a.dist).toBe(5);
    expect(Math.hypot(a.ux, a.uy)).toBeCloseTo(1, 9);
    const z = aimOf(5, 5, 5, 5);
    expect(Math.hypot(z.ux, z.uy)).toBe(1);
  });

  it('the whip is a curved stroke about 24 units long between the hero and the target', () => {
    const a = aimOf(100, 100, 150, 100);
    const nums = (whipPath(a).match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    expect(nums).toHaveLength(6);
    const [sx = 0, sy = 0, cx = 0, cy = 0, ex = 0, ey = 0] = nums;
    let len = 0;
    let px = sx;
    let py = sy;
    for (let i = 1; i <= 100; i++) {
      const u = i / 100;
      const x = (1 - u) * (1 - u) * sx + 2 * (1 - u) * u * cx + u * u * ex;
      const y = (1 - u) * (1 - u) * sy + 2 * (1 - u) * u * cy + u * u * ey;
      len += Math.hypot(x - px, y - py);
      px = x;
      py = y;
    }
    expect(len).toBeGreaterThan(23);
    expect(len).toBeLessThan(26);
    expect(Math.min(sx, ex)).toBeGreaterThan(100);
    expect(Math.max(sx, ex)).toBeLessThan(150);
    expect(Math.abs(cy - 100)).toBeGreaterThan(5); // it bows to one side
  });

  it('the whip bows upward on either side', () => {
    for (const tx of [150, 50]) {
      const nums = (whipPath(aimOf(100, 100, tx, 100)).match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
      expect(nums[3]).toBeLessThan(100);
    }
  });

  it('the measurement runs from the pole to the target and is trimmed by draw and erase', () => {
    const a = aimOf(0, 0, 200, 0);
    const s = measureStart(a, 1.4);
    expect(s.x).toBeCloseTo(21, 6);
    expect(s.y).toBeCloseTo(-30.8, 6);
    const full = measureSegment(a, 1.4, 1, 0);
    expect(full.d.startsWith('M21 -30.8L200 0')).toBe(true);
    const part = measureSegment(a, 1.4, 0.5, 0);
    expect(part.d).toBe('M21 -30.8L110.5 -15.4');
    const rubbed = measureSegment(a, 1.4, 1, 0.5);
    expect(rubbed.d.startsWith('M110.5 -15.4L200 0')).toBe(true);
    expect(rubbed.offset).toBeCloseTo(-0.5 * rubbed.len, 6);
    // pole on the far side when the target is behind
    expect(measureStart(aimOf(0, 0, -200, 0), 1.4).x).toBeCloseTo(-21, 6);
  });
});

describe('the record on a figure', () => {
  it('starts at the first frame that sees it, ends after its duration and can be restarted', () => {
    const g = fakeFigure();
    expect(attackAt(g, 1000, 200)).toBeNull();
    beginAttack(g, 0, 0, 50, 0, false);
    expect(attackAt(g, 5000, 200)?.t).toBe(0);
    expect(attackAt(g, 5090, 200)?.t).toBe(90);
    beginAttack(g, 0, 0, 0, 50, true);
    const again = attackAt(g, 5100, 200);
    expect(again?.t).toBe(0);
    expect(again?.a.ranged).toBe(true);
    expect(again?.a.uy).toBe(1);
    expect(attackAt(g, 5300, 200)).toBeNull();
    expect(attackAt(g, 5301, 200)).toBeNull();
  });
});
