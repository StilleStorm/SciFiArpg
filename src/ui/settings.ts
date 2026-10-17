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

const SLIDER_UNDERLINE = 'M2 7C40 3 80 10 130 5S215 8 258 4';

/** A typed form line with a hand-drawn underline for a slider: "Muzyka na czekanie ....... 80". */
function volumeLine(label: string, value: number, onInput: (v: number) => void, onDone: (v: number) => void): HTMLElement {
  const line = h('div', 'vol');
  const name = h('span', 'vol-name', label);
  const num = h('output', 'vol-val', String(value));
  const range = h('input', 'vol-range');
  range.type = 'range';
  range.min = '0';
  range.max = '100';
  range.step = '5';
  range.value = String(value);
  range.setAttribute('aria-label', label);
  const underline = el('svg', { class: 'vol-line', viewBox: '0 0 260 12', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  underline.append(el('path', { d: SLIDER_UNDERLINE }));
  const track = h('div', 'vol-track');
  track.append(underline, range);
  range.addEventListener('input', () => {
    num.textContent = range.value;
    onInput(Number(range.value));
  });
  range.addEventListener('change', () => onDone(Number(range.value)));
  line.append(name, h('span', 'vol-lead'), num, track);
  return line;
}

/** Wydanie (day / night / by device), the left-handed mirror and the two volumes. All are saved by the caller. */
export function createSettings(
  root: HTMLElement,
  onChange: (next: Settings) => void,
  onBack: () => void,
  /** A volume slider was let go (the caller plays a short sound so it can be judged by ear). */
  onVolumeSet: (which: 'music' | 'sfx') => void = () => undefined,
): SettingsScreen {
  const screen = h('div', 'screen paper hidden');
  const frame = h('div', 'frame');
  screen.append(frame);
  root.append(screen);
  let current: Settings = { theme: 'auto', leftHanded: false, musicVolume: 80, sfxVolume: 100 };

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
    // Sliders keep their element while dragged: no re-render, only the number beside them changes.
    const live = (patch: Partial<Settings>): void => {
      current = { ...current, ...patch };
      onChange(current);
    };
    const sound = h('div', 'vols');
    sound.append(
      volumeLine(t('screens.settings.music'), current.musicVolume, (v) => live({ musicVolume: v }), () => onVolumeSet('music')),
      volumeLine(t('screens.settings.sfx'), current.sfxVolume, (v) => live({ sfxVolume: v }), () => onVolumeSet('sfx')),
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
      h('h3', 'group', t('screens.settings.sound')),
      sound,
      h('p', 'eta', t('screens.settings.soundNote')),
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
