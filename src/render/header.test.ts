import { describe, expect, it } from 'vitest';
import { t } from '../i18n';
import { headerBox, wrapLines } from './obstacles';
import lawsJson from '../i18n/pl/laws.json';
import { tapesOnPage } from './tunnelFx';

const page = { w: 1200, torn: 'bl' as const, exit: null };

describe('the clause header', () => {
  it('spans the page in landscape and the visible span in portrait, two lines at most', () => {
    const wide = headerBox(page);
    expect(wide.x0).toBe(52);
    expect(wide.x1).toBe(1148);
    expect(wide.maxLines).toBe(3);
    const view = { x0: 400, x1: 790 };
    const narrow = headerBox(page, view);
    expect(narrow.x0).toBeGreaterThanOrEqual(view.x0);
    expect(narrow.x1).toBeLessThanOrEqual(view.x1);
    expect(narrow.maxLines).toBe(2);
    expect(narrow.size).toBeLessThan(wide.size);
  });

  it('keeps inside the page at its left edge and goes below a torn corner that leaves no room', () => {
    const left = headerBox(page, { x0: -60, x1: 330 });
    expect(left.x0).toBe(52);
    expect(left.x1).toBe(306);
    const torn = headerBox({ ...page, torn: 'tl' }, { x0: -60, x1: 330 });
    expect(torn.x1 - torn.x0).toBeGreaterThan(200);
    expect(torn.y).toBeGreaterThan(left.y);
  });

  it('every clause fits two lines of the portrait box, cut after a whole sentence when it is longer', () => {
    const box = headerBox(page, { x0: 400, x1: 790 });
    const ids = Object.entries(lawsJson).filter(([, v]) => typeof v === 'object' && v !== null && 'header' in v).map(([k]) => k);
    expect(ids.length).toBeGreaterThanOrEqual(9);
    for (const id of ids) {
      const clause = t(`laws.${id}.header`, { planet: 'Planecie Czterdziestej Piątej' });
      const lines = wrapLines(clause, box.maxChars, box.maxLines);
      expect(lines.length).toBeLessThanOrEqual(2);
      for (const l of lines) expect(l.length).toBeLessThanOrEqual(box.maxChars);
      expect(clause.startsWith(lines.join(' '))).toBe(true);
      expect(lines.join(' ')).toMatch(/[.!?]$/);
    }
  });

  it('a text without a sentence that fits is cut with an ellipsis', () => {
    const lines = wrapLines('jedno dwa trzy cztery pięć sześć siedem osiem dziewięć dziesięć', 12, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1]?.endsWith('\u2026')).toBe(true);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(12);
  });
});

describe('the tape of a repaired hole', () => {
  it('stays on its own page only', () => {
    const tapes = [
      { x: 1, y: 1, page: 1 },
      { x: 2, y: 2, page: 2 },
    ];
    expect(tapesOnPage(tapes, 1)).toEqual([{ x: 1, y: 1, page: 1 }]);
    expect(tapesOnPage(tapes, 3)).toEqual([]);
  });
});
