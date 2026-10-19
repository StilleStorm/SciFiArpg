import { t } from '../i18n';
import { h } from './dom';
import './sheet.css';

export interface Sheet {
  el: HTMLElement;
  /** Right side of the header (under the close button's row), for status words. */
  sub: HTMLElement;
  scroll: HTMLElement;
  /** Add a numbered note to the sheet's own footnote area (the page footnotes are covered). */
  note(text: string): void;
  setTitle(text: string): void;
  remove(): void;
}

export interface SheetOptions {
  title: string;
  sub?: string;
  onClose(): void;
}

/** A full-page sheet: frame, header with a "Zamknij" link, a scrolling body and a footnote area. */
export function createSheet(root: HTMLElement, opts: SheetOptions): Sheet {
  const el = h('div', 'ps');
  const frame = h('div', 'ps-frame');
  const head = h('div', 'ps-head');
  const titles = h('div');
  const title = h('h2', 'ps-title', opts.title);
  const sub = h('p', 'ps-sub', opts.sub ?? '');
  titles.append(title, sub);
  const close = h('button', 'ps-close', t('items.ui.close'));
  close.type = 'button';
  close.addEventListener('click', opts.onClose);
  head.append(titles, close);
  const scroll = h('div', 'ps-scroll');
  const notes = h('div', 'ps-notes');
  // printed under the cut while the body runs on below it, so a line sliced by the rule reads as a page that continues
  const more = h('span', 'ps-more', t('ui.sheet.more'));
  more.hidden = true;
  notes.append(more);
  frame.append(head, scroll, notes);
  el.append(frame);
  root.append(el);
  let queued = false;
  const place = (): void => {
    queued = false;
    more.hidden = !runsOn(scroll.scrollTop, scroll.clientHeight, scroll.scrollHeight);
    if (more.hidden) return;
    // the strip starts at the top of the first printed line the body's edge would slice, so no line shows half a glyph
    const bottom = scroll.getBoundingClientRect().bottom;
    // the strip hangs from the notes' rule (their top border) up to the edge, across the gap between body and notes
    const rule = notes.getBoundingClientRect().top;
    const edge = cutEdge(lineBoxes(scroll, bottom), Math.min(bottom, rule - CUE_ROOM));
    const tall = Math.round(rule - edge);
    more.style.height = `${tall}px`;
    more.style.top = `${-tall - 1}px`;
    more.style.paddingTop = `${Math.max(0, tall - CUE_ROOM)}px`;
  };
  const cue = (): void => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(place);
  };
  scroll.addEventListener('scroll', cue, { passive: true });
  new MutationObserver(cue).observe(scroll, { childList: true, subtree: true });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(cue).observe(scroll);
  let count = 0;
  return {
    el,
    sub,
    scroll,
    note(text) {
      count++;
      const p = h('p', 'fn');
      p.append(h('sup', '', String(count)), document.createTextNode(text));
      notes.append(p);
      while (notes.querySelectorAll('.fn').length > 2) notes.querySelector('.fn')?.remove();
    },
    setTitle(text) {
      title.textContent = text;
    },
    remove() {
      el.remove();
    },
  };
}

/** Room the cue's own words need above the notes' rule, in px (one 13 px mono line). */
const CUE_ROOM = 13;

/** The line boxes of the text (and the drawings) near the foot of a scrolled body (only those reaching within 80 px of its edge). */
function lineBoxes(scroll: HTMLElement, bottom: number): { top: number; bottom: number }[] {
  const out: { top: number; bottom: number }[] = [];
  const walk = document.createTreeWalker(scroll, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (!n.textContent?.trim()) continue;
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) if (r.bottom > bottom - 80 && r.top < bottom) out.push({ top: r.top, bottom: r.bottom });
  }
  // drawings (a stamp, the slips) are cut whole or not at all
  for (const g of scroll.querySelectorAll('svg')) {
    const r = g.getBoundingClientRect();
    if (r.height > 0 && r.bottom > bottom - 80 && r.top < bottom) out.push({ top: r.top, bottom: r.bottom });
  }
  return out;
}

/**
 * Where the cue strip starts: the lowest height at or above `max` that slices no printed line (a line's top or bottom,
 * or `max` itself when it falls between lines). Columns side by side are handled together, line by line.
 */
