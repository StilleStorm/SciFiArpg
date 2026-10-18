import { describe, expect, it } from 'vitest';
import {
  ENEMY_MELEE_MS,
  ENEMY_RANGED_MS,
  HERO_ATTACK_MS,
  KICK,
  LASH_BACK_MS,
  LASH_OUT_MS,
  LUNGE,
  LURCH,
  THROW_DEG,
  WHIP_AT_MS,
  WHIP_HOLD_MS,
  WIND_UP,
  aimOf,
  attackAt,
  beginAttack,
  enemyOffset,
  heroPose,
  keyframes,
  lashPath,
  measureSegment,
  measureStart,
  scribblePath,
  whipPath,
  whipSplash,
} from './attackFx';
import { createRng } from '../core/rng';

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
  it('Pralka lurches 16 over 320 ms, turns the drum a full 360 degrees and swings the door open to a sliver and back', () => {
    expect(LURCH).toBe(16);
    expect(HERO_ATTACK_MS.pralka).toBe(320);
    expect(heroPose('pralka', 0).lurch).toBe(0);
    expect(heroPose('pralka', 130).lurch).toBeCloseTo(LURCH, 6);
    expect(heroPose('pralka', 320).lurch).toBeCloseTo(0, 6);
    expect(heroPose('pralka', 0).drum).toBe(0);
    expect(heroPose('pralka', 160).drum).toBeCloseTo(180, 6);
    expect(heroPose('pralka', 320).drum).toBeCloseTo(360, 6);
    expect(heroPose('pralka', 0).door).toBe(1);
    expect(heroPose('pralka', 130).door).toBeCloseTo(0.05, 6);
    expect(heroPose('pralka', 320).door).toBeCloseTo(1, 6);
  });

  it('the whip is laid down as the body surges, stays fully drawn for 180 ms and is rubbed out by the end', () => {
    const fully = (t: number): boolean => {
      const p = heroPose('pralka', t);
      return p.draw >= 1 && p.erase <= 0;
    };
    const visible = (t: number): boolean => {
      const p = heroPose('pralka', t);
      return p.draw > 0 && p.erase < 1;
    };
    expect(visible(WHIP_AT_MS - 1)).toBe(false);
    expect(visible(WHIP_AT_MS + 1)).toBe(true);
    expect(visible(HERO_ATTACK_MS.pralka - 1)).toBe(true);
    expect(heroPose('pralka', HERO_ATTACK_MS.pralka).erase).toBe(1);
    let held = 0;
    for (let t = 0; t < HERO_ATTACK_MS.pralka; t++) if (fully(t + 0.5)) held++;
    expect(held).toBe(WHIP_HOLD_MS);
    expect(WHIP_HOLD_MS).toBe(180);
  });

  it('Konsultant throws with a 40 degree arm and the ticket leaves the hand until the cable is home', () => {
    let peak = 0;
    for (let t = 0; t <= 160; t++) peak = Math.min(peak, heroPose('konsultant', t).arm);
    expect(peak).toBeCloseTo(-THROW_DEG, 0);
    expect(heroPose('konsultant', 160).arm).toBeCloseTo(0, 6);
    expect(heroPose('konsultant', 0).ticketOut).toBe(false);
    expect(heroPose('konsultant', 80).ticketOut).toBe(true);
    expect(heroPose('konsultant', 205).ticketOut).toBe(false);
  });

  it('the Konsultant cable reaches the target in 90 ms, snaps back in 120, and the card sits on the target at the hit', () => {
    expect(LASH_OUT_MS + LASH_BACK_MS).toBeLessThan(HERO_ATTACK_MS.konsultant);
    expect(heroPose('konsultant', 0).lash).toBe(0);
    expect(heroPose('konsultant', 45).lash).toBeGreaterThan(0.5); // eases out: most of the way by the middle
    expect(heroPose('konsultant', 45).lash).toBeLessThan(1);
    expect(heroPose('konsultant', LASH_OUT_MS).lash).toBeCloseTo(1, 6);
    expect(heroPose('konsultant', LASH_OUT_MS + 60).lash).toBeCloseTo(0.5, 1);
    expect(heroPose('konsultant', LASH_OUT_MS + LASH_BACK_MS).lash).toBeCloseTo(0, 6);
    expect(heroPose('konsultant', LASH_OUT_MS - 1).card).toBe(false);
    expect(heroPose('konsultant', LASH_OUT_MS).card).toBe(true);
    expect(heroPose('konsultant', LASH_OUT_MS + 150).card).toBe(false);
  });

  it('Petlowiec dips the helmet and writes the mark beside it, then rubs it out', () => {
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

  it('the whip is a curved stroke about 40 units long, starting clear of the cabinet, on the way to the target', () => {
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
    expect(len).toBeGreaterThan(40);
    expect(len).toBeLessThan(45);
    expect(Math.min(sx, ex)).toBeGreaterThanOrEqual(128);
    expect(Math.max(sx, ex)).toBeLessThan(180);
    expect(Math.abs(cy - 100)).toBeGreaterThan(5); // it bows to one side
  });

  it('the whip bows upward on either side', () => {
    for (const tx of [150, 50]) {
      const nums = (whipPath(aimOf(100, 100, tx, 100)).match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
      expect(nums[3]).toBeLessThan(100);
    }
  });

  it('the whip throws two to three drops of ink off its tip, ahead of the target direction', () => {
    const a = aimOf(100, 100, 156, 100);
    const drops = whipSplash(a);
    expect(drops.length).toBeGreaterThanOrEqual(2);
    expect(drops.length).toBeLessThanOrEqual(3);
    const [, , , , ex = 0, ey = 0] = (whipPath(a).match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    for (const [x, y] of drops) expect(Math.hypot(x - ex, y - ey)).toBeLessThan(14);
  });

  it('the cable lash ends exactly on the target at full reach and is only the hand when it is home', () => {
    const root = { x: 0, y: 0 };
    const target = { x: 160, y: 40 };
    const full = lashPath(root, target, 1, 0);
    expect(full.tip).toEqual(target);
    expect(full.d.startsWith('M0 0')).toBe(true);
    const nums = (full.d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    expect(nums.slice(-2)).toEqual([160, 40]);
    expect(nums.length / 2).toBeGreaterThan(8); // a wavy line, not a straight one
    const half = lashPath(root, target, 0.5, 20);
    expect(half.tip).toEqual({ x: 80, y: 20 });
    expect(lashPath(root, target, 0, 0).d).toBe('M0 0h.01');
    // the wave is slight: no point strays more than 5 units from the straight line
    const dirx = 160 / Math.hypot(160, 40);
    const diry = 40 / Math.hypot(160, 40);
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const dist = Math.abs((nums[i] ?? 0) * diry - (nums[i + 1] ?? 0) * dirx);
      expect(dist).toBeLessThanOrEqual(5.01);
    }
  });

  it('a scribble has the bumps asked for, is centred, and differs from seed to seed', () => {
    for (const bumps of [5, 6, 7]) {
      const d = scribblePath(createRng(bumps), bumps, 30, 6);
      expect(d.match(/Q/g)).toHaveLength(bumps);
      const nums = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
      expect(nums[0]).toBe(-15);
    }
    expect(scribblePath(createRng(1), 6, 30, 6)).not.toBe(scribblePath(createRng(2), 6, 30, 6));
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
