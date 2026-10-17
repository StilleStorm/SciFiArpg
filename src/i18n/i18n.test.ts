import { describe, expect, it, vi } from 'vitest';
import { flatten, genderForm, pluralCategory, setTable, t } from './index';

describe('pluralCategory', () => {
  it('follows Polish rules', () => {
    expect(pluralCategory(1)).toBe('one');
    for (const n of [2, 3, 4, 22, 23, 24, 102, 1002]) expect(pluralCategory(n)).toBe('few');
    for (const n of [0, 5, 11, 12, 13, 14, 15, 21, 25, 100, 111, 112, 114]) expect(pluralCategory(n)).toBe('many');
  });
});

describe('t', () => {
  it('interpolates and picks plural forms', () => {
    setTable(
      flatten({ a: { k: { one: '{count} rzecz', few: '{count} rzeczy', many: '{count} rzeczy' }, s: 'nr {n}' } }, 'x'),
    );
    expect(t('x.a.k', { count: 1 })).toBe('1 rzecz');
    expect(t('x.a.k', { count: 3 })).toBe('3 rzeczy');
    expect(t('x.a.s', { n: 7 })).toBe('nr 7');
  });
  it('returns the key and warns once for a missing key', () => {
    setTable(new Map());
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(t('nope.key')).toBe('nope.key');
    expect(t('nope.key')).toBe('nope.key');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe('genderForm', () => {
  it('selects by gender', () => {
    const forms = { m: 'służbowy', f: 'służbowa', n: 'służbowe', pl: 'służbowe' };
    expect(genderForm(forms, 'f')).toBe('służbowa');
  });
});
