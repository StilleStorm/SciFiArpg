import { t } from '../i18n';
import { h } from './dom';
import { planetDef } from '../world/campaign';
import { ACT_ROMAN, actOf, type CardSpec } from './ticketModel';
import './base.css';

/** Lines per card kind (3 or 4 for the finished cards; the story slice may add a fourth). */
const LINE_COUNT = { openingLines: 3, chapterLines: 3, rewrittenLines: 2 } as const;

export interface CardOptions {
  /** The ticket number the opening page is filed under. */
  number: number;
  /** Called once when the card is gone (tapped, skipped or closed from code). */
  onDone(): void;
}

export interface CardHandle {
  el: HTMLElement;
  close(): void;
}

/**
 * A printed title page over the base: the opening page (campaign start) or a chapter card (a new planet), or the same
 * card rewritten in red (a closed planet visited again). Frames only: the lines are placeholders marked TODO-story until
 * the story slice. One tap anywhere on the card or on its Pomiń button removes it. The card never swallows input after
 * that: it is out of the DOM on the tap, and while it is up the layer is click-through except for its own paper, so a
 * stray tap on the base below is still a tap on the base.
 */
export function openCard(root: HTMLElement, spec: CardSpec, opts: CardOptions): CardHandle {
  const rewritten = spec.kind === 'rewritten';
  const layer = h('div', `card-layer${rewritten ? ' rewritten' : ''}`);
  layer.dataset.card = spec.kind;
  const paper = h('div', 'card-paper');
  const kind = h('p', 'card-kind', t(`screens.cards.kind.${spec.kind}`));
  const actNo = actOf(spec.planetIndex);
  const planet = t(planetDef(spec.planetIndex).nameKey);
  const title =
    spec.kind === 'opening'
      ? t('screens.cards.openingTitle', { number: opts.number })
      : t('screens.cards.title', { act: t('screens.cards.act', { act: ACT_ROMAN[actNo - 1] ?? 'I' }), planet });
  const head = h('h2', 'card-title', title);
  const lineKey = spec.kind === 'opening' ? 'openingLines' : rewritten ? 'rewrittenLines' : 'chapterLines';
  const lines = h('div', 'card-lines');
  for (let i = 1; i <= LINE_COUNT[lineKey]; i++) lines.append(h('p', 'card-line', t(`screens.cards.${lineKey}.${i}`)));
  const hero = h('div', 'card-hero');
  hero.append(h('span', 'card-hero-label', t('screens.cards.heroLabel')), h('span', 'card-hero-slot', t('screens.cards.heroSlot')));
  const skip = h('button', 'card-skip', t('screens.cards.skipButton'));
  skip.type = 'button';
  const hint = h('p', 'card-hint', t('screens.cards.skip'));
  paper.append(kind, head, lines, hero, hint, skip);
  if (rewritten) paper.append(h('div', 'card-stamp', t('screens.cards.stamp')));
  layer.append(paper);
  root.append(layer);

  let done = false;
  const close = (): void => {
    if (done) return;
    done = true;
    layer.remove();
    opts.onDone();
  };
  paper.addEventListener('click', close);
  skip.addEventListener('click', (e) => {
    e.stopPropagation();
    close();
  });
  return { el: layer, close };
}
