import { describe, expect, it } from 'vitest';
import { tickStatuses, type HasStatuses } from './status';

describe('tickStatuses', () => {
  it('decrements and removes expired statuses', () => {
    const e: HasStatuses = {
      statuses: [
        { kind: 'zablokowany', remaining: 0.5, source: 1 },
        { kind: 'zgloszony', remaining: 0.1, source: null },
      ],
    };
    tickStatuses(e, 0.2);
    expect(e.statuses.map((s) => s.kind)).toEqual(['zablokowany']);
    expect(e.statuses[0]?.remaining).toBeCloseTo(0.3);
    tickStatuses(e, 0.5);
    expect(e.statuses).toEqual([]);
  });
});
