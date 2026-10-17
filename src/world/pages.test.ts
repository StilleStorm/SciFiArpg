import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { dist } from '../core/vec';
import { PAGE_H, PAGE_INSET, PAGE_W, atExit, generatePage, generateRunPages, resolveMove } from './pages';
import { createRun } from './run';

describe('generatePage', () => {
  it('is deterministic and has 6-10 obstacles clear of the spawn', () => {
    const a = generatePage(createRng(42));
    const b = generatePage(createRng(42));
    expect(a).toEqual(b);
    for (let s = 1; s < 40; s++) {
      const p = generatePage(createRng(s));
      expect(p.obstacles.length).toBeGreaterThanOrEqual(6);
      expect(p.obstacles.length).toBeLessThanOrEqual(10);
      for (const o of p.obstacles) for (const c of o.colliders) expect(dist(c, p.spawn)).toBeGreaterThan(c.r + 100);
    }
    expect(a.obstacles.some((o) => o.kind === 'ring')).toBe(true);
    expect(a.obstacles.some((o) => o.kind === 'note')).toBe(true);
  });
});

describe('resolveMove', () => {
  const page = generatePage(createRng(7));
  it('clamps to the walls and names the side', () => {
    const pos = { x: -50, y: 800 };
    expect(resolveMove(page, pos, 10)).toBe('l');
    expect(pos.x).toBe(page.inset + 10);
    const p2 = { x: 600, y: PAGE_H + 50 };
    expect(resolveMove(page, p2, 10)).toBe('b');
    const p3 = { x: PAGE_W + 9, y: 800 };
    expect(resolveMove(page, p3, 10)).toBe('r');
  });
  it('pushes a circle out of a collider', () => {
    const c = page.obstacles.find((o) => o.kind === 'blot')?.colliders[0];
    expect(c).toBeDefined();
    if (!c) return;
    const pos = { x: c.x + 1, y: c.y };
    resolveMove(page, pos, 10);
    expect(Math.hypot(pos.x - c.x, pos.y - c.y)).toBeGreaterThanOrEqual(c.r + 10 - 1e-6);
  });
  it('leaves free space alone', () => {
    const pos = { ...page.spawn };
    expect(resolveMove(page, pos, 10)).toBeNull();
    expect(pos).toEqual(page.spawn);
  });
});

describe('generateRunPages', () => {
  it('is deterministic and has 4-6 linked pages from a seed', () => {
    const a = generateRunPages(createRng(9), 5);
    expect(a).toEqual(generateRunPages(createRng(9), 5));
    expect(a).toHaveLength(5);
    a.forEach((p, i) => expect(p.index).toBe(i));
    for (let s = 1; s < 30; s++) {
      const n = createRun(s).pageCount;
      expect(n).toBeGreaterThanOrEqual(4);
      expect(n).toBeLessThanOrEqual(6);
    }
  });

  it('places the folded-corner exit on a frame corner, far from the entry, on every page but the last', () => {
    for (let s = 1; s < 60; s++) {
      const pages = generateRunPages(createRng(s), 6);
      pages.forEach((p, i) => {
        if (i === pages.length - 1) {
          expect(p.exit).toBeNull();
          return;
        }
        const e = p.exit;
        expect(e).not.toBeNull();
        if (!e) return;
        expect(e.x === PAGE_INSET || e.x === PAGE_W - PAGE_INSET).toBe(true);
        expect(e.y === PAGE_INSET || e.y === PAGE_H - PAGE_INSET).toBe(true);
        expect(dist(e, p.entry)).toBeGreaterThan(700);
        // the exit is reachable: nothing stands in the way of the corner's flap
        for (const o of p.obstacles) for (const c of o.colliders) expect(dist(c, e)).toBeGreaterThan(c.r + 100);
        // the corner is not also the torn one
        expect(p.torn).not.toBe(e.corner);
      });
    }
  });

  it('enters each page through the corner opposite to the previous exit, and carries one kiosk', () => {
    const opposite = { tl: 'br', tr: 'bl', bl: 'tr', br: 'tl' } as const;
    for (let s = 1; s < 40; s++) {
      const pages = generateRunPages(createRng(s), 5);
      expect(pages[0]?.entryCorner).toBeNull();
      expect(pages[0]?.entry).toEqual({ x: PAGE_W / 2, y: PAGE_H - 180 });
      for (let i = 1; i < pages.length; i++) {
        const prev = pages[i - 1]?.exit;
        expect(prev).toBeTruthy();
        if (prev) expect(pages[i]?.entryCorner).toBe(opposite[prev.corner]);
      }
      expect(pages.filter((p) => p.hasKiosk)).toHaveLength(1);
      expect(pages[2]?.hasKiosk).toBe(true);
      expect(pages[2]?.obstacles.some((o) => o.kind === 'kiosk')).toBe(true);
    }
  });

  it('uses the new obstacle kinds across a run and keeps them clear of the entry', () => {
    const kinds = new Set<string>();
    for (let s = 1; s < 25; s++) {
      for (const p of generateRunPages(createRng(s), 5)) {
        for (const o of p.obstacles) {
          kinds.add(o.kind);
          for (const c of o.colliders) expect(dist(c, p.entry)).toBeGreaterThan(c.r + 100);
        }
      }
    }
    for (const k of ['qr', 'sticky', 'clip', 'kiosk', 'note', 'ring', 'blot', 'torn']) expect(kinds.has(k)).toBe(true);
  });
});

describe('atExit', () => {
  it('is true inside the folded corner and false elsewhere', () => {
    const pages = generateRunPages(createRng(3), 4);
    const p = pages[0];
    expect(p?.exit).toBeTruthy();
    if (!p?.exit) return;
    expect(atExit(p, { x: p.exit.x, y: p.exit.y })).toBe(true);
    expect(atExit(p, p.entry)).toBe(false);
    const last = pages[3];
    if (last) expect(atExit(last, { x: 40, y: 40 })).toBe(false);
  });
});
