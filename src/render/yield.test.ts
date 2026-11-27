import { describe, expect, it } from 'vitest';
import { headerCovered } from './headerYield';
import { coveredBy } from './propYield';

describe('headerCovered', () => {
  const box = { x0: 100, y0: 100, x1: 400, y1: 160 };
  it('is true for a body whose circle reaches the box', () => {
    expect(headerCovered(box, [{ x: 250, y: 200, r: 50 }])).toBe(true);
    expect(headerCovered(box, [{ x: 450, y: 130, r: 60 }])).toBe(true);
  });
  it('is false for a body clear of it', () => {
    expect(headerCovered(box, [{ x: 250, y: 300, r: 40 }])).toBe(false);
    expect(headerCovered(box, [])).toBe(false);
  });
});

describe('coveredBy', () => {
  const foot = { x0: 0, y0: 0, x1: 100, y1: 100 };
  it('tests a prop footprint against the screen furniture in page units', () => {
    expect(coveredBy(foot, [{ x0: 90, y0: 90, x1: 200, y1: 200 }])).toBe(true);
    expect(coveredBy(foot, [{ x0: 100, y0: 0, x1: 200, y1: 50 }])).toBe(false);
    expect(coveredBy(foot, [])).toBe(false);
  });
});
