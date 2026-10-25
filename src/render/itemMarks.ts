/**
 * Marks over an item drawing (ITEMS 9): the tier mark (never omitted) and the marks of absurd affixes.
 * Everything is drawn in the same 46 x 46 box as the drawings (-23..23), so one path serves both the tiny plate
 * on the ground and the large figure on a card; the caller picks the stroke width.
 */
import { t } from '../i18n';
import { AFFIXES_BY_ID, UNWANTED_FEATURES, type AbsurdKind } from '../items/affixes';
import type { ItemTier } from '../items/types';
import { el } from './svg';

/** What a mark needs to know about an item. */
export interface MarkSubject {
  tier: ItemTier;
  affixes: readonly string[];
  freeVersion?: boolean;
  /** A paperclip replaces the tier mark of a set piece. */
  set?: boolean;
  /** Items carry their set as an id (items/sets.ts); the paperclip is drawn for it too. */
  setId?: string;
}

/** Marks that sit on the drawing itself, and marks that sit beside the plate number. */
export type AffixMarkKind = 'dotted' | 'reklama' | 'trial' | 'free' | 'nowosc' | 'ok' | 'footnote' | 'strike';
export const NUMBER_MARKS: readonly AffixMarkKind[] = ['ok', 'footnote', 'strike'];

/** Absurd affix (items/affixes.ts `absurd`) -> mark. Absurd affixes first in AFFIX_PRIORITY. */
export const AFFIX_MARK: Readonly<Record<AbsurdKind, AffixMarkKind>> = {
  domniemany: 'dotted',
  ewentualny: 'ok',
  sponsorowany: 'reklama',
  probny: 'trial',
  rzekomy: 'footnote',
  wycofany: 'strike',
};

const AFFIX_PRIORITY: readonly AffixMarkKind[] = ['dotted', 'ok', 'reklama', 'trial', 'footnote', 'strike', 'free', 'nowosc'];

const UNWANTED_IDS: ReadonlySet<string> = new Set(UNWANTED_FEATURES.map((a) => a.id));

/** All marks of an item in priority order (absurd first, then the free version, then an unwanted feature). */
export function affixMarks(item: MarkSubject): AffixMarkKind[] {
  const found = new Set<AffixMarkKind>();
  for (const id of item.affixes) {
    const absurd = AFFIXES_BY_ID.get(id)?.absurd;
    if (absurd) found.add(AFFIX_MARK[absurd]);
    else if (UNWANTED_IDS.has(id)) found.add('nowosc');
  }
  if (item.freeVersion) found.add('free');
  return AFFIX_PRIORITY.filter((k) => found.has(k));
}

/** On the ground an item carries at most one affix mark: the first in priority. */
export const groundMark = (item: MarkSubject): AffixMarkKind | null => affixMarks(item)[0] ?? null;

const SEAL_RIBBON = 'M10.5 19L8.5 23M17.5 19L19.5 23';
// a gem paperclip, three nested bends, tilted a little: ink only, drawn in the corner where the other tier marks sit
const CLIP = 'M-12.5-9V-19A3.5 3.5 0 0 1-5.5-19V-5A5.5 5.5 0 0 1-16.5-5V-17A1.8 1.8 0 0 1-12.9-17V-6';
const THREAD = 'M-19 13Q-25-5-9-19Q9-26 20-8Q25 8 7 18Q-6 22-15 17';
const THREAD_ENDS = 'M-15 17L-20 21Q-22 22-21 19M-15 17L-12 23Q-11 24-13 24';

export type TierMarkKind = 'stamp' | 'thread' | 'seal' | 'clip';

/** Which tier mark an item wears; null for zwykły. A set piece wears the paperclip whatever its tier. */
export function tierMarkKind(item: Pick<MarkSubject, 'tier' | 'set' | 'setId'>): TierMarkKind | null {
  if (item.set || item.setId) return 'clip';
  return { zwykly: null, nietypowy: 'stamp', rzadki: 'thread', unikatowy: 'seal' }[item.tier] as TierMarkKind | null;
}

