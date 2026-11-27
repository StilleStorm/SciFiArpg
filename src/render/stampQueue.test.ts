import { afterEach, describe, expect, it } from 'vitest';
import { clearTweens, tickTweens } from './tween';
import { queueStamp, resetStampQueue, STAMP_GAP_MS, stampWait } from './stampQueue';

afterEach(() => {
  clearTweens();
  resetStampQueue();
});

describe('the stamp queue', () => {
  it('strikes the first at once and the second a gap later', () => {
    const log: string[] = [];
    expect(queueStamp(() => log.push('a'))).toBe(0);
    expect(log).toEqual(['a']);
    tickTweens(100);
    expect(queueStamp(() => log.push('b'))).toBeCloseTo(STAMP_GAP_MS - 100);
    expect(log).toEqual(['a']);
    tickTweens(290);
    expect(log).toEqual(['a']);
    tickTweens(20);
    expect(log).toEqual(['a', 'b']);
  });
  it('queues a third behind the second, and is quiet again after the gaps', () => {
    const log: string[] = [];
    queueStamp(() => log.push('a'));
    queueStamp(() => log.push('b'));
    expect(queueStamp(() => log.push('c'))).toBeCloseTo(2 * STAMP_GAP_MS);
    tickTweens(2 * STAMP_GAP_MS + 10);
    expect(log).toEqual(['a', 'b', 'c']);
    tickTweens(STAMP_GAP_MS + 50);
    expect(stampWait()).toBe(0);
    expect(queueStamp(() => log.push('d'))).toBe(0);
  });
});
