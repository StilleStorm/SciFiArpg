import { h } from './dom';

export interface PopupButton {
  label: string;
  onClick(): void;
  /** Quiet buttons are typed links; the default is a boxed form button. */
  quiet?: boolean;
}

export interface PopupOptions {
  title?: string;
  /** Extra class on the popup (for layout variants). */
  className?: string;
  body: (Node | string)[];
  buttons?: PopupButton[];
  /** Tapping the popup closes it (footnote history). */
  tapToClose?: boolean;
  onClose?(): void;
}

export interface Popup {
  el: HTMLElement;
  close(): void;
}

/**
 * A small printed form laid over the page: cookie banner, update notice, footnote history.
 * Paper, a double frame, no dimming and no shadow. (The full-page sheets of Zalaczniki and Sklep are ui/sheet.ts.)
 */
export function openPopup(root: HTMLElement, opts: PopupOptions): Popup {
  const wrap = h('div', 'pop-wrap');
  const pop = h('div', `pop paper ${opts.className ?? ''}`.trim());
  if (opts.title) pop.append(h('h2', 'pop-title', opts.title));
  for (const part of opts.body) pop.append(typeof part === 'string' ? h('p', 'pop-body', part) : part);
  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    wrap.remove();
    opts.onClose?.();
  };
  if (opts.buttons?.length) {
    const row = h('div', 'pop-buttons');
    for (const b of opts.buttons) {
      const btn = h('button', b.quiet ? 'link-btn' : 'form-btn', b.label);
      btn.type = 'button';
      btn.addEventListener('click', b.onClick);
      row.append(btn);
    }
    pop.append(row);
  }
  if (opts.tapToClose) wrap.addEventListener('click', close);
  wrap.append(pop);
  root.append(wrap);
  return { el: wrap, close };
}
