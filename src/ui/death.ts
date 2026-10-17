import { t } from '../i18n';
import { h } from './dom';

export interface Death {
  el: HTMLElement;
  show(kills: number): void;
  hide(): void;
}

/** A plain form: UTRATA RACJI, one line of fact, one button. Death outcomes come later. */
export function createDeath(root: HTMLElement, onBack: () => void): Death {
  const screen = h('div', 'screen paper hidden');
  const frame = h('div', 'frame');
  const kills = h('p', 'form-line');
  const back = h('button', 'form-btn', t('ui.death.back'));
  back.type = 'button';
  back.addEventListener('click', onBack);
  frame.append(h('h2', 'form-title', t('ui.death.title')), h('hr', 'rule'), h('p', 'form-body', t('ui.death.body')), kills, back);
  screen.append(frame);
  root.append(screen);
  return {
    el: screen,
    show(n) {
      kills.textContent = t('ui.death.kills', { count: n });
      screen.classList.remove('hidden');
    },
    hide() {
      screen.classList.add('hidden');
    },
  };
}
