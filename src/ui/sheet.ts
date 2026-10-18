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
  frame.append(head, scroll, notes);
  el.append(frame);
  root.append(el);
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
      while (notes.children.length > 2) notes.firstElementChild?.remove();
    },
    setTitle(text) {
      title.textContent = text;
    },
    remove() {
      el.remove();
    },
  };
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

/**
 * A finger that opens a sheet on pointerdown (the Pauza note, a station tapped in tap mode) is still on the glass when the
 * sheet appears. The browser then sends the compatibility mousedown / mouseup / click of that same tap to whatever is under
 * the finger now, which is a button of the new sheet (Wznów, Ustawienia, Zamknij ...), and that button fires at once: the
 * sheet opens and shuts again, or opens the wrong line. A mouse or touch event in the tail of a press is honoured only when
 * it belongs to it: its target holds, or is held by, the element that was pressed. Keyboard, accessibility and script clicks
 * (no press just before, or detail 0) and presses whose element has left the page pass. Returns the function that takes the
 * guard off.
 */
export function guardGhostClicks(doc: Document = document): () => void {
  let pressed: Node | null = null;
  let upAt = -Infinity;
  const onDown = (ev: Event): void => {
    pressed = ev.target instanceof Node ? ev.target : null;
    upAt = Infinity;
  };
  const onUp = (ev: Event): void => {
    upAt = ev.timeStamp;
  };
  const onMouse = (ev: Event): void => {
    const me = ev as MouseEvent;
    if (!me.isTrusted || (me.type === 'click' && me.detail === 0)) return;
    const target = me.target instanceof Node ? me.target : null;
    if (!pressed || !target || !pressed.isConnected || me.timeStamp - upAt > TAIL_MS) return;
    if (pressed === target || pressed.contains(target) || target.contains(pressed)) return;
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
