import { describe, expect, it } from 'vitest';
import { makeEnemy } from '../enemies/make';
import { rtOf } from '../enemies/runtime';
import { BUBBLE_CAP, BUBBLE_NEW_S, BUBBLE_RADIUS, bubbleShown, nearestBubbleEnemy, pickBubbles, shiftInto, updateBubbleFocus } from './bubbleFocus';

const at = (id: number, x: number, y: number, opts: Parameters<typeof makeEnemy>[5] = {}) => {
  const e = makeEnemy(id, x, y, id, 'urzadzenia', opts);
  rtOf(e).age = 30; // long since drawn in
  return e;
};

describe('claim bubble focus', () => {
  const p = { x: 500, y: 500 };

  it('picks the nearest enemy within 260 units and nobody beyond', () => {
    const a = at(1, 500 + 200, 500);
    const b = at(2, 500 + 100, 500);
    const far = at(3, 500 + BUBBLE_RADIUS + 30, 500);
    expect(nearestBubbleEnemy([a, b, far], p)).toBe(b);
    expect(nearestBubbleEnemy([far], p)).toBeNull();
  });

  it('shows at most two: bosses, then elites, then the nearest; the newly drawn count toward the cap', () => {
    const near = at(1, 600, 500);
    const other = at(2, 700, 500);
    const elite = at(3, 1000, 1000, { elite: 'zweryfikowany' });
    const fresh = at(4, 1100, 1100);
    rtOf(fresh).age = BUBBLE_NEW_S - 0.5;
    expect(BUBBLE_CAP).toBe(2);
    updateBubbleFocus([near, other, elite, fresh], p);
    expect(bubbleShown(elite)).toBe(true);
    expect(bubbleShown(near)).toBe(true);
    expect(bubbleShown(other)).toBe(false);
    expect(bubbleShown(fresh)).toBe(false);
    // without the near one, the fresh one (beyond the radius, in its grace) takes the second place
    expect(pickBubbles([other, elite, fresh].filter((e) => e !== other), p)).toEqual([elite.id, fresh.id]);
    rtOf(fresh).age = BUBBLE_NEW_S + 0.1;
    expect(pickBubbles([elite, fresh], p)).toEqual([elite.id]);
    const boss = at(5, 1200, 1200);
    boss.boss = true;
    expect(pickBubbles([near, elite, boss], p)).toEqual([boss.id, elite.id]);
  });

  it('a crowd of six still shows two, and the one shown keeps its place in a near tie', () => {
    const crowd = [0, 1, 2, 3, 4, 5].map((i) => at(10 + i, 520 + i * 12, 500));
    expect(pickBubbles(crowd, p)).toEqual([10, 11]);
    expect(pickBubbles(crowd, p, 2, new Set([12]))).toEqual([12, 10]);
    expect(pickBubbles(crowd, p, 2, new Set([15]))).toEqual([10, 11]);
  });

  it('enemies without a claim never take a place', () => {
    const quiet = at(20, 510, 500);
    delete quiet.claim;
    const talker = at(21, 600, 500);
    expect(pickBubbles([quiet, talker], p)).toEqual([talker.id]);
  });

  it('every claim bubble keeps quiet while a stamp is on the page', () => {
    const near = at(1, 600, 500);
    updateBubbleFocus([near], p, { hush: true });
    expect(bubbleShown(near)).toBe(false);
    updateBubbleFocus([near], p);
    expect(bubbleShown(near)).toBe(true);
  });

  it('shifts a span inward rather than letting it run past an edge', () => {
    expect(shiftInto(-20, 80, 0, 390)).toBe(20);
    expect(shiftInto(350, 420, 0, 390)).toBe(-30);
    expect(shiftInto(100, 200, 0, 390)).toBe(0);
    expect(shiftInto(-10, 500, 0, 390)).toBe(10);
  });
});