export function cutEdge(lines: readonly { top: number; bottom: number }[], max: number): number {
  const cands = [max];
  for (const l of lines) {
    if (l.top <= max) cands.push(l.top);
    if (l.bottom <= max) cands.push(l.bottom);
  }
  cands.sort((x, y) => y - x);
  // a line box overhangs its ink by a couple of px, so a cut that close to its top or bottom slices nothing visible
  for (const e of cands) if (!lines.some((l) => l.top < e - 2 && l.bottom > e + 2)) return e;
  return max;
}

/** True while a scrolled body has more than a sliver left below its visible part. */
export function runsOn(top: number, visible: number, total: number): boolean {
  return top + visible < total - 6;
}

/** 4,5 and a real minus sign. */
export function num(n: number): string {
  const r = Math.round(n * 10) / 10;
  return String(r).replace('.', ',').replace('-', '−');
}

export function signed(n: number): string {
  if (n === 0) return '0';
  return (n > 0 ? '+' : '') + num(n);
}

/** The mouse events that follow a touch come this soon after its pointerup. */
const TAIL_MS = 700;

/** What the ghost-click guard needs of a DOM node (structural, so the decision is testable without a DOM). */
export interface GuardNode {
  readonly isConnected: boolean;
  contains(other: GuardNode | null): boolean;
}

/** A press as the guard remembers it: the pressed element, its ancestors at the moment of the press, when it was let go. */
export interface Press<N extends GuardNode = GuardNode> {
  pressed: N;
  /** The pressed element and its ancestors, taken at pointerdown (they may leave the page afterwards). */
  path: readonly N[];
  upAt: number;
}

/**
 * True when a trusted mouse event at `at` on `target` is the ghost of `press`, i.e. it lands on something that did not hold
 * the pressed element. While the pressed element is on the page, the event belongs to the press when its target holds or
 * is held by it. When the pressed element has left the page (the tap removed or re-rendered it), only its old ancestors
 * may take the event: a sheet line that appeared under the finger was in no such path, and its click is a ghost.
 */
export function isGhostOf<N extends GuardNode>(press: Press<N> | null, target: N | null, at: number): boolean {
  if (!press || !target || at - press.upAt > TAIL_MS) return false;
  const { pressed } = press;
  if (pressed.isConnected) return !(pressed === target || pressed.contains(target) || target.contains(pressed));
  return !press.path.includes(target);
}

/**
 * A finger that opens a sheet on pointerdown (the Pauza note, a station tapped in tap mode) is still on the glass when the
 * sheet appears. The browser then sends the compatibility mousedown / mouseup / click of that same tap to whatever is under
 * the finger now, which is a button of the new sheet (Wznów, Ustawienia, Zamknij ...), and that button fires at once: the
 * sheet opens and shuts again, or opens the wrong line. A mouse or touch event in the tail of a press is honoured only when
 * it belongs to it (`isGhostOf`). Script clicks pass; keyboard and accessibility clicks pass because no press is in the tail.
 * The click a tap leaves behind can carry detail 0 (Chromium's touch emulation sends it alone, after the pointerup), so detail
 * says nothing.
 * Returns the function that takes the guard off.
 */
export function guardGhostClicks(doc: Document = document): () => void {
  let press: Press<Node> | null = null;
  const onDown = (ev: Event): void => {
    const pressed = ev.target instanceof Node ? ev.target : null;
    const path = ev.composedPath().filter((n): n is Node => n instanceof Node);
    press = pressed ? { pressed, path, upAt: Infinity } : null;
  };
  const onUp = (ev: Event): void => {
    if (press) press.upAt = ev.timeStamp;
  };
  const onMouse = (ev: Event): void => {
    const me = ev as MouseEvent;
    if (!me.isTrusted) return; // a script click; a keyboard click has no press in its tail (a tap's own click may carry detail 0)
    const target = me.target instanceof Node ? me.target : null;
    if (!isGhostOf(press, target, me.timeStamp)) return;
    me.stopImmediatePropagation();
    me.preventDefault();
  };
  const mouse = ['mousedown', 'mouseup', 'click'];
  doc.addEventListener('pointerdown', onDown, true);
  doc.addEventListener('pointerup', onUp, true);
  doc.addEventListener('pointercancel', onUp, true);
  for (const type of mouse) doc.addEventListener(type, onMouse, true);
  return () => {
    doc.removeEventListener('pointerdown', onDown, true);
    doc.removeEventListener('pointerup', onUp, true);
    doc.removeEventListener('pointercancel', onUp, true);
    for (const type of mouse) doc.removeEventListener(type, onMouse, true);
  };
}
