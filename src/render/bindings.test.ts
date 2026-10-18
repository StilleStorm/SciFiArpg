import { describe, expect, it } from 'vitest';
import { generateBase } from '../world/base';
import { PAGE_H, PAGE_W } from '../world/pages';
import { marginSpot } from './bindings';

describe('the "margines" note', () => {
  it('sits just inside the wall of the page that is shown, the base page included', () => {
    const base = generateBase(7);
    expect(base.w).toBeLessThan(PAGE_W);
    const r = marginSpot('r', base.w - 30, 300, base);
    expect(r.x).toBeLessThan(base.w - base.inset);
    expect(r.x).toBeGreaterThan(base.w / 2);
    const b = marginSpot('b', 200, base.h - 30, base);
    expect(b.y).toBeLessThan(base.h - base.inset);
    expect(b.y).toBeGreaterThan(base.h / 2);
  });

  it('defaults to the run page', () => {
    expect(marginSpot('r', 0, 100).x).toBeGreaterThan(PAGE_W / 2);
    expect(marginSpot('b', 0, 100).y).toBeGreaterThan(PAGE_H / 2);
  });
});
