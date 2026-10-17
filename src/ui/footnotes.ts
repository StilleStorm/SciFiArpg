import { h } from './dom';

const VISIBLE = 3;

export interface Footnotes {
  el: HTMLElement;
  add(text: string): void;
  reset(): void;
}

let instance: Footnotes | null = null;

/** The bottom of the page: numbered notes, newest appended, at most three visible. */
export function createFootnotes(root: HTMLElement): Footnotes {
  const el = h('div', 'foot paper');
  let count = 0;
  const fn: Footnotes = {
    el,
    add(text) {
      count++;
      const p = h('p', 'fn');
      p.append(h('sup', '', String(count)), document.createTextNode(text));
      el.append(p);
      while (el.children.length > VISIBLE) el.firstElementChild?.remove();
    },
    reset() {
      count = 0;
      el.replaceChildren();
    },
  };
  root.append(el);
  instance = fn;
  return fn;
}

/** Add a footnote to the page that was created last. No-op before the UI exists. */
export function addFootnote(text: string): void {
  instance?.add(text);
}
