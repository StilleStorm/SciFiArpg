import { describe, expect, it } from 'vitest';
import { t } from '../i18n';
import { ARGUE_LINES } from './outcomes';

describe('S20 contract: the copy disagrees in a footnote', () => {
  it('every heroes.copy.argue.N line up to ARGUE_LINES exists and is not the bare key', () => {
    expect(ARGUE_LINES).toBeGreaterThan(0);
    for (let n = 1; n <= ARGUE_LINES; n++) {
      const key = `heroes.copy.argue.${n}`;
      const text = t(key);
      expect(text).not.toBe(key);
      expect(text.length).toBeGreaterThan(3);
    }
  });
  it('there is no line past ARGUE_LINES (the constant is not stale)', () => {
    const key = `heroes.copy.argue.${ARGUE_LINES + 1}`;
    expect(t(key)).toBe(key);
  });
});
