import { t } from '../i18n';
import { tween } from '../render/tween';
import { h } from './dom';
import { openPopup, type Popup } from './popup';

const VISIBLE = 3;
const HISTORY = 10;
/** A note longer than this (characters) is shown whole: the slip grows upward for it until the next note (only the finale's closing note is). */
export const LONG_NOTE = 200;
/**
 * How long a long note is alone on the slip (ms): notes printed meanwhile (the unique picked up after the finale's stamp) wait and
 * are printed after it, so the long one is read whole and last. They are in the history sheet at once.
 */
export const LONG_HOLD_MS = 12000;
/** A click this soon after the history opened is the tail of the tap that opened it. */
const OPEN_GUARD_MS = 350;

export interface Footnotes {
  el: HTMLElement;
  /** Add a footnote; returns its number (continuous within a run). */
  add(text: string): number;
  reset(): void;
  /** Close the history sheet if it is open. */
  closeHistory(): void;
  /** Open the last ten notes as a sheet (a tap on the slip). False when there is nothing to show. */
  openHistory(): boolean;
  /** The slip is on screen and covers client point (x, y): joystick mode routes its quick taps here (the slip lets pointers through). */
  hits(clientX: number, clientY: number): boolean;
  /** The most recent notes, oldest first. */
  recent(n?: number): { n: number; text: string }[];
  readonly count: number;
}

let instance: Footnotes | null = null;

/**
 * The bottom of the page: numbered notes, newest at the bottom, at most three visible, older ones slide off.
 * Tapping the area opens the last ten as a sheet. In joystick mode the slip lets pointers through to the stage (a thumb
 * that lands on it steers) and the quick tap reaches `openHistory` through the input instead (ui/landscape.css, main.ts).
 */
export function createFootnotes(root: HTMLElement): Footnotes {
  const el = h('div', 'foot paper');
  // the notes sit in their own box under the slip's short rule, so an older note pushed out of the top is clipped below the
  // rule and never shows through it (a line through a note would read as struck out)
  const list = h('div', 'fn-list');
  el.append(list);
  const log: { n: number; text: string }[] = [];
  let count = 0;
  let sheet: Popup | null = null;
  /** A long note is alone on the slip until this tween (render frames, no game state) lets the notes that waited for it through; its cancel. */
  let held: (() => void) | null = null;
  const waiting: { n: number; text: string }[] = [];

  const line = (n: number, text: string): HTMLElement => {
    const p = h('p', 'fn');
    p.append(h('sup', '', String(n)), document.createTextNode(text));
    return p;
  };

  /**
   * Only whole notes stay on the slip: an older one that no longer fits is taken off, never shown cut in half (the list is
   * bottom-aligned, so an overflowing note sticks out of its top edge). Measured once on the next frame, when the new
   * note is laid out; never per frame.
   */
  let pruneQueued = false;
  const prune = (): void => {
    pruneQueued = false;
    const top = list.getBoundingClientRect().top;
    while (list.children.length > 1 && (list.firstElementChild?.getBoundingClientRect().top ?? top) < top - 1) list.firstElementChild?.remove();
  };
  const queuePrune = (): void => {
    if (pruneQueued) return;
    pruneQueued = true;
    requestAnimationFrame(prune);
  };
  // a note can grow after it was printed: the serif arrives late on the first notes, a rotation narrows the slip
  document.fonts.addEventListener('loadingdone', queuePrune);
  window.addEventListener('resize', queuePrune);
  // the print size (settings) zooms the list and grows the slip: refit then too
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(queuePrune).observe(list);

  const show = (n: number, text: string): void => {
    const p = line(n, text);
    p.classList.add('fresh');
    p.addEventListener('animationend', queuePrune, { once: true }); // measured again once the note has settled
    const long = text.length > LONG_NOTE;
    el.classList.toggle('fn-long', long);
    if (long) {
      list.replaceChildren(p); // alone, whole, and the last thing read
      held = tween(1, () => undefined, { delay: LONG_HOLD_MS, done: () => release(true) });
    } else {
      list.append(p);
      while (list.children.length > VISIBLE) list.firstElementChild?.remove();
    }
    queuePrune();
  };
  /** End the hold: print what waited (`print`), or drop it (a new slip). */
  function release(print: boolean): void {
    held?.();
    held = null;
    const w = waiting.splice(0);
    if (!print) return;
    for (const x of w) {
      // a long note among them holds the slip again: the rest wait for it in turn
      if (held === null) show(x.n, x.text);
      else waiting.push(x);
    }
  }

  const fn: Footnotes = {
    el,
    add(text) {
      count++;
      log.push({ n: count, text });
      if (log.length > 60) log.shift();
      // a long note is being read: what comes meanwhile (the unique picked up after the finale's stamp) waits its turn; it is in the history at once
      if (held) waiting.push({ n: count, text });
      else show(count, text);
      return count;
    },
    reset() {
      count = 0;
      log.length = 0;
      list.replaceChildren();
      el.classList.remove('fn-long');
      release(false);
      sheet?.close();
    },
    closeHistory() {
      sheet?.close();
    },
    openHistory() {
      if (log.length === 0) return false;
      sheet?.close();
      const body = h('div', 'fn-history');
      for (const e of fn.recent()) body.append(line(e.n, e.text));
      sheet = openPopup(root, { title: t('ui.notes.history'), className: 'pop-history', body: [body], tapToClose: true, onClose: () => (sheet = null) });
      // opened by a quick tap through the stage (joystick mode), the same tap's click lands on the sheet: it must not close it
      const openedAt = performance.now();
      sheet.el.addEventListener(
        'click',
        (ev) => {
          if (performance.now() - openedAt < OPEN_GUARD_MS) ev.stopImmediatePropagation();
        },
        { capture: true },
      );
      return true;
    },
    hits(x, y) {
      if (el.classList.contains('hidden') || log.length === 0) return false;
      const r = el.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    },
    recent(n = HISTORY) {
      return log.slice(-n);
    },
    get count() {
      return count;
    },
  };

  el.addEventListener('click', () => void fn.openHistory());

  root.append(el);
  instance = fn;
  return fn;
}

/** Add a footnote to the page that was created last. No-op before the UI exists. */
export function addFootnote(text: string): number {
  return instance?.add(text) ?? 0;
}
