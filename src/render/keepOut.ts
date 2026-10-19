/**
 * What the screen furniture covers. The HUD form, the footnote band, the pads and the margin notes ("Potw.", "Tunel",
 * "Pauza") sit over the page in css px; claim bubbles, stamps and the printed page header must keep out from under them.
 *
 * The rectangles are measured from the DOM by `ui/keepOut.ts` (once per layout change: resize, orientation, steering,
 * left-handed, text size, a note or pad shown or hidden), never typed in as fixed pixels. This module holds the last
 * measurement and the pure geometry: css -> world conversion and `avoidBoxes`, the smallest move that clears them all.
 */

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The screen furniture in css px (viewport coordinates). */
export interface ScreenLayout {
  /** Window size in css px when measured. */
  w: number;
  h: number;
  /** The HUD form spans the width down to here (0 when it is a box in a corner, then it is one of `blocks`). */
  top: number;
  /** The footnote band spans the width from here down (h when it is a narrow slip, then it is one of `blocks`). */
  bottom: number;
  /** Everything else that covers the page now: pads, margin notes, the update line, a corner HUD, a narrow footnote slip. */
  blocks: readonly Box[];
  /**
   * The margin-note row and the pad that shares its corner, measured in the run's arrangement (all three notes shown,
   * whatever the phase is now): the printed page header is set clear of it. Null when there is no row.
   */
  row: Box | null;
}

let source: (() => ScreenLayout | null) | null = null;
let pendingChange: (() => boolean) | null = null;
let cached: ScreenLayout | null = null;
let dirty = true;

/**
 * The function that measures the DOM (ui/keepOut.ts), called lazily, once after each `invalidateLayout()`. `pending`
 * reports a change the DOM observers have seen but not delivered yet (their callbacks run later than the code that showed
 * the HUD and then draws the page), so a reader in the same task never gets the layout from before.
 */
export function setLayoutSource(fn: (() => ScreenLayout | null) | null, pending: (() => boolean) | null = null): void {
  source = fn;
  pendingChange = pending;
  dirty = true;
}

/** The layout changed: the next `screenLayout()` measures again. */
export function invalidateLayout(): void {
  dirty = true;
}

/** Set the layout directly (tests). */
export function setScreenLayout(l: ScreenLayout | null): void {
  source = null;
  pendingChange = null;
  cached = l;
  dirty = false;
}

/** The current screen furniture in css px, or null when nothing measured it (tests, before boot). */
export function screenLayout(): ScreenLayout | null {
  if (!dirty && pendingChange?.()) dirty = true;
  if (dirty && source) {
    cached = source();
    dirty = false;
  }
  return cached;
}

/** A css-px rectangle on screen as world units, for a camera showing `view` at `zoom` css px per unit. Pure. */
export function cssToWorld(b: Box, view: Pick<Box, 'x0' | 'y0'>, zoom: number): Box {
  const z = zoom > 0 ? zoom : 1;
  return { x0: view.x0 + b.x0 / z, y0: view.y0 + b.y0 / z, x1: view.x0 + b.x1 / z, y1: view.y0 + b.y1 / z };
}

export function overlaps(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

export function inflate(b: Box, m: number): Box {
  return { x0: b.x0 - m, y0: b.y0 - m, x1: b.x1 + m, y1: b.y1 + m };
}

/** How far to move the span [lo, hi] so it lies inside [min, max]; a span wider than the room is put at `min`. Pure. */
export function shiftInto(lo: number, hi: number, min: number, max: number): number {
  if (hi - lo >= max - min) return min - lo;
  if (lo < min) return min - lo;
  if (hi > max) return max - hi;
  return 0;
}

const DEPTH = 3;

/**
 * The smallest move [dx, dy] that puts `box` inside `free` and off every one of `blocks`: first shifted into `free`, then,
 * while it lies under a block, moved just past that block's nearest side (left, right, above or below) and back into
 * `free`, up to three blocks deep; the shortest clear move wins. When no move clears them all, the box is only kept
 * inside `free`. Pure.
 */
export function avoidBoxes(box: Box, free: Box, blocks: readonly Box[]): [number, number] {
  const at = (dx: number, dy: number): Box => ({ x0: box.x0 + dx, y0: box.y0 + dy, x1: box.x1 + dx, y1: box.y1 + dy });
  const fit = (dx: number, dy: number): [number, number] => {
    const b = at(dx, dy);
    return [dx + shiftInto(b.x0, b.x1, free.x0, free.x1), dy + shiftInto(b.y0, b.y1, free.y0, free.y1)];
  };
  const under = (dx: number, dy: number): Box[] => {
    const b = at(dx, dy);
    return blocks.filter((k) => overlaps(b, k));
  };
  const base = fit(0, 0);
  if (under(base[0], base[1]).length === 0) return base;
  let best: [number, number] | null = null;
  let bestCost = Infinity;
  let frontier: [number, number][] = [base];
  for (let depth = 0; depth < DEPTH && frontier.length > 0; depth++) {
    const next: [number, number][] = [];
    for (const [dx, dy] of frontier) {
      const b = at(dx, dy);
      for (const k of under(dx, dy)) {
        for (const [mx, my] of [
          [k.x0 - b.x1, 0],
          [k.x1 - b.x0, 0],
          [0, k.y0 - b.y1],
          [0, k.y1 - b.y0],
        ] as const) {
          const m = fit(dx + mx, dy + my);
          const cost = Math.hypot(m[0], m[1]);
          if (cost >= bestCost) continue;
          if (under(m[0], m[1]).length === 0) {
            best = m;
            bestCost = cost;
          } else if (next.length < 64) next.push(m);
        }
      }
    }
    frontier = next;
  }
  return best ?? base;
}
