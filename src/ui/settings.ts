import { t } from '../i18n';
import { el } from '../render/svg';
import type { Settings } from '../save/save';
import { h } from './dom';
import { currentOrient, effectiveSteering, orientationSetting } from './layout';
import { cutEdge, lineBoxes, runsOn } from './sheet';
import './textsize.css';

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

/** A group of options with its heading; the groups are laid out in one column (portrait) or two (landscape). */
function group(title: string, ...children: HTMLElement[]): HTMLElement {
  const g = h('section', 'set-group');
  g.append(h('h3', 'group', title), ...children);
  return g;
}

/** Wydanie (day / night / by device), the left-handed mirror, orientation, steering and the two volumes. All are saved by the caller. */
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
    const scrolled = frame.querySelector('.set-scroll')?.scrollTop ?? 0; // picking an option redraws the form: keep the place
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
    const orient = h('div', 'opts row');
    const chosenOrient = orientationSetting(current);
    orient.append(
      option(t('screens.settings.landscape'), chosenOrient === 'landscape', () => set({ orientation: 'landscape' })),
      option(t('screens.settings.portrait'), chosenOrient === 'portrait', () => set({ orientation: 'portrait' })),
    );
    const steer = h('div', 'opts row');
    const chosenSteer = effectiveSteering(current, currentOrient());
    steer.append(
      option(t('screens.settings.joystick'), chosenSteer === 'joystick', () => set({ steering: 'joystick', steeringTouched: true })),
      option(t('screens.settings.tap'), chosenSteer === 'tap', () => set({ steering: 'tap', steeringTouched: true })),
    );
    const sound = h('div', 'vols');
    sound.append(
      volumeLine(t('screens.settings.music'), current.musicVolume, (v) => live({ musicVolume: v }), () => onVolumeSet('music')),
      volumeLine(t('screens.settings.sfx'), current.sfxVolume, (v) => live({ sfxVolume: v }), () => onVolumeSet('sfx')),
    );
    const size = h('div', 'opts row');
    const chosenSize = current.textSize ?? 0;
    size.append(
      option(t('screens.settings.textNormal'), chosenSize === 0, () => set({ textSize: 0 })),
      option(t('screens.settings.textLarge'), chosenSize === 1, () => set({ textSize: 1 })),
      option(t('screens.settings.textLarger'), chosenSize === 2, () => set({ textSize: 2 })),
    );
    const damage = h('div', 'opts row');
    damage.append(
      option(t('screens.settings.damageOff'), current.damageNumbers !== true, () => set({ damageNumbers: false })),
      option(t('screens.settings.damageOn'), current.damageNumbers === true, () => set({ damageNumbers: true })),
    );
    const bug = h('div', 'opts row');
    bug.append(
      option(t('screens.settings.bugOn'), current.bugButton !== false, () => set({ bugButton: true })),
      option(t('screens.settings.bugOff'), current.bugButton === false, () => set({ bugButton: false })),
    );
    const back = h('button', 'form-btn', t('screens.settings.back'));
    back.type = 'button';
    back.addEventListener('click', onBack);
    const body = h('div', 'set-scroll');
    const more = h('p', 'set-more', t('ui.sheet.more'));
    const veil = h('span', 'set-veil');
    more.append(veil);
    more.hidden = true;
    const grid = h('div', 'set-grid');
    grid.append(
      group(t('screens.settings.theme'), theme),
      group(t('screens.settings.hand'), hand),
      group(t('screens.settings.orientation'), orient, h('p', 'eta', t('screens.settings.orientationNote'))),
      group(t('screens.settings.steering'), steer, h('p', 'eta', t('screens.settings.steeringNote'))),
      group(t('screens.settings.textSize'), size, h('p', 'eta', t('screens.settings.textNote'))),
      group(t('screens.settings.damage'), damage, h('p', 'eta', t('screens.settings.damageNote'))),
      group(t('screens.settings.bug'), bug),
      group(t('screens.settings.sound'), sound, h('p', 'eta', t('screens.settings.soundNote'))),
    );
    body.append(grid, h('p', 'eta', t('screens.settings.note')));
    frame.append(
      h('div', 'agency', t('ui.title.agency')),
      h('h2', 'form-title tight', t('screens.settings.title')),
      h('hr', 'rule'),
      body,
      more,
      back,
    );
    body.scrollTop = scrolled;
    // the same "c.d. poniżej" cue as the sheets (ui/sheet.ts): printed under the cut while the form runs on below it
    const place = (): void => {
      // the cue's own line takes height from the body while it is printed, so the test counts that height back
      more.hidden = !runsOn(body.scrollTop, body.clientHeight + (more.hidden ? 0 : more.offsetHeight), body.scrollHeight);
      if (more.hidden) return;
      // a paper veil from the first sliced line down to the cut, so no line shows half its glyphs
      const bottom = body.getBoundingClientRect().bottom;
      veil.style.height = `${Math.max(0, Math.round(bottom - cutEdge(lineBoxes(body, bottom), bottom)))}px`;
    };
    body.addEventListener('scroll', place, { passive: true });
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(place).observe(body);
    requestAnimationFrame(place);
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
