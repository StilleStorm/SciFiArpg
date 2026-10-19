import { describe, expect, it } from 'vitest';
import { inkedStrokes, ULT_STROKES } from './pads';

describe('inkedStrokes', () => {
  it('inks the cushion in steps as the meter fills, and all of it only at a full meter', () => {
    expect(inkedStrokes(0)).toBe(0);
    expect(inkedStrokes(0.05)).toBe(0);
    expect(inkedStrokes(0.1)).toBe(1);
    expect(inkedStrokes(0.5)).toBe(5);
    expect(inkedStrokes(0.99)).toBe(ULT_STROKES - 1);
    expect(inkedStrokes(1)).toBe(ULT_STROKES);
    expect(inkedStrokes(7)).toBe(ULT_STROKES);
    expect(inkedStrokes(-1)).toBe(0);
  });
});
