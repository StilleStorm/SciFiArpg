import { afterEach, describe, expect, it } from 'vitest';
import { createBus } from '../core/events';
import { countInView } from '../enemies/spawn';
import { enterPage, entryView, populatePage } from '../world/pageTurn';
import { createRun } from '../world/run';
import { MIN_VIEW_H, MIN_VIEW_H_LANDSCAPE, MIN_VIEW_W, setViewSize, viewRect, viewSizeFor } from './camera';

afterEach(() => setViewSize({ w: MIN_VIEW_W, h: MIN_VIEW_H }));

describe('viewSizeFor', () => {
  it('keeps the portrait view as it was: 390 wide, taller phones show more height', () => {
    expect(viewSizeFor(390, 844)).toEqual({ w: 390, h: 844 });
    const small = viewSizeFor(360, 640);
    expect(small.h).toBeCloseTo(700, 5); // a short phone shows 700 tall and a little more than 390 wide
    expect(small.w).toBeCloseTo(360 * (700 / 640), 5);
  });
  it('shows 520 units of height in landscape and the window width at that scale', () => {
    for (const [w, h] of [
      [844, 390],
      [932, 430],
      [740, 360],
    ] as const) {
      const v = viewSizeFor(w, h);
      expect(v.h).toBeCloseTo(MIN_VIEW_H_LANDSCAPE, 5);
      expect(v.w).toBeCloseTo((MIN_VIEW_H_LANDSCAPE * w) / h, 5);
      expect(v.w).toBeGreaterThan(MIN_VIEW_W);
      expect(v.w / v.h).toBeCloseTo(w / h, 5); // the viewBox has the window's aspect: slice crops nothing
    }
    const phone = viewSizeFor(844, 390);
    expect(phone.w).toBeCloseTo(1125.3, 0); // about 1125 x 520: the 1200-unit page fills the width
    expect(phone.w).toBeLessThan(1200);
  });
  it('figures read about a third larger in landscape than with the portrait height', () => {
    const px = (v: { h: number }, vh: number): number => vh / v.h; // css px per world unit
    expect(px(viewSizeFor(844, 390), 390) / (390 / MIN_VIEW_H)).toBeCloseTo(MIN_VIEW_H / MIN_VIEW_H_LANDSCAPE, 5);
  });
  it('a square window counts as portrait', () => {
    expect(viewSizeFor(700, 700)).toEqual({ w: 700, h: 700 });
  });
  it('never drops below the minimum view', () => {
    const v = viewSizeFor(2000, 400);
    expect(v.h).toBeGreaterThanOrEqual(MIN_VIEW_H_LANDSCAPE - 1e-9);
    expect(v.w).toBeGreaterThanOrEqual(MIN_VIEW_W);
    const p = viewSizeFor(300, 900);
    expect(p.w).toBeGreaterThanOrEqual(MIN_VIEW_W - 1e-9);
    expect(p.h).toBeGreaterThanOrEqual(MIN_VIEW_H);
  });
});

describe('viewRect', () => {
  it('keeps a landscape view inside the page plus overscan: no paper beside the page except at its borders', () => {
    const b = { w: 1200, h: 1600 };
    const v = viewSizeFor(844, 390);
    for (const cx of [0, 300, 600, 900, 1200]) {
      const r = viewRect(cx, 800, v.w, v.h, b);
      expect(r.x0).toBeGreaterThanOrEqual(-60);
      expect(r.x1).toBeLessThanOrEqual(1260);
    }
    const mid = viewRect(600, 800, v.w, v.h, b);
    expect(mid.x0).toBeGreaterThan(0); // centred on the page: page on both sides, no margin showing
    expect(mid.x1).toBeLessThan(1200);
  });
  it('clamps to the page plus overscan and centres a view wider than the page', () => {
    const b = { w: 1200, h: 1600 };
    const r = viewRect(100, 100, 1515, 700, b);
    expect(r.x1 - r.x0).toBeCloseTo(1515);
    expect(r.x0).toBeCloseTo(600 - 1515 / 2); // wider than the page: centred
    expect(r.y0).toBeCloseTo(-60);
    const bottom = viewRect(600, 1590, 1515, 700, b);
    expect(bottom.y1).toBeCloseTo(1660);
  });
});

describe('the entry wave uses the real view', () => {
  it('places at least three in the portrait view too', () => {
    setViewSize(viewSizeFor(390, 844));
    for (const seed of [1, 2, 3]) {
      const s = createRun(seed, { pageCount: 3 });
      populatePage(s, createBus());
      expect(countInView(s, entryView(s), 180)).toBeGreaterThanOrEqual(3);
    }
  });
  it('has at least three enemies in a landscape view, none closer than 180 units', () => {
    setViewSize(viewSizeFor(844, 390));
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = createRun(seed, { lawId: 'grawitacja', pageCount: 5 });
      const bus = createBus();
      for (let page = 0; page < 5; page++) {
        if (page > 0) enterPage(s, bus, page);
        populatePage(s, bus);
        const view = entryView(s);
        expect(view.x1 - view.x0).toBeCloseTo(viewSizeFor(844, 390).w, 5);
        expect(view.y1 - view.y0).toBeCloseTo(MIN_VIEW_H_LANDSCAPE, 5);
        expect(countInView(s, view, 180), `seed ${seed} page ${page}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
