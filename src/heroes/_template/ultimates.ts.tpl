/** The ultimates of the __ID__ (DESIGN 10.2). TODO: the first ultimate from SKILLS.md (level 12) with § 2 and § 3; then 24 and 36. */
import { enemiesWithin, skillDamage } from '../helpers';
import type { HeroModule } from '../module';
import { fx } from '../primitives';
import { defineUltimate, perSecond } from '../ultimateDefs';

const RADIUS = 160;

/**
 * Placeholder: for 4 s everyone within 160 of the hero takes 0.5x each second (render/ultFx.ts outlines the radius).
 * Limits (heroes/ultimates.test.ts checks them): at most 8 s, one stamp, one page reaction, radius at most 220 or the hero's own path.
 */
const first = defineUltimate('__ID__', {
  id: '__ID__Ult',
  type: 'mechaniczny',
  seconds: 4,
  radius: RADIUS,
  two: { patch: { dur: 1.5, dmg: 0.6 } },
  three: { patch: { dmg: 1.6, cost: 6 } },
  cast({ c, p }) {
    fx(c, 'ring', p.x, p.y, RADIUS);
  },
  tick(e, dt) {
    const { s, bus, p, u } = e;
    u.x = p.x;
    u.y = p.y;
    perSecond(u, dt, () => {
      for (const en of enemiesWithin(s, p.x, p.y, RADIUS)) skillDamage(s, bus, en, e.type, 0.5 * u.dmg);
    });
  },
});

export const ultimates: NonNullable<HeroModule['ultimates']> = [first];
