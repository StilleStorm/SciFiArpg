/**
 * Pause (DESIGN 2, 4.1). Two pieces: the margin note "Pauza" that hangs on the HUD, and the pause sheet, a printed form
 * with up to four lines: Wznów, Ustawienia, Umiejętności, Zakończ zgłoszenie. The sheet owns no rules: it only calls back. The router
 * (main.ts) pauses the game, shows the sheet, opens the settings in place and takes the run to the base.
 */
import { createRng } from '../core/rng';
import { t } from '../i18n';
import { el, wobblyCircle } from '../render/svg';
import { h } from './dom';
import { createSheet, type Sheet } from './sheet';
import './pause.css';

/** A click this soon after a pointerdown on the note is the tail of that press. */
const CLICK_AFTER_PRESS_MS = 700;

/**
 * The pause note: a circled word, a 44 x 44 tap target. Like the skill pads it answers the finger going down, so it
 * works with another thumb already on the joystick; a lone click (keyboard, script) still pauses.
 */
export function createPauseButton(onPause: () => void): HTMLButtonElement {
  const btn = h('button', 'pause-btn');
  btn.type = 'button';
  btn.setAttribute('aria-label', t('ui.hud.pauseLabel'));
  const rng = createRng(91);
  const svg = el('svg', { viewBox: '-22 -22 44 44', 'aria-hidden': 'true' });
  svg.append(el('path', { d: wobblyCircle(rng, 0, 0, 20.5, 11, 0.03) }), el('path', { d: wobblyCircle(rng, 0.5, -0.4, 19, 9, 0.035), 'stroke-width': 0.9 }));
  btn.append(svg, h('span', 'word', t('ui.hud.pause')));
  let pressedAt = -Infinity;
  btn.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    pressedAt = performance.now();
    onPause();
  });
  btn.addEventListener('click', () => {
    if (performance.now() - pressedAt < CLICK_AFTER_PRESS_MS) return;
    onPause();
  });
  return btn;
}

export interface PauseInfo {
  number: number;
  planet: string;
  /** 1-based page number and the page count of the planet. */
  page: number;
  total: number;
  /** The player is in the base: there is no ticket in progress to end, so "Zakończ zgłoszenie" is not offered. */
  base?: boolean;
}

export interface PauseHandlers {
  onResume(): void;
  onSettings(): void;
  /** The line "Umiejętności": the loadout sheet (run and base). */
  onSkills(): void;
  onEnd(): void;
}

export interface PauseSheet {
  open(info: PauseInfo): void;
  /** Remove the sheet. */
  close(): void;
  /** Hide it without losing it (the settings stand over it) or bring it back. */
  setHidden(hidden: boolean): void;
  isOpen(): boolean;
}

function line(label: string, note: string, onTap: () => void, id: string): HTMLElement {
  const wrap = h('div', 'pz-line');
  const btn = h('button', 'pz-btn', label);
  btn.type = 'button';
  btn.dataset['pause'] = id;
  btn.addEventListener('click', onTap);
  wrap.append(btn, h('p', 'pz-note', note));
  return wrap;
}

/** The pause sheet, in the same sheet styling as the inventory. One at a time; `open` replaces a sheet that is up. */
export function createPauseSheet(root: HTMLElement, handlers: PauseHandlers): PauseSheet {
  let sheet: Sheet | null = null;
  return {
    open(info) {
      sheet?.remove();
      const made = createSheet(root, {
        title: t('screens.pause.title'),
        sub: info.base ? t('screens.pause.subBase', { number: info.number, planet: info.planet }) : t('screens.pause.sub', { number: info.number, planet: info.planet, page: info.page, total: info.total }),
        onClose: handlers.onResume,
      });
      made.el.classList.add('pause-sheet');
      const lines = h('div', 'pz-lines');
      lines.append(
        line(t('screens.pause.resume'), t('screens.pause.resumeNote'), handlers.onResume, 'resume'),
        line(t('screens.pause.settings'), t('screens.pause.settingsNote'), handlers.onSettings, 'settings'),
        line(t('screens.pause.skills'), t('screens.pause.skillsNote'), handlers.onSkills, 'skills'),
      );
      if (!info.base) lines.append(line(t('screens.pause.end'), t('screens.pause.endNote'), handlers.onEnd, 'end'));
      made.scroll.append(lines);
      made.note(t('screens.pause.hold'));
      sheet = made;
    },
    close() {
      sheet?.remove();
      sheet = null;
    },
    setHidden(hidden) {
      sheet?.el.classList.toggle('hidden', hidden);
    },
    isOpen: () => sheet !== null,
  };
}
