import { describe, expect, it } from 'vitest';
import { generateBase } from '../world/base';
import { PAGE_H, PAGE_W } from '../world/pages';
import { marginSpot, placeStamp } from './bindings';

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

  it('keeps off the hero touching the wall on every side', () => {
    const cases: ['l' | 'r' | 't' | 'b', number, number][] = [
      ['l', 40, 500],
      ['r', PAGE_W - 40, 500],
      ['t', 300, 40],
      ['b', 300, PAGE_H - 40],
      ['b', PAGE_W - 60, PAGE_H - 40],
    ];
    for (const [side, x, y] of cases) {
      const m = marginSpot(side, x, y);
      expect(Math.hypot(m.x - x, m.y - y)).toBeGreaterThanOrEqual(60);
    }
  });

  it('defaults to the run page', () => {
    expect(marginSpot('r', 0, 100).x).toBeGreaterThan(PAGE_W / 2);
    expect(marginSpot('b', 0, 100).y).toBeGreaterThan(PAGE_H / 2);
  });
});

describe('where a stamp lands', () => {
  const view = { x0: 0, y0: 70, x1: 390, y1: 734 };
  it('stays inside the view instead of running past an edge', () => {
    const at = placeStamp(20, 60, 330, 41, view);
    expect(at.x - 165).toBeGreaterThanOrEqual(view.x0);
    expect(at.y - 20.5).toBeGreaterThanOrEqual(view.y0);
  });
  it('never covers the hero it must stay off, even when the edge pushes it back', () => {
    const hero = { x: 195, y: 120 };
    const at = placeStamp(195, 120 - 130, 330, 41, view, hero);
    expect(Math.abs(at.y - hero.y)).toBeGreaterThanOrEqual(80);
    expect(at.y).toBeGreaterThan(hero.y);
  });
  it('stays off the pads and the margin-note row', () => {
    const row = { x0: 230, y0: 70, x1: 378, y1: 116 };
    const pad = { x0: 300, y0: 580, x1: 386, y1: 720 };
    const at = placeStamp(300, 100, 200, 41, view, undefined, [row, pad]);
    expect(at.y - 20.5 >= row.y1 || at.x + 100 <= row.x0).toBe(true);
    const low = placeStamp(195, 650, 330, 41, view, undefined, [row, pad]);
    expect(low.y + 20.5).toBeLessThanOrEqual(pad.y0);
  });
  it('without a view it lands where it was asked', () => {
    expect(placeStamp(5, 6, 100, 41, null)).toEqual({ x: 5, y: 6 });
  });
});
