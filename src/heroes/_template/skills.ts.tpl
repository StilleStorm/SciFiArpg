/** The casts of the hero, each a list of primitive calls (heroes/primitives). TODO: replace the placeholder area hits with the real skills. */
import { cast } from '../cast';
import { areaOf, power, skillDamage } from '../helpers';
import type { SkillFn } from '../module';
import { aoe, fx } from '../primitives';

/** Placeholder: a ring around the hero that hurts what is in it. */
const ring = (i: 0 | 1 | 2 | 3 | 4): SkillFn =>
  cast(i, [
    ({ c, s, bus, p, sk }) => {
      const radius = 90 * areaOf(s, i);
      fx(c, 'ring', p.x, p.y, radius);
      aoe(c, { x: p.x, y: p.y, r: radius, each: (e) => void skillDamage(s, bus, e, sk.type, power(s, i)) });
    },
  ]);

export const casts: Readonly<Record<string, SkillFn>> = { __ID__1: ring(0), __ID__2: ring(1), __ID__3: ring(2), __ID__4: ring(3), __ID__5: ring(4) };
