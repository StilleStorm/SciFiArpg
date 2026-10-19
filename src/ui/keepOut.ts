/**
 * Measures what the screen furniture covers (render/keepOut.ts) from the DOM, once per layout change: a window resize, an
 * orientation or steering change, the left-handed mirror, the text size, a note, pad or the update line shown or hidden,
 * the HUD or the footnote band changing size. Nothing is measured per frame: an observer only marks the layout stale and
 * the next reader measures it.
 */
import { invalidateLayout, setLayoutSource, type Box, type ScreenLayout } from '../render/keepOut';

/** The margin notes hanging on the HUD (ui/pause.css, ui/tunnel.css, ui/potw.css). */
const NOTES = ['.pause-btn', '.tunnel-btn', '.potw-btn'];
/** Class tokens that only repaint (cooldown, ready, a fresh footnote): they never move anything. */
const PAINT_ONLY = new Set(['cooling', 'ready', 'off', 'fresh', 'full', 'empty', 'held', 'aiming', 'pressed']);

const rectOf = (n: Element): Box | null => {
  const r = n.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  return { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom };
};

const union = (a: Box | null, b: Box | null): Box | null =>
  !a ? b : !b ? a : { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };

/** One measurement of `ui` (the #ui layer) in css px. */
export function measureLayout(ui: HTMLElement): ScreenLayout {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const blocks: Box[] = [];
  let top = 0;
  let bottom = h;
  const hud = ui.querySelector('.hud');
  const hudBox = hud ? rectOf(hud) : null;
  if (hudBox) {
    if (hudBox.x1 - hudBox.x0 >= w * 0.6) top = hudBox.y1;
    else blocks.push(hudBox);
  }
  const foot = ui.querySelector('.foot');
  const footBox = foot ? rectOf(foot) : null;
  if (footBox) {
    if (footBox.x1 - footBox.x0 >= w * 0.6) bottom = footBox.y0;
    else blocks.push(footBox);
  }
  ui.querySelectorAll('.pad, .upd').forEach((n) => {
    const b = rectOf(n);
    if (b) blocks.push(b);
  });
  // The note row as the run shows it: a note put away in the base is measured where it hangs in the run, so the header
  // printed when the run starts from the base keeps clear of it too (the class is put back at once, before any paint).
  let row: Box | null = null;
  const hidden: Element[] = [];
  for (const sel of NOTES) {
    const n = ui.querySelector(sel);
    if (!n) continue;
    const b = rectOf(n);
    if (b) {
      blocks.push(b);
      row = union(row, b);
    } else if (n.classList.contains('hidden')) hidden.push(n);
  }
  if (hidden.length > 0 && hudBox) {
    for (const n of hidden) n.classList.remove('hidden');
    for (const n of hidden) row = union(row, rectOf(n));
    for (const n of hidden) n.classList.add('hidden');
  }
  // a pad hung in the same corner as the row (portrait with the joystick: Załączniki over the notes) is part of it
  if (row) {
    const r = row;
    ui.querySelectorAll('.pad').forEach((n) => {
      const b = rectOf(n);
      if (b && b.y0 < r.y1 + 12 && b.y1 > r.y0 - 90 && b.x0 < r.x1 && b.x1 > r.x0) row = union(row, b);
    });
  }
  return { w, h, top, bottom, blocks, row };
}

/** Wire the measurement to the DOM; call once at boot with the #ui layer. */
export function watchLayout(ui: HTMLElement): void {
  const moved = (r: MutationRecord): boolean => {
    const el = r.target as Element;
    if (el.closest('.joy, .foot')) return false; // the joystick and the footnotes come and go without moving the furniture
    const before = new Set((r.oldValue ?? '').split(/\s+/).filter((c) => c && !PAINT_ONLY.has(c)));
    const after = [...el.classList].filter((c) => !PAINT_ONLY.has(c));
    return after.length !== before.size || after.some((c) => !before.has(c));
  };
  // classes anywhere in #ui (a note, pad or the update line shown or hidden, the left-handed mirror), and the <html> attributes
  // the layout reads; a sheet added to #ui is not furniture, the furniture is built once at boot
  const classes = new MutationObserver((records) => {
    if (records.some(moved)) invalidateLayout();
  });
  const root = new MutationObserver(() => invalidateLayout());
  const ro = new ResizeObserver(() => invalidateLayout());
  setLayoutSource(
    () => {
      const l = measureLayout(ui);
      classes.takeRecords(); // the measurement's own class flips (the hidden notes) are not a layout change
      for (const sel of ['.hud', '.foot']) {
        const n = ui.querySelector(sel);
        if (n) ro.observe(n);
      }
      return l;
    },
    () => classes.takeRecords().some(moved) || root.takeRecords().length > 0,
  );
  classes.observe(ui, { attributes: true, attributeFilter: ['class'], attributeOldValue: true, subtree: true });
  root.observe(document.documentElement, { attributes: true, attributeFilter: ['data-orient', 'data-steer', 'style'] });
  window.addEventListener('resize', invalidateLayout);
}
