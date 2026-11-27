/**
 * The reply strip of a boss argument (DESIGN 5.4): three boxed Space Mono buttons in the margin, each with the reply and,
 * beneath it in small type, the kind of damage it argues with. Built on `spor:posted`; a wrong reply is struck in red where
 * it stands; the strip stays 600 ms after an answer and is removed; it goes at once when the comment runs out or the boss falls.
 * The strip lives in `#ui`, a sibling of the stage, so a tap on a button never reaches the joystick or the walking input;
 * the strip itself lets pointers through everywhere between the buttons.
 */
import { answerSpor } from '../combat/spor';
import type { Bus } from '../core/events';
import { invalidateLayout } from '../render/keepOut';
import { t } from '../i18n';
import type { RunState } from '../world/run';
import { h } from './dom';

export interface SporStrip {
  el: HTMLElement;
}

/** The strip steps up this many px at a time while it looks for a stand clear of the hero and the boss. */
const STEP = 12;
/** A figure's bounding box is grown by this much: the strip keeps a little air from the hero's feet and the boss's bubbles. */
const AIR = 6;

interface Rect {
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** How much covering it costs against the others (the hero counts for more than a boss's whole box, which reaches over its bubbles and props). */
  weight?: number;
}

/**
 * Portrait: the lowest stand (`bottom` in css px) from `lowest` up to where the strip's top would meet `ceiling`, at which the strip of
 * height `h` and the horizontal span [left, right] covers none of the `figures`; when no stand is clear, the one that covers least.
 * Pure: the caller measures. DESIGN 5.4 (the boss, its bubbles and the hero stay readable while the replies are up).
 */
export function clearStand(viewH: number, h: number, left: number, right: number, lowest: number, ceiling: number, figures: readonly Rect[]): number {
  let best = lowest;
  let bestArea = Infinity;
  for (let bottom = lowest; viewH - bottom - h >= ceiling; bottom += STEP) {
    const top = viewH - bottom - h;
    const bot = viewH - bottom;
    let area = 0;
    for (const f of figures) {
      const w = Math.min(right, f.right + AIR) - Math.max(left, f.left - AIR);
      const v = Math.min(bot, f.bottom + AIR) - Math.max(top, f.top - AIR);
      if (w > 0 && v > 0) area += w * v * (f.weight ?? 1);
    }
    if (area === 0) return bottom;
    if (area < bestArea) {
      bestArea = area;
      best = bottom;
    }
  }
  return best;
}

/** `state` is read on every use: the live RunState is replaced by every ticket and every tunnel return. */
export function createSpor(root: HTMLElement, bus: Bus, state: () => RunState | null): SporStrip {
  const el = h('div', 'spor');
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', t('combat.spor.label'));
  root.append(el);

  const clear = (): void => {
    el.classList.remove('closing', 'done');
    el.style.removeProperty('bottom');
    el.replaceChildren();
  };
  /** Portrait: lift the strip off the boss and the hero (landscape has its own column and keeps it). Measured once per prompt, on the next frame. */
  const stand = (): void => {
    if (el.childElementCount === 0 || document.documentElement.dataset['orient'] === 'landscape') return;
    el.style.removeProperty('bottom');
    const box = el.getBoundingClientRect();
    if (box.height === 0) return;
    const s = state();
    const figures: Rect[] = [];
    const take = (sel: string, weight: number): void => {
      const n = document.querySelector(sel);
      if (!n) return;
      const r = n.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) figures.push({ top: r.top, bottom: r.bottom, left: r.left, right: r.right, weight });
    };
    if (s) {
      take(`[data-kind="player"]`, 6);
      for (const e of s.enemies) if (e.boss) take(`[data-kind="enemy"][data-id="${e.id}"]`, 1);
    }
    const hud = document.querySelector('.hud')?.getBoundingClientRect();
    const ceiling = (hud ? hud.bottom : 64) + 58; // under the margin notes that hang from the HUD
    const lowest = window.innerHeight - box.bottom;
    const at = clearStand(window.innerHeight, box.height, box.left, box.right, lowest, ceiling, figures);
    if (at !== lowest) {
      el.style.bottom = `${at}px`;
      invalidateLayout(); // the strip moved without changing size: bubbles and stamps keep off its new stand
    }
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
    requestAnimationFrame(stand);
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
