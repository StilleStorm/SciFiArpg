/** The three death forms: a ticket with an absurd countdown, and two slips (Petla, Zawieszenie). */
import { t } from '../i18n';
import { stamp } from '../render/ink';
import { el } from '../render/svg';
import { tween } from '../render/tween';
import { h } from './dom';
import './forms.css';

export interface DeathForms {
  /** The ticket: the countdown runs about six seconds, the stamp lands, then `onEnd`. */
  showZgloszenie(kills: number, onEnd: () => void): void;
  /** A short slip for Petla or Zawieszenie; `onClose` when the button is pressed. */
  showSlip(kind: 'petla' | 'zawieszenie', onClose: () => void): void;
  hide(): void;
  /** The small ZAWIESZONO stamp under the HUD, kept until cleared. */
  showHudStamp(): void;
  clearHudStamp(): void;
}

/** What the timer shows and from which moment (0..1 of the run). Four minutes, then a second less, then nonsense. */
export const COUNTDOWN: readonly { at: number; text: string }[] = [
  { at: 0, text: '4:00' },
  { at: 0.14, text: '3:59' },
  { at: 0.3, text: '7:12' },
  { at: 0.5, text: '0:03' },
  { at: 0.62, text: '0:02' },
  { at: 0.72, text: '0:01' },
  { at: 0.8, text: '0:00' },
];
export const ZGLOSZENIE_MS = 6000;

export function countdownAt(p: number): string {
  let text = COUNTDOWN[0]?.text ?? '';
  for (const c of COUNTDOWN) if (p >= c.at) text = c.text;
  return text;
}

function field(label: string, value: string): { row: HTMLElement; value: HTMLElement } {
  const row = h('div');
  const v = h('span', '', value);
  row.append(h('span', '', label), v);
  return { row, value: v };
}

export function createDeathForms(root: HTMLElement): DeathForms {
  // ---- the ticket ----
  const ticket = h('div', 'sheet full hidden');
  const timer = h('div', 'timer', '4:00');
  const verdict = h('p', 'verdict hidden');
  const status = field(t('forms.death.zgloszenie.statusLabel'), t('forms.death.zgloszenie.statusOpen'));
  const about = field(t('forms.death.zgloszenie.aboutLabel'), t('forms.death.zgloszenie.aboutValue'));
  const fields = h('div', 'fields');
  fields.append(about.row, status.row);
  const ticketLayer = el('svg', { class: 'stamp-layer', 'aria-hidden': 'true' });
  const ticketG = el('g', {});
  ticketLayer.append(ticketG);
  const agency = h('div', 'agency', t('ui.title.agency'));
  ticket.append(
    agency,
    h('hr', 'rule'),
    h('h2', '', t('forms.death.zgloszenie.title')),
    h('p', 'sub', t('forms.death.zgloszenie.number')),
    h('p', 'lead', t('forms.death.zgloszenie.lead')),
    fields,
    h('div', 'wait', t('forms.death.zgloszenie.wait')),
    timer,
    verdict,
    ticketLayer,
  );

  // ---- the slip ----
  const slip = h('div', 'sheet slip hidden');
  const slipTitle = h('h2');
  const slipLead = h('p', 'lead');
  const slipBody = h('p', 'body');
  const slipBtn = h('button', 'install');
  slipBtn.type = 'button';
  const slipLayer = el('svg', { class: 'stamp-layer', 'aria-hidden': 'true' });
  const slipG = el('g', {});
  slipLayer.append(slipG);
  const room = h('div', 'stamp-room');
  slip.append(slipTitle, slipLead, slipBody, room, slipBtn, slipLayer);

  // ---- the HUD stamp ----
  const hudSvg = el('svg', { class: 'hud-stamp', 'aria-hidden': 'true' });
  const hudG = el('g', {});
  hudSvg.append(hudG);
  hudSvg.classList.add('hidden');

  root.append(ticket, slip, hudSvg);

  let cancel: () => void = () => undefined;
  let onSlip: () => void = () => undefined;
  slipBtn.addEventListener('click', () => onSlip());

  return {
    showZgloszenie(kills, onEnd) {
      cancel();
      ticketG.replaceChildren();
      verdict.classList.add('hidden');
      status.value.textContent = t('forms.death.zgloszenie.statusOpen');
      verdict.replaceChildren(
        document.createTextNode(`${t('forms.death.zgloszenie.verdict')} ${t('forms.death.zgloszenie.kills', { count: kills })} ${t('forms.death.zgloszenie.closed')}`),
      );
      ticket.classList.remove('hidden');
      let shown = '';
      let stamped = false;
      cancel = tween(
        ZGLOSZENIE_MS,
        (p) => {
          const text = countdownAt(p);
          if (text !== shown) {
            shown = text;
            timer.textContent = text;
          }
          if (p > 0.3) verdict.classList.remove('hidden');
          if (p >= 0.8 && !stamped) {
            stamped = true;
            status.value.textContent = t('forms.death.zgloszenie.statusClosed');
            stamp(t('forms.death.zgloszenie.stamp'), ticket.clientWidth / 2, ticket.clientHeight * 0.74, { parent: ticketG, ttl: Infinity, rotation: -8, fontSize: 24 });
          }
        },
        { done: () => onEnd() },
      );
    },
    showSlip(kind, onClose) {
      cancel();
      slipG.replaceChildren();
      slipTitle.textContent = t(`forms.death.${kind}.title`);
      slipLead.textContent = t(`forms.death.${kind}.lead`);
      slipBody.textContent = t(`forms.death.${kind}.body`);
      slipBtn.textContent = t(`forms.death.${kind}.go`);
      onSlip = onClose;
      slip.classList.remove('hidden');
      if (kind === 'zawieszenie') {
        tween(1, () => undefined, { delay: 200, done: () => stamp(t('forms.death.zawieszenie.stamp'), slip.clientWidth / 2, room.offsetTop + room.offsetHeight / 2, { parent: slipG, ttl: Infinity, rotation: -7, fontSize: 18 }) });
      }
    },
    hide() {
      cancel();
      ticket.classList.add('hidden');
      slip.classList.add('hidden');
      ticketG.replaceChildren();
      slipG.replaceChildren();
    },
    showHudStamp() {
      hudG.replaceChildren();
      hudSvg.classList.remove('hidden');
      stamp(t('forms.death.zawieszenie.stamp'), 105, 26, { parent: hudG, ttl: Infinity, rotation: -6, fontSize: 14 });
    },
    clearHudStamp() {
      hudG.replaceChildren();
      hudSvg.classList.add('hidden');
    },
  };
}
