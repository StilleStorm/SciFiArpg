import { describe, expect, it } from 'vitest';
import { caseTitle, checkName, errorText, NAME_MAX } from './rosterModel';

describe('case numbers', () => {
  it('trims, collapses spaces and refuses empty, long and taken numbers', () => {
    expect(checkName('  0007 ', [])).toEqual({ ok: true, name: '0007' });
    expect(checkName('a   b', [])).toEqual({ ok: true, name: 'a b' });
    expect(checkName('   ', [])).toEqual({ ok: false, error: 'nameEmpty' });
    expect(checkName('x'.repeat(NAME_MAX + 1), [])).toEqual({ ok: false, error: 'nameLong' });
    expect(checkName('abc', ['ABC'])).toEqual({ ok: false, error: 'nameTaken' });
  });
  it('prints the number after the words', () => {
    expect(caseTitle('0003')).toBe('Sprawa nr 0003');
  });
  it('words every known error and a stranger', () => {
    expect(errorText('nameLong')).toContain(String(NAME_MAX));
    expect(errorText('bagFull')).not.toContain('screens.');
    expect(errorText('whatever')).not.toContain('screens.');
  });
});
