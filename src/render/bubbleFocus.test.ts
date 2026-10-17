import { describe, expect, it } from 'vitest';
import { makeEnemy } from '../enemies/make';
import { rtOf } from '../enemies/runtime';
import { BUBBLE_NEW_S, BUBBLE_RADIUS, bubbleShown, nearestBubbleEnemy, updateBubbleFocus } from './bubbleFocus';

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

  it('shows the nearest, elites, bosses and the newly drawn; hides the rest', () => {
    const near = at(1, 600, 500);
    const other = at(2, 700, 500);
    const elite = at(3, 1000, 1000, { elite: 'zweryfikowany' });
    const fresh = at(4, 1100, 1100);
    rtOf(fresh).age = BUBBLE_NEW_S - 0.5;
    updateBubbleFocus([near, other, elite, fresh], p);
    expect(bubbleShown(near)).toBe(true);
    expect(bubbleShown(other)).toBe(false);
    expect(bubbleShown(elite)).toBe(true);
    expect(bubbleShown(fresh)).toBe(true);
    rtOf(fresh).age = BUBBLE_NEW_S + 0.1;
    expect(bubbleShown(fresh)).toBe(false);
    const boss = at(5, 1200, 1200);
    boss.boss = true;
    expect(bubbleShown(boss)).toBe(true);
  });
});