/** The tier mark: a stamp (nietypowy), a thread (rzadki), a wax seal (unikatowy), a paperclip (zestaw). */
export function buildTierMark(item: MarkSubject, sw = 1.5): SVGGElement | null {
  const g = el('g', { class: 'item-mark tier-mark', 'stroke-width': sw });
  if (item.set || item.setId) {
    g.append(el('path', { d: CLIP, fill: 'none', transform: 'translate(-16 -22) scale(1.5) translate(16 22) rotate(-14 -11 -11)' }));
    return g;
  }
  switch (item.tier) {
    case 'zwykly':
      return null;
    case 'nietypowy':
      g.append(
        el('circle', { cx: 15.5, cy: -15.5, r: 5.6 }),
        el('circle', { cx: 15.5, cy: -15.5, r: 3.8, 'stroke-width': sw * 0.5 }),
        el('path', { d: 'M12.6-15.5L14.6-13.3L18.6-18' }),
      );
      return g;
    case 'rzadki':
      // Black ink: DESIGN §3 keeps red for stamps, strikes, Racja and handwritten corrections; a thread is none of them.
      g.append(
        el('path', { d: THREAD, fill: 'none' }),
        el('path', { d: THREAD_ENDS, fill: 'none' }),
        el('circle', { cx: -15, cy: 17, r: 1.9, fill: 'var(--paper)' }),
      );
      return g;
    case 'unikatowy':
      g.append(
        el('path', { d: SEAL_RIBBON }),
        el('circle', { cx: 14, cy: 14, r: 6.6, fill: 'var(--ink)' }),
        el('path', { d: 'M10.4 17.6L17.6 10.4M10.4 14L14 10.4M14 17.6L17.6 14', style: 'stroke:var(--paper)', 'stroke-width': sw * 0.5 }),
        el('circle', { cx: 14, cy: 14, r: 1.4, style: 'fill:var(--accent);stroke:none' }),
      );
      return g;
  }
}

const stripText = (x: number, y: number, size: number, text: string): SVGTextElement =>
  el('text', { class: 't-plate', x, y, style: `font-size:${size}px;fill:var(--ink);stroke:none` }, [text]);

function reklamaStrip(sw: number): SVGGElement {
  const g = el('g', { transform: 'translate(-11 -10) rotate(-35)' });
  g.append(el('rect', { x: -10, y: -3, width: 20, height: 6, fill: 'var(--paper)', 'stroke-width': sw * 0.7 }), stripText(0, 1.5, 4.2, t('items.mark.reklama')));
  return g;
}

/**
 * Marks drawn over the art for the given kinds (the number marks are skipped: they sit beside the plate number).
 * `kinds` is already limited by the caller (one on the ground, all on a card).
 */
export function buildAffixMarks(kinds: readonly AffixMarkKind[], sw = 1.5): SVGGElement | null {
  const g = el('g', { class: 'item-mark affix-mark', 'stroke-width': sw });
  let any = false;
  for (const kind of kinds) {
    switch (kind) {
      case 'reklama':
        g.append(reklamaStrip(sw));
        break;
      case 'free':
        if (!kinds.includes('reklama')) g.append(reklamaStrip(sw));
        g.append(
          el('path', { d: 'M9.5 14H19.5V21.5H9.5Z', fill: 'var(--paper)' }),
          el('path', { d: 'M11.5 14V11Q11.5 8 14.5 8Q17.5 8 17.5 11V14' }),
          el('path', { d: 'M14.5 17.2V18.6', 'stroke-width': sw * 1.2 }),
        );
        break;
      case 'trial':
        g.append(
          el('path', { d: 'M-22.5 8.5H-9.5V21H-22.5ZM-22.5 12H-9.5', fill: 'var(--paper)' }),
          el('path', { d: 'M-20.6 14.2L-18.8 16.2M-18.8 14.2L-20.6 16.2M-16.6 14.2L-14.8 16.2M-14.8 14.2L-16.6 16.2', 'stroke-width': sw * 0.8 }),
          el('circle', { cx: -12.4, cy: 18.3, r: 1.1, 'stroke-width': sw * 0.7 }),
        );
        break;
      case 'nowosc':
        // A price tag hung from a string inside the frame; the text is sized to read at 11 px on a 76 px card figure.
        g.append(
          el('path', { d: 'M0-22.2L-2-17.5M0-22.2L2-17.5', 'stroke-width': sw * 0.6 }),
          el('path', { d: 'M-14-17.5H14V-8.5H-14Z', fill: 'var(--paper)', 'stroke-width': sw * 0.7 }),
          stripText(0, -10.8, 6.8, t('items.mark.nowosc')),
        );
        break;
      default:
        continue;
    }
    any = true;
  }
  return any ? g : null;
}

/** Text appended to the plate number: "ok." and the footnote marker. */
export function numberSuffix(kinds: readonly AffixMarkKind[]): string {
  return (kinds.includes('ok') ? ` ${t('items.mark.ok')}` : '') + (kinds.includes('footnote') ? '¹' : '');
}
