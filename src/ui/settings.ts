import { t } from '../i18n';
import { el } from '../render/svg';
import type { Settings } from '../save/save';
import { h } from './dom';

export interface SettingsScreen {
  el: HTMLElement;
  show(settings: Settings): void;
  hide(): void;
}

/** A hand-ticked box: the option is chosen when a pen "x" stands in the square. */
function option(label: string, chosen: boolean, onPick: () => void): HTMLButtonElement {
  const b = h('button', `opt${chosen ? ' chosen' : ''}`);
  b.type = 'button';
  const box = el('svg', { viewBox: '-12 -12 24 24', 'aria-hidden': 'true' });
  box.append(el('path', { d: 'M-8-7L8-8L7 8L-8 7Z' }));
  if (chosen) box.append(el('path', { d: 'M-6-6L6 6M6-6L-6 6', 'stroke-width': 2.2 }));
  b.append(box, h('span', '', label));
  b.addEventListener('click', onPick);
  return b;
}

/** Wydanie (day / night / by device) and the left-handed mirror. Both are saved by the caller. */
export function createSettings(root: HTMLElement, onChange: (next: Settings) => void, onBack: () => void): SettingsScreen {
  const screen = h('div', 'screen paper hidden');
  const frame = h('div', 'frame');
  screen.append(frame);
  root.append(screen);
  let current: Settings = { theme: 'auto', leftHanded: false };

  function render(): void {
    frame.replaceChildren();
    const set = (patch: Partial<Settings>): void => {
      current = { ...current, ...patch };
      onChange(current);
      render();
    };
    const theme = h('div', 'opts');
    theme.append(
      option(t('screens.settings.day'), current.theme === 'day', () => set({ theme: 'day' })),
      option(t('screens.settings.night'), current.theme === 'night', () => set({ theme: 'night' })),
      option(t('screens.settings.auto'), current.theme === 'auto', () => set({ theme: 'auto' })),
    );
    const hand = h('div', 'opts');
    hand.append(
      option(t('screens.settings.right'), !current.leftHanded, () => set({ leftHanded: false })),
      option(t('screens.settings.left'), current.leftHanded, () => set({ leftHanded: true })),
    );
    const back = h('button', 'form-btn', t('screens.settings.back'));
    back.type = 'button';
    back.addEventListener('click', onBack);
    frame.append(
      h('div', 'agency', t('ui.title.agency')),
      h('h2', 'form-title tight', t('screens.settings.title')),
      h('hr', 'rule'),
      h('h3', 'group', t('screens.settings.theme')),
      theme,
      h('h3', 'group', t('screens.settings.hand')),
      hand,
      h('p', 'eta', t('screens.settings.note')),
      back,
    );
  }

  return {
    el: screen,
    show(settings) {
      current = settings;
      screen.classList.remove('hidden');
      render();
    },
    hide() {
      screen.classList.add('hidden');
    },
  };
}
