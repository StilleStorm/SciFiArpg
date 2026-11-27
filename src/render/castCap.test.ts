import { describe, expect, it } from 'vitest';
import { castOverflow, MAX_CASTS } from './heroFx';

describe('the cast drawings cap', () => {
  it('lets drawings through under the cap and erases the oldest over it', () => {
    expect(castOverflow(0)).toBe(0);
    expect(castOverflow(MAX_CASTS - 1)).toBe(0);
    expect(castOverflow(MAX_CASTS)).toBe(1);
    expect(castOverflow(MAX_CASTS + 3)).toBe(4);
  });
});
