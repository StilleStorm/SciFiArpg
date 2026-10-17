import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { dist } from '../core/vec';
import { PAGE_H, PAGE_W, generatePage, resolveMove } from './pages';

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
