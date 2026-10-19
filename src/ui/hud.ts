import { createRng } from '../core/rng';
import { t } from '../i18n';
import { xpToNext } from '../progression/xp';
import { buildSlip } from '../render/pickupCard';
import { el as svgEl, n2, wobblyCircle } from '../render/svg';
import { heldOf } from '../systems/recovery';
import type { RunState } from '../world/run';
import { h } from './dom';
import { meterOf } from './ultimate';
import { createPauseButton } from './pause';
import './tunnel.css';
import './potw.css';

export interface Hud {
  el: HTMLElement;
  update(s: RunState): void;
  /** Force a re-measure (after a resize or when shown). */
  invalidate(): void;
}

const LINE_Y = 6;

/** A click this soon after a pointerdown on the note is the tail of that press. */
const CLICK_AFTER_PRESS_MS = 700;

/**
 * The Tunel note: a circled word, 48 x 48, hanging beside "Pauza" (ui/tunnel.css). Same pattern as the Pauza note: it
 * answers the finger going down, so it works with another thumb already on the joystick; a lone click still opens it.
 */
export function createTunnelButton(onTunnel: () => void): HTMLButtonElement {
  const btn = h('button', 'tunnel-btn');
  btn.type = 'button';
  btn.setAttribute('aria-label', t('ui.hud.tunnelLabel'));
  const rng = createRng(137);
  const svg = svgEl('svg', { viewBox: '-24 -24 48 48', 'aria-hidden': 'true' });
  svg.append(svgEl('path', { d: wobblyCircle(rng, 0, 0, 22.5, 11, 0.03) }), svgEl('path', { d: wobblyCircle(rng, 0.5, -0.4, 21, 9, 0.035), 'stroke-width': 0.9 }));
  btn.append(svg, h('span', 'word', t('ui.hud.tunnel')));
  let pressedAt = -Infinity;
  btn.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    pressedAt = performance.now();
    onTunnel();
  });
  btn.addEventListener('click', () => {
    if (performance.now() - pressedAt < CLICK_AFTER_PRESS_MS) return;
    onTunnel();
  });
  return btn;
}

/**
 * The Potwierdzenie note: a circled word, 48 x 48, one slot further out than "Tunel" (ui/potw.css), with the held slips
 * (at most five) shown as one or two slips on its top edge and a typed count. Same pattern as the Pauza and Tunel notes: it answers the finger going down.
 */
export function createPotwButton(onUse: () => void): { btn: HTMLButtonElement; show(n: number): void } {
  const btn = h('button', 'potw-btn empty');
  btn.type = 'button';
  btn.setAttribute('aria-label', t('ui.hud.potwLabel'));
  const rng = createRng(211);
  const svg = svgEl('svg', { viewBox: '-24 -24 48 48', 'aria-hidden': 'true' });
  svg.append(svgEl('path', { d: wobblyCircle(rng, 0, 0, 22.5, 11, 0.03) }), svgEl('path', { d: wobblyCircle(rng, 0.5, -0.4, 21, 9, 0.035), 'stroke-width': 0.9 }));
  const stack = svgEl('g', { class: 'stack' });
  svg.append(stack);
  btn.append(svg, h('span', 'word', t('ui.hud.potw')));
  let shown = -1;
  let pressedAt = -Infinity;
  btn.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    pressedAt = performance.now();
    onUse();
  });
  btn.addEventListener('click', () => {
    if (performance.now() - pressedAt < CLICK_AFTER_PRESS_MS) return;
    onUse();
  });
  return {
    btn,
    show(n) {
      if (n === shown) return;
      shown = n;
      btn.classList.toggle('empty', n <= 0);
      stack.replaceChildren();
      // Five slips side by side read as a strip: at most two are drawn, large enough to be slips, and the count is typed.
      const drawn = Math.min(n, 2);
      for (let i = 0; i < drawn; i++) {
        const slip = buildSlip(0, 1);
        slip.setAttribute('transform', `translate(${n2(-5 + i * 3.4)} ${n2(-12.5 - i * 2.2)}) rotate(${i === 0 ? -7 : 6}) scale(0.66)`);
        stack.prepend(slip); // the later slip lies under the first
      }
      if (n > 1) {
        const count = svgEl('text', { class: 'count', x: 7.5, y: -9.5 });
        count.textContent = t('ui.hud.potwCount', { count: n });
        stack.append(count);
      }
    },
  };
}

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

