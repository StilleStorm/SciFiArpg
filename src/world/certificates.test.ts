import { describe, expect, it } from 'vitest';
import { newCampaign } from './campaign';
import { certificatesOf } from './certificates';

describe('certificates', () => {
  it('a new case file has none', () => {
    expect(certificatesOf(newCampaign())).toEqual([]);
  });
  it('an act is certified when all three of its planets are closed', () => {
    expect(certificatesOf({ ...newCampaign(), closed: [0, 1] }).map((c) => c.id)).toEqual([]);
    expect(certificatesOf({ ...newCampaign(), closed: [0, 1, 2, 3] }).map((c) => c.id)).toEqual(['akt1']);
    expect(certificatesOf({ ...newCampaign(), closed: [8, 7, 6, 0, 1, 2] }).map((c) => c.id)).toEqual(['akt1', 'akt3']);
  });
  it('the closed case and the pisma tiers come after the acts, in order', () => {
    const c = { ...newCampaign(), closed: [0, 1, 2, 3, 4, 5, 6, 7, 8], caseClosed: true, extras: 10 };
    expect(certificatesOf(c).map((x) => x.id)).toEqual(['akt1', 'akt2', 'akt3', 'sprawa', 'pisma1', 'pisma10']);
    expect(certificatesOf({ ...c, extras: 30 }).map((x) => x.count ?? 0)).toEqual([0, 0, 0, 0, 1, 10, 25]);
    expect(certificatesOf({ ...c, extras: 0 }).map((x) => x.id)).toEqual(['akt1', 'akt2', 'akt3', 'sprawa']);
  });
});
