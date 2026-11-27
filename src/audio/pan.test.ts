import { describe, expect, it } from 'vitest';
import { FakeContext } from './fakeContext';
import { DEFAULT_VIEW_W, MAX_PAN, panFor } from './pan';
import { playRecipe, RECIPES, type Sink } from './sfx';
import { createRng } from '../core/rng';

describe('panFor', () => {
  it('is centre on the camera centre, signed by side, and linear to the view edge', () => {
    expect(panFor(500, 500)).toBe(0);
    expect(panFor(500 + DEFAULT_VIEW_W / 2, 500)).toBeCloseTo(MAX_PAN, 9);
    expect(panFor(500 - DEFAULT_VIEW_W / 4, 500)).toBeCloseTo(-MAX_PAN / 2, 9);
  });
  it('never exceeds 0.6 whatever the distance, and follows the view width', () => {
    expect(panFor(9999, 0)).toBe(0.6);
    expect(panFor(-9999, 0)).toBe(-0.6);
    expect(panFor(100, 0, 1000)).toBeCloseTo(0.12, 9);
  });
  it('degrades to centre on nonsense', () => {
    expect(panFor(Number.NaN, 0)).toBe(0);
    expect(panFor(1, 0, 0)).toBe(0);
  });
});

describe('a panned recipe', () => {
  const sink = (): { fc: FakeContext; s: Sink } => {
    const fc = new FakeContext();
    const out = fc.createGain();
    return { fc, s: { ctx: fc.asContext(), out: out as unknown as AudioNode, now: () => 0, rng: createRng(1) } };
  };
  it('goes through a stereo panner set to the pan; unpanned sounds get none', () => {
    const a = sink();
    playRecipe(a.s, 'hit', RECIPES.hit, { pan: -0.4 }, false);
    const panners = a.fc.nodes.filter((n) => n.kind === 'panner');
    expect(panners.length).toBe(1);
    expect(panners[0]?.pan.value).toBeCloseTo(-0.4, 9);
    const b = sink();
    playRecipe(b.s, 'hit', RECIPES.hit, {}, false);
    expect(b.fc.nodes.some((n) => n.kind === 'panner')).toBe(false);
  });
});
