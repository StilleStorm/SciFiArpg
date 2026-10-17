import { describe, expect, it } from 'vitest';
import { createGrid } from './grid';

describe('grid', () => {
  it('finds neighbors across cell borders and ignores far items', () => {
    const g = createGrid<{ x: number; y: number; n: string }>(64);
    g.insert({ x: 60, y: 60, n: 'a' });
    g.insert({ x: 70, y: 66, n: 'b' });
    g.insert({ x: 500, y: 500, n: 'far' });
    g.insert({ x: -30, y: -30, n: 'neg' });
    const near = g.query(64, 64, 20).map((i) => i.n).sort();
    expect(near).toEqual(['a', 'b']);
    expect(g.query(-20, -20, 20).map((i) => i.n)).toEqual(['neg']);
  });
  it('clear empties it', () => {
    const g = createGrid<{ x: number; y: number }>();
    g.insert({ x: 1, y: 1 });
    g.clear();
    expect(g.query(1, 1, 10)).toEqual([]);
  });
});
