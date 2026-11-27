import { describe, expect, it } from 'vitest';
import { stampSoundDelay, STAMP_SOUND_GAP_MS } from './stampGap';
import { STAMP_GAP_MS } from '../render/stampQueue';

describe('stampSoundDelay', () => {
  it('plays a lone stamp at once and a second one after the gap, a third behind it', () => {
    const a = stampSoundDelay(1000, 0);
    expect(a.delayMs).toBe(0);
    const b = stampSoundDelay(1100, a.freeAtMs);
    expect(b.delayMs).toBe(300);
    const c = stampSoundDelay(1150, b.freeAtMs);
    expect(c.delayMs).toBe(650);
    expect(stampSoundDelay(5000, c.freeAtMs).delayMs).toBe(0);
  });
  it('keeps the same gap as the drawn stamp queue', () => {
    expect(STAMP_SOUND_GAP_MS).toBe(STAMP_GAP_MS);
  });
});
