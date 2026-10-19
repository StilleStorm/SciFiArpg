import { describe, expect, it } from 'vitest';
import { isGhostOf, type GuardNode, type Press } from './sheet';

/** A tiny tree: nodes know their parent; `contains` walks up from the other node. */
class N implements GuardNode {
  isConnected = true;
  constructor(readonly parent: N | null = null) {}
  contains(other: GuardNode | null): boolean {
    for (let n = other as N | null; n; n = n.parent) if (n === this) return true;
    return false;
  }
  path(): N[] {
    const out: N[] = [];
    for (let n: N | null = this; n; n = n.parent) out.push(n);
    return out;
  }
}

const pressOf = (pressed: N, upAt = 100): Press<N> => ({ pressed, path: pressed.path(), upAt });

describe('isGhostOf', () => {
  const root = new N();
  const stage = new N(root);

  it('lets a click on the pressed element, its children and its ancestors through', () => {
    const btn = new N(stage);
    const label = new N(btn);
    const p = pressOf(btn);
    expect(isGhostOf(p, btn, 150)).toBe(false);
    expect(isGhostOf(p, label, 150)).toBe(false);
    expect(isGhostOf(p, stage, 150)).toBe(false);
  });

  it('stops the click that lands on a new sheet button while the pressed element is still on the page', () => {
    const station = new N(stage);
    const sheetBtn = new N(stage);
    expect(isGhostOf(pressOf(station), sheetBtn, 150)).toBe(true);
  });

  it('stops the click on a new line when the pressed element has left the page (the desk-line ghost)', () => {
    const station = new N(stage);
    const p = pressOf(station);
    station.isConnected = false;
    const deskLine = new N(stage);
    expect(isGhostOf(p, deskLine, 150)).toBe(true);
    expect(isGhostOf(p, stage, 150)).toBe(false); // an old ancestor may still take it
  });

  it('honours everything after the tail, before the finger is up and without a press', () => {
    const a = new N(stage);
    const b = new N(stage);
    expect(isGhostOf(pressOf(a, 100), b, 100 + 701)).toBe(false);
    expect(isGhostOf(pressOf(a, Infinity), b, 50)).toBe(true);
    expect(isGhostOf(null, b, 50)).toBe(false);
  });
});
