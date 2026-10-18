/**
 * The reply strip of a boss argument (DESIGN 5.4): three boxed Space Mono buttons in the margin, each with the reply and,
 * beneath it in small type, the kind of damage it argues with. Built on `spor:posted`; a wrong reply is struck in red where
 * it stands; the strip stays 600 ms after an answer and is removed; it goes at once when the comment runs out or the boss falls.
 * The strip lives in `#ui`, a sibling of the stage, so a tap on a button never reaches the joystick or the walking input;
 * the strip itself lets pointers through everywhere between the buttons.
 */
import { answerSpor } from '../combat/spor';
import type { Bus } from '../core/events';
import { t } from '../i18n';
import type { RunState } from '../world/run';
import { h } from './dom';

export interface SporStrip {
  el: HTMLElement;
}

/** `state` is read on every use: the live RunState is replaced by every ticket and every tunnel return. */
export function createSpor(root: HTMLElement, bus: Bus, state: () => RunState | null): SporStrip {
  const el = h('div', 'spor');
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', t('combat.spor.label'));
  root.append(el);

  const clear = (): void => {
    el.classList.remove('closing', 'done');
    el.replaceChildren();
  };
  // the 600 ms hold is a CSS animation: no timer, and it only runs while the strip is on screen
  el.addEventListener('animationend', (ev) => {
    if (ev.target === el && el.classList.contains('closing')) clear();
  });

  const buttons = (): HTMLButtonElement[] => [...el.querySelectorAll<HTMLButtonElement>('.spor-reply')];

  const build = (keys: readonly string[]): void => {
    clear();
    const types = state()?.spor?.prompt?.replies;
    keys.forEach((key, i) => {
      const b = h('button', 'spor-reply');
      b.type = 'button';
      b.dataset['reply'] = String(i);
      b.append(h('span', 'sp-text', t(key)));
      const type = types?.[i]?.type;
      if (type) b.append(h('span', 'sp-type', t(`combat.type.${type}`)));
      // stopPropagation: nothing under the strip may see the press as a steering touch
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.addEventListener('click', () => {
        const s = state();
        if (s && (i === 0 || i === 1 || i === 2)) answerSpor(s, bus, i);
      });
      el.append(b);
    });
  };
  bus.on('spor:posted', (ev) => build(ev.replies));
  // a prompt held in the tunnel with its run is still up when the player comes back
  bus.on('tunnel:returned', () => {
    const prompt = state()?.spor?.prompt;
    if (prompt) build(prompt.replies.map((r) => r.textKey));
  });
  bus.on('spor:answered', (ev) => {
    el.classList.add('done');
    buttons().forEach((b, i) => {
      b.disabled = true;
      if (i === ev.index) b.classList.add(ev.right ? 'picked' : 'wrong');
    });
  });
  bus.on('spor:closed', (ev) => {
    if (ev.reason === 'answered') el.classList.add('closing');
    else clear();
  });
  for (const name of ['run:started', 'base:entered', 'screen:changed'] as const) bus.on(name, clear);

  return { el };
}
