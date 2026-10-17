import { describe, expect, it } from 'vitest';
import { BASE_R, DEAD_ZONE, knobOffset, steerVector } from './joystick';

describe('steerVector', () => {
  it('steers nothing inside the 12% dead zone', () => {
    expect(steerVector(0, 0).mag).toBe(0);
    expect(steerVector(BASE_R * DEAD_ZONE * 0.9, 0).mag).toBe(0);
    expect(steerVector(0, -BASE_R * DEAD_ZONE * 0.5)).toEqual({ dx: 0, dy: 0, mag: 0 });
  });
  it('starts from zero at the edge of the dead zone and reaches 1 at the rim', () => {
    const edge = steerVector(BASE_R * DEAD_ZONE * 1.001, 0);
    expect(edge.mag).toBeGreaterThan(0);
    expect(edge.mag).toBeLessThan(0.01);
    expect(steerVector(BASE_R, 0).mag).toBeCloseTo(1, 10);
  });
  it('scales speed with distance', () => {
    const near = steerVector(20, 0).mag;
    const far = steerVector(40, 0).mag;
    expect(far).toBeGreaterThan(near);
    expect(steerVector(BASE_R / 2, 0).mag).toBeCloseTo((0.5 - DEAD_ZONE) / (1 - DEAD_ZONE), 10);
  });
  it('stays at 1 beyond the rim and keeps the direction a unit vector', () => {
    const v = steerVector(300, -400);
    expect(v.mag).toBe(1);
    expect(Math.hypot(v.dx, v.dy)).toBeCloseTo(1, 10);
    expect(v.dx).toBeCloseTo(0.6, 10);
    expect(v.dy).toBeCloseTo(-0.8, 10);
  });
});

describe('knobOffset', () => {
  it('follows the finger inside the base', () => {
    expect(knobOffset(10, -20)).toEqual({ x: 10, y: -20 });
  });
  it('is clamped to the base circle outside it', () => {
    const k = knobOffset(BASE_R * 3, 0);
    expect(k.x).toBeCloseTo(BASE_R, 10);
    expect(k.y).toBeCloseTo(0, 10);
    const d = knobOffset(300, 400);
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(BASE_R, 10);
    expect(d.x / d.y).toBeCloseTo(0.75, 10);
  });
});
