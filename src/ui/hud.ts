import { t } from '../i18n';
import { xpToNext } from '../progression/xp';
import type { RunState } from '../world/run';
import { h } from './dom';
import { el as svgEl, n2 } from '../render/svg';

export interface Hud {
  el: HTMLElement;
  update(s: RunState): void;
  /** Force a re-measure (after a resize or when shown). */
  invalidate(): void;
}

const LINE_Y = 6;

/** Racja as a hand-drawn line: red up to the ratio, the lost part thin and struck through. */
function racjaPaths(width: number, ratio: number): { left: string; lost: string; whole: string } {
  const x = Math.max(0, Math.min(1, ratio)) * width;
  const wob = (px: number): number => LINE_Y + Math.sin(px * 0.31) * 0.7 + Math.sin(px * 0.13) * 0.5;
  let left = `M0 ${n2(wob(0))}`;
  for (let px = 6; px < x; px += 6) left += `L${n2(px)} ${n2(wob(px))}`;
  left += `L${n2(x)} ${n2(wob(x))}`;
  let lost = `M${n2(x)} ${n2(wob(x))}`;
  for (let px = x + 6; px < width; px += 6) lost += `L${n2(px)} ${n2(wob(px))}`;
  lost += `L${n2(width)} ${n2(wob(width))}`;
  for (let px = x + 3; px < width - 2; px += 5) lost += `M${n2(px)} ${n2(LINE_Y - 3.5)}l2.5 7`;
  return { left: x > 0 ? left : '', lost: x < width ? lost : '', whole: `M0 ${LINE_Y + 3}L${n2(width)} ${LINE_Y + 3}` };
}

function field(labelKey: string, extra = ''): { root: HTMLElement; value: HTMLElement; blank: HTMLElement } {
  const root = h('div', `field ${extra}`.trim());
  const label = h('label', '', t(labelKey));
  const blank = h('span', 'blank');
  const value = h('span', 'val');
  blank.append(value);
  root.append(label, blank);
  return { root, value, blank };
}

/**
 * Level and progress. Under "Czas wsteczny" (after it begins) the form prints the absurd negative:
 * the reputacja already earned is shown as a debt, although it is in fact subtracted from the next level.
 */
export function reputacjaText(s: RunState): string {
  const p = s.player;
  const progress = `${s.law.reversed ? '\u2212' : ''}${Math.round(p.xp)}/${xpToNext(p.level)}`;
  return `${p.level} \u00b7 ${progress}`;
}

/** `onUpdateTap` is called when the player taps the "aktualizacja dostepna" line under Reputacja. */
export function createHud(root: HTMLElement, onUpdateTap: () => void = () => undefined): Hud {
  const el = h('div', 'hud paper');
  const racja = field('ui.hud.racja', 'racja');
  const reputacja = field('ui.hud.reputacja');
  const gwiazdki = field('ui.hud.gwiazdki');
  const strona = field('ui.hud.strona');
  const row1 = h('div', 'hud-row');
  const row2 = h('div', 'hud-row');
  reputacja.root.classList.add('rep');
  row1.append(racja.root);
  row2.append(reputacja.root, gwiazdki.root, strona.root);
  // A queued update: a typed line hanging under the form, tappable (44 px tall), shown only while one waits.
  const upd = h('button', 'upd hidden', t('forms.update.availableLine'));
  upd.type = 'button';
  upd.addEventListener('click', onUpdateTap);
  el.append(row1, row2, upd);
  root.append(el);

  const svg = svgEl('svg', { 'aria-hidden': 'true' });
  const whole = svgEl('path', { class: 'whole' });
  const left = svgEl('path', { class: 'left' });
  const lost = svgEl('path', { class: 'lost' });
  svg.append(whole, left, lost);
  racja.blank.append(svg);

  const cache = { racja: '', ratio: -1, width: 0, reputacja: '', gwiazdki: '', strona: '', upd: false };
  const setText = (node: HTMLElement, key: 'racja' | 'reputacja' | 'gwiazdki' | 'strona', text: string): void => {
    if (cache[key] === text) return;
    cache[key] = text;
    node.textContent = text;
  };

  return {
    el,
    invalidate() {
      cache.width = 0;
    },
    update(s) {
      const p = s.player;
      setText(racja.value, 'racja', `${Math.max(0, Math.ceil(p.hp))}/${p.hpMax}`);
      setText(reputacja.value, 'reputacja', reputacjaText(s));
      setText(gwiazdki.value, 'gwiazdki', String(p.gwiazdki));
      setText(strona.value, 'strona', t('ui.hud.pages', { page: s.pageIndex + 1, total: s.pageCount }));
      const waiting = s.hero.pendingLevels > 0;
      if (waiting !== cache.upd) {
        cache.upd = waiting;
        upd.classList.toggle('hidden', !waiting);
      }
      const ratio = Math.max(0, p.hp) / p.hpMax;
      const width = racja.blank.clientWidth;
      if (width > 0 && (ratio !== cache.ratio || width !== cache.width)) {
        cache.ratio = ratio;
        cache.width = width;
        svg.setAttribute('viewBox', `0 0 ${width} 10`);
        const d = racjaPaths(width, ratio);
        whole.setAttribute('d', d.whole);
        left.setAttribute('d', d.left);
        lost.setAttribute('d', d.lost);
      }
    },
  };
}
