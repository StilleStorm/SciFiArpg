import { t } from '../i18n';
import { h } from './dom';
import type { HeroId } from '../heroes/registry';
import { planetDef } from '../world/campaign';
import { hasStory } from '../world/planets/storyKeys';
import { ACT_ROMAN, actOf, type CardSpec } from './ticketModel';
import './base.css';

/** Where the story file keeps the lines of a card (`story.<lines>.1..n`, `story.<hero>.<heroId>`); null for a planet with no story keys. */
function storySource(spec: CardSpec): { lines: string; hero: string | undefined } | null {
  if (spec.kind === 'opening') return { lines: 'opening.lines', hero: 'opening.hero' };
  const n = spec.planetIndex + 1;
  if (spec.kind === 'rewritten') return { lines: `p${n}.rewritten.lines`, hero: undefined };
  return { lines: `p${n}.card.lines`, hero: `p${n}.card.hero` };
}

/** Lines per card kind (3 or 4 for the finished cards; the story slice may add a fourth). */
const LINE_COUNT = { openingLines: 3, chapterLines: 3, rewrittenLines: 2 } as const;

export interface CardOptions {
  /** The ticket number the opening page is filed under. */
  number: number;
  /** The hero whose line closes the card (`story.opening.hero.<id>`, `story.p<N>.card.hero.<id>`); absent = the placeholder line. */
  heroId?: HeroId;
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
  const src = storySource(spec);
  let live = false;
  for (let i = 1; i <= LINE_COUNT[lineKey]; i++) {
    const own = src && hasStory(`${src.lines}.${i}`);
    live ||= own === true;
    lines.append(h('p', 'card-line', own ? t(`story.${src?.lines}.${i}`) : t(`screens.cards.${lineKey}.${i}`)));
  }
  const heroOwn = src?.hero !== undefined && opts.heroId !== undefined && hasStory(`${src.hero}.${opts.heroId}`);
  const hero = h('div', 'card-hero');
  hero.append(
    h('span', 'card-hero-label', t('screens.cards.heroLabel')),
    h('span', 'card-hero-slot', heroOwn ? t(`story.${src?.hero}.${opts.heroId}`) : t('screens.cards.heroSlot')),
  );
  const skip = h('button', 'card-skip', t('screens.cards.skipButton'));
  skip.type = 'button';
  const hint = h('p', 'card-hint', t('screens.cards.skip'));
  paper.append(kind, head, lines);
  // a card with its own lines but no hero line (the red rewritten one, or a case file with no hero) shows no hero block; a placeholder card keeps the frame
  if (heroOwn || !live) paper.append(hero);
  paper.append(hint, skip);
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
