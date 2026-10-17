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
