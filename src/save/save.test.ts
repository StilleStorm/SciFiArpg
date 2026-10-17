import { describe, expect, it } from 'vitest';
import { SAVE_KEY, defaultMeta, loadMeta, saveMeta } from './save';

function memory(initial?: string) {
  const m = new Map<string, string>();
  if (initial !== undefined) m.set(SAVE_KEY, initial);
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe('save', () => {
  it('round-trips', () => {
    const store = memory();
    const meta = { ...defaultMeta(), stamps: 4, runsCompleted: 2, heroId: 'pralka' as const };
    expect(saveMeta(meta, store)).toBe(true);
    expect(loadMeta(store)).toEqual(meta);
  });
  it('survives garbage, missing storage and throwing storage', () => {
    expect(loadMeta(memory('{not json'))).toEqual(defaultMeta());
    expect(loadMeta(memory('[1]'))).toEqual(defaultMeta());
    expect(loadMeta(null)).toEqual(defaultMeta());
    expect(saveMeta(defaultMeta(), null)).toBe(false);
    const bad = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadMeta(bad)).toEqual(defaultMeta());
    expect(saveMeta(defaultMeta(), bad)).toBe(false);
  });
});
