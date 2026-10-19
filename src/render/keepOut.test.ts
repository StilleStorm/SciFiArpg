import { describe, expect, it } from 'vitest';
import { avoidBoxes, cssToWorld, overlaps, screenLayout, setLayoutSource, setScreenLayout, invalidateLayout, type Box } from './keepOut';

const shift = (b: Box, [dx, dy]: [number, number]): Box => ({ x0: b.x0 + dx, y0: b.y0 + dy, x1: b.x1 + dx, y1: b.y1 + dy });
const inside = (b: Box, f: Box): boolean => b.x0 >= f.x0 - 1e-9 && b.y0 >= f.y0 - 1e-9 && b.x1 <= f.x1 + 1e-9 && b.y1 <= f.y1 + 1e-9;

describe('keeping a box out from under the screen furniture', () => {
  const free: Box = { x0: 0, y0: 70, x1: 390, y1: 734 };
  // the margin-note row (Potw., Tunel, Pauza) top right, and two pads at the bottom
  const row: Box = { x0: 230, y0: 70, x1: 378, y1: 116 };
  const pads: Box[] = [
    { x0: 4, y0: 650, x1: 88, y1: 720 },
    { x0: 300, y0: 580, x1: 386, y1: 720 },
  ];
  const blocks = [row, ...pads];

  it('leaves a box that is clear where it is', () => {
    expect(avoidBoxes({ x0: 100, y0: 300, x1: 200, y1: 340 }, free, blocks)).toEqual([0, 0]);
  });

  it('moves a bubble out from under the note row by the shortest way, inside the view', () => {
    const b: Box = { x0: 250, y0: 80, x1: 370, y1: 130 };
    const m = avoidBoxes(b, free, blocks);
    const at = shift(b, m);
    expect(blocks.some((k) => overlaps(at, k))).toBe(false);
    expect(inside(at, free)).toBe(true);
    expect(m[1]).toBeGreaterThan(0); // below the row: left of it is 130 units away, below only 36
  });

  it('pushes a box clipped at the screen edge inward and off a pad there', () => {
    const b: Box = { x0: -40, y0: 640, x1: 110, y1: 690 };
    const at = shift(b, avoidBoxes(b, free, blocks));
    expect(inside(at, free)).toBe(true);
    expect(blocks.some((k) => overlaps(at, k))).toBe(false);
  });

  it('a stamp as wide as the view goes above the pads', () => {
    const b: Box = { x0: 30, y0: 640, x1: 360, y1: 681 };
    const at = shift(b, avoidBoxes(b, free, blocks));
    expect(at.y1).toBeLessThanOrEqual(580);
    expect(inside(at, free)).toBe(true);
  });

  it('only keeps the box inside the view when no move clears every block', () => {
    const wall: Box = { x0: 0, y0: 0, x1: 400, y1: 800 };
    const b: Box = { x0: -10, y0: 100, x1: 50, y1: 120 };
    expect(avoidBoxes(b, free, [wall])).toEqual([10, 0]);
  });

  it('maps css px to world units for the view and the zoom', () => {
    expect(cssToWorld({ x0: 75, y0: 30, x1: 150, y1: 60 }, { x0: 100, y0: -60 }, 0.75)).toEqual({ x0: 200, y0: -20, x1: 300, y1: 20 });
  });

  it('measures lazily, once per invalidation', () => {
    let n = 0;
    setLayoutSource(() => {
      n++;
      return { w: 390, h: 844, top: 64, bottom: 738, blocks: [], row: null };
    });
    screenLayout();
    screenLayout();
    expect(n).toBe(1);
    invalidateLayout();
    expect(screenLayout()?.top).toBe(64);
    expect(n).toBe(2);
    setScreenLayout(null);
  });
});
