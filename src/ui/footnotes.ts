import { t } from '../i18n';
import { h } from './dom';
import { openPopup, type Popup } from './popup';

const VISIBLE = 3;
const HISTORY = 10;

export interface Footnotes {
  el: HTMLElement;
  /** Add a footnote; returns its number (continuous within a run). */
  add(text: string): number;
  reset(): void;
  /** Close the history sheet if it is open. */
  closeHistory(): void;
  /** The most recent notes, oldest first. */
  recent(n?: number): { n: number; text: string }[];
  readonly count: number;
}

let instance: Footnotes | null = null;

/**
 * The bottom of the page: numbered notes, newest at the bottom, at most three visible, older ones slide off.
 * Tapping the area opens the last ten as a sheet.
 */
export function createFootnotes(root: HTMLElement): Footnotes {
  const el = h('div', 'foot paper');
  const log: { n: number; text: string }[] = [];
  let count = 0;
  let sheet: Popup | null = null;

  const line = (n: number, text: string): HTMLElement => {
    const p = h('p', 'fn');
    p.append(h('sup', '', String(n)), document.createTextNode(text));
    return p;
  };

  const fn: Footnotes = {
    el,
    add(text) {
      count++;
      log.push({ n: count, text });
      if (log.length > 60) log.shift();
      const p = line(count, text);
      p.classList.add('fresh');
      el.append(p);
      while (el.children.length > VISIBLE) el.firstElementChild?.remove();
      return count;
    },
    reset() {
      count = 0;
      log.length = 0;
      el.replaceChildren();
      sheet?.close();
    },
    closeHistory() {
      sheet?.close();
    },
    recent(n = HISTORY) {
      return log.slice(-n);
    },
    get count() {
      return count;
    },
  };

  el.addEventListener('click', () => {
    if (log.length === 0) return;
    sheet?.close();
    const body = h('div', 'fn-history');
    for (const e of fn.recent()) body.append(line(e.n, e.text));
    sheet = openPopup(root, { title: t('ui.notes.history'), className: 'pop-history', body: [body], tapToClose: true, onClose: () => (sheet = null) });
  });

  root.append(el);
  instance = fn;
  return fn;
}

/** Add a footnote to the page that was created last. No-op before the UI exists. */
export function addFootnote(text: string): number {
  return instance?.add(text) ?? 0;
}