/** `onUpdateTap` is called when the player taps the "aktualizacja dostepna" line under Reputacja, `onPause` when the margin note "Pauza" is tapped, `onTunnel` for "Tunel". */
export function createHud(
  root: HTMLElement,
  onUpdateTap: () => void = () => undefined,
  onPause: () => void = () => undefined,
  onTunnel: () => void = () => undefined,
  onPotw: () => void = () => undefined,
  /** The Reputacja line was tapped: the Karta osobowa (ui/karta-osobowa.ts). */
  onReputacja: () => void = () => undefined,
): Hud {
  const el = h('div', 'hud paper');
  const racja = field('ui.hud.racja', 'racja');
  const argument = field('ui.hud.argument', 'arg');
  const reputacja = field('ui.hud.reputacja');
  const gwiazdki = field('ui.hud.gwiazdki');
  const strona = field('ui.hud.strona');
  const stronaLabel = strona.root.querySelector('label');
  const row1 = h('div', 'hud-row');
  const row2 = h('div', 'hud-row');
  reputacja.root.classList.add('rep', 'tappable');
  reputacja.root.setAttribute('role', 'button');
  reputacja.root.setAttribute('aria-label', t('screens.osobowa.title'));
  reputacja.root.addEventListener('click', onReputacja);
  row1.append(racja.root, argument.root);
  row2.append(reputacja.root, gwiazdki.root, strona.root);
  // A queued update: a typed line hanging under the form, tappable (44 px tall), shown only while one waits.
  const upd = h('button', 'upd hidden', t('forms.update.availableLine'));
  upd.type = 'button';
  upd.addEventListener('click', onUpdateTap);
  const tunnelBtn = createTunnelButton(onTunnel);
  const potw = createPotwButton(onPotw);
  el.append(row1, row2, upd, createPauseButton(onPause), tunnelBtn, potw.btn);
  root.append(el);

  const svg = svgEl('svg', { 'aria-hidden': 'true' });
  const whole = svgEl('path', { class: 'whole' });
  const left = svgEl('path', { class: 'left' });
  const lost = svgEl('path', { class: 'lost' });
  svg.append(whole, left, lost);
  racja.blank.append(svg);
  // The Argument meter: an ink underline that fills with the meter, and turns red when it is full.
  const aSvg = svgEl('svg', { 'aria-hidden': 'true' });
  const aWhole = svgEl('path', { class: 'whole' });
  const aLeft = svgEl('path', { class: 'left' });
  aSvg.append(aWhole, aLeft);
  argument.blank.append(aSvg);

  const cache = { racja: '', ratio: -1, aRatio: -1, aWidth: 0, width: 0, reputacja: '', gwiazdki: '', strona: '', upd: false, phase: '' };
  const setText = (node: HTMLElement, key: 'racja' | 'reputacja' | 'gwiazdki' | 'strona', text: string): void => {
    if (cache[key] === text) return;
    cache[key] = text;
    node.textContent = text;
  };

  return {
    el,
    invalidate() {
      cache.width = 0;
      cache.aWidth = 0;
    },
    update(s) {
      const p = s.player;
      setText(racja.value, 'racja', `${Math.max(0, Math.ceil(p.hp))}/${p.hpMax}`);
      potw.show(heldOf(p));
      setText(reputacja.value, 'reputacja', reputacjaText(s));
      setText(gwiazdki.value, 'gwiazdki', String(p.gwiazdki));
      // In the base the page field reads "Baza" with the kind of place typed in (a smaller type: "miasteczko" is long), and
      // the Tunel note is put away (the hole is the way back).
      if (cache.phase !== s.phase) {
        cache.phase = s.phase;
        if (stronaLabel) stronaLabel.textContent = t(s.phase === 'base' ? 'ui.hud.base' : 'ui.hud.strona');
        strona.root.classList.toggle('place', s.phase === 'base');
        tunnelBtn.classList.toggle('hidden', s.phase === 'base');
        potw.btn.classList.toggle('hidden', s.phase === 'base');
        cache.strona = '\u0000'; // forces the value to be written again
      }
      setText(strona.value, 'strona', s.phase === 'base' ? (s.base ? t(`world.layout.${s.base.layout}`) : '') : t('ui.hud.pages', { page: s.pageIndex + 1, total: s.pageCount }));
      const waiting = s.hero.pendingLevels > 0 && s.victoryAt === null; // after the boss no form opens any more
      if (waiting !== cache.upd) {
        cache.upd = waiting;
        upd.classList.toggle('hidden', !waiting);
      }
      const aRatio = Math.round(meterOf(p) * 100) / 100;
      const aWidth = argument.blank.clientWidth;
      if (aWidth > 0 && (aRatio !== cache.aRatio || aWidth !== cache.aWidth)) {
        cache.aRatio = aRatio;
        cache.aWidth = aWidth;
        aSvg.setAttribute('viewBox', `0 0 ${aWidth} 10`);
        const d = racjaPaths(aWidth, aRatio);
        aWhole.setAttribute('d', d.whole);
        aLeft.setAttribute('d', d.left);
        argument.root.classList.toggle('full', aRatio >= 1);
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
