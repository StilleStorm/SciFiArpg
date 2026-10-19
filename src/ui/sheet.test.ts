import { describe, expect, it } from 'vitest';
import { cutEdge, isGhostOf, runsOn, type GuardNode, type Press } from './sheet';

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

describe('the c.d. cue', () => {
  it('shows only while more than a sliver is left below', () => {
    expect(runsOn(0, 500, 900)).toBe(true);
    expect(runsOn(400, 500, 900)).toBe(false);
    expect(runsOn(396, 500, 900)).toBe(false);
  });
  it('starts its strip where it slices no line', () => {
    // max 983 slices the line 975..995; the nearest clean height above is that line's top
    expect(cutEdge([{ top: 950, bottom: 970 }, { top: 975, bottom: 995 }], 983)).toBe(975);
    // nothing sliced: the strip keeps its full room
    expect(cutEdge([{ top: 950, bottom: 970 }], 983)).toBe(983);
    // touching lines of one paragraph: only the sliced one goes under the strip
    expect(cutEdge([{ top: 696, bottom: 715 }, { top: 715, bottom: 734 }, { top: 734, bottom: 753 }], 748)).toBe(734);
    // two interleaved columns (the landscape Karta osobowa): a line's bottom in one column is a clean cut for both
    const cols = [
      { top: 289, bottom: 306 },
      { top: 311, bottom: 328 },
      { top: 300, bottom: 316 },
      { top: 330, bottom: 346 },
    ];
    expect(cutEdge(cols, 329)).toBe(329);
    expect(cutEdge(cols, 320)).toBe(289);
    // a fraction of a px past a line's bottom is not a slice
    expect(cutEdge(cols, 328.6)).toBe(328.6);
  });
});
