import { describe, expect, it } from 'vitest';
import { flatten, setTable, t } from './index';
import { bindOrphans, NBSP } from './typography';

describe('bindOrphans', () => {
  it('binds every one-letter word to the next word', () => {
    expect(bindOrphans('Kot i pies w domu')).toBe(`Kot i${NBSP}pies w${NBSP}domu`);
    expect(bindOrphans('A potem O świcie z lasu u cioci')).toBe(`A${NBSP}potem O${NBSP}świcie z${NBSP}lasu u${NBSP}cioci`);
    expect(bindOrphans('Z W U I x')).toBe(`Z${NBSP}W${NBSP}U${NBSP}I${NBSP}x`);
  });
  it('handles a run of one-letter words, brackets and digits', () => {
    expect(bindOrphans('a w z domu')).toBe(`a${NBSP}w${NBSP}z${NBSP}domu`);
    expect(bindOrphans('strona 2 z 5')).toBe(`strona 2 z${NBSP}5`);
    expect(bindOrphans('(w mieście)')).toBe(`(w${NBSP}mieście)`);
    expect(bindOrphans('«a potem»')).toBe(`«a${NBSP}potem»`);
  });
  it('leaves the ends of longer words and other letters alone', () => {
    expect(bindOrphans('kota pies woda')).toBe('kota pies woda');
    expect(bindOrphans('Ryc. 7 x y')).toBe('Ryc. 7 x y');
    expect(bindOrphans('tak, a')).toBe('tak, a');
    expect(bindOrphans('')).toBe('');
  });
  it('is idempotent', () => {
    const once = bindOrphans('Kot i pies w domu');
    expect(bindOrphans(once)).toBe(once);
  });
});

describe('t() applies the rule', () => {
  it('binds after interpolation too', () => {
    setTable(flatten({ k: 'Strona {page} z {total}, a potem w domu', n: 'nr {n}' }, 'x'));
    expect(t('x.k', { page: 2, total: 5 })).toBe(`Strona 2 z${NBSP}5, a${NBSP}potem w${NBSP}domu`);
    expect(t('x.n', { n: 4 })).toBe('nr 4');
  });
});
