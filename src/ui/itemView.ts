import { t } from '../i18n';
import { capitalize } from '../items/grammar';
import { effectiveStats } from '../items/stats';
import { reviewLine } from '../items/reviews';
import type { Item, StatBlock, StatKey } from '../items/types';
import { drawingSvg } from '../render/itemDrawings';
import { h } from './dom';
import { num, signed } from './sheet';

/** Caption name: capitalized, with "(wariant)" for shop lies and drops of the Parzystość clause. */
export function displayName(item: Item): string {
  const base = capitalize(item.name);
  return item.variant ? `${base} (${t('items.variant')})` : base;
}

export const caption = (item: Item): string => t('items.ui.caption', { n: item.number });

/** One drawing in a square plate. */
export function figure(item: Pick<Item, 'drawing'>, px: number): HTMLElement {
  const f = h('span', 'pfig');
  f.style.width = `${px}px`;
  f.style.height = `${px}px`;
  f.append(drawingSvg(item.drawing));
  return f;
}

export type RowKey = 'dmg' | Exclude<StatKey, 'dmgMin' | 'dmgMax'>;
export const ROW_KEYS: readonly RowKey[] = ['dmg', 'pewnosc', 'upor', 'racja', 'crit', 'resMechaniczny', 'resRegulaminowy', 'resEgzystencjalny'];

export function rowText(b: StatBlock, key: RowKey): string {
  if (key === 'dmg') return b.dmgMax > 0 || b.dmgMin > 0 ? `${b.dmgMin}–${b.dmgMax}` : '';
  const v = b[key];
  if (v === 0) return '';
  return key === 'crit' || key.startsWith('res') ? `${num(v)}%` : num(v);
}

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
