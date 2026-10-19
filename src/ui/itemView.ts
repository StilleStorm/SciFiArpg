import { t } from '../i18n';
import { claimIsHearsay, showsApproximately } from '../items/absurd';
import { capitalize, withRegisterMark } from '../items/grammar';
import { modTierMark } from '../items/tiers';
import { effectiveStats } from '../items/stats';
import { reviewLine } from '../items/reviews';
import type { Item, StatBlock, StatKey } from '../items/types';
import { drawingSvg } from '../render/itemDrawings';
import { affixMarks, numberSuffix } from '../render/itemMarks';
import { h } from './dom';
import { num, signed } from './sheet';

/** Caption name: capitalized, the magnitude tier numeral "(II)".."(V)" after the model (before an unwanted feature), "(wariant)" for shop lies and Parzystość drops. */
export function displayName(item: Item): string {
  const base = withRegisterMark(capitalize(item.name), item.gender, item.affixes, modTierMark(item.modTier));
  return item.variant ? `${base} (${t('items.variant')})` : base;
}

/** "Ryc. 12." plus the number marks of absurd affixes: "ok." and the footnote marker. */
export const caption = (item: Item): string => t('items.ui.caption', { n: item.number }) + numberSuffix(affixMarks(item));

/** "Wycofany z obiegu": the plate number is struck through. */
export const isStruck = (item: Item): boolean => affixMarks(item).includes('strike');

/** The caption as a node: struck through when the affix says the item was withdrawn from circulation. */
export function captionNode(item: Item): HTMLElement {
  return h('span', isStruck(item) ? 'cap struck' : 'cap', caption(item));
}

/** One drawing in a square plate. */
export function figure(item: Pick<Item, 'drawing'> & Partial<Pick<Item, 'tier' | 'affixes' | 'freeVersion'>>, px: number): HTMLElement {
  const f = h('span', 'pfig');
  f.style.width = `${px}px`;
  f.style.height = `${px}px`;
  f.append(drawingSvg(item.drawing, item.tier ? { tier: item.tier, affixes: item.affixes ?? [], freeVersion: item.freeVersion } : undefined));
  return f;
}

export type RowKey = 'dmg' | Exclude<StatKey, 'dmgMin' | 'dmgMax'>;
export const ROW_KEYS: readonly RowKey[] = [
  'dmg', 'pewnosc', 'upor', 'racja', 'crit', 'resMechaniczny', 'resRegulaminowy', 'resEgzystencjalny', 'zasieg', 'tempo', 'gwiazdki', 'proba',
];
/** Percentage modifiers (S8): printed signed, "+15%", "−6%". */
const SIGNED_PCT: ReadonlySet<RowKey> = new Set<RowKey>(['zasieg', 'tempo', 'gwiazdki', 'proba']);

export function rowText(b: StatBlock, key: RowKey): string {
  if (key === 'dmg') return b.dmgMax > 0 || b.dmgMin > 0 ? `${b.dmgMin}–${b.dmgMax}` : '';
  const v = b[key] ?? 0;
  if (v === 0) return '';
  if (SIGNED_PCT.has(key)) return `${signed(v)}%`;
  return key === 'crit' || key.startsWith('res') ? `${num(v)}%` : num(v);
}

/** rowText for one item's numbers: "ok. 16" on the pewność of an "ewentualny" item (ITEMS 9). */
export function itemRowText(item: Pick<Item, 'affixes'>, b: StatBlock, key: RowKey): string {
  const text = rowText(b, key);
  return text && key === 'pewnosc' && showsApproximately(item) ? `${t('items.absurd.approx')} ${text}` : text;
}

/** The "declared" column head; "(wg relacji)" after it for a "rzekomy" item, whose claim is hearsay. */
export const declaredHead = (item: Pick<Item, 'affixes'>): string =>
  claimIsHearsay(item) ? `${t('items.ui.declared')} ${t('items.absurd.hearsay')}` : t('items.ui.declared');

export function rowValue(b: StatBlock, key: RowKey): number {
  return key === 'dmg' ? (b.dmgMin + b.dmgMax) / 2 : b[key];
}

export const rowLabel = (key: RowKey): string => t(`items.stat.${key}`);

/** Short one-line summary for lists: the first three non-zero rows. */
export function summary(b: StatBlock): string {
  const parts: string[] = [];
  for (const key of ROW_KEYS) {
    const text = rowText(b, key);
    if (text) parts.push(`${t(`items.statShort.${key}`)} ${text}`);
    if (parts.length === 3) break;
  }
  return parts.join(' · ');
}

/** The numbers the item is worth right now (claimed in trial, actual after). */
export const shownStats = (item: Item): StatBlock => effectiveStats({ ...item, blockedBy: undefined });

export function reviewText(item: Item): string {
  return item.review ? reviewLine(item.review) : t('items.review.none');
}

export const tierWord = (item: Item): string => t(`items.tier.${item.tier}`);

/** Hand-written difference between two numbers in the accent color. */
export function deltaSpan(diff: number): HTMLElement | null {
  if (Math.abs(diff) < 0.05) return null;
  return h('span', 'pen', signed(diff));
}
