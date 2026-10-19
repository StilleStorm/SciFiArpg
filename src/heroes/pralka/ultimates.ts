/** The ultimates of the Pralka Emancypowana (S3): Pelny cykl. Each is a cast and a tick over the primitives (heroes/ultimateDefs.ts). */
import { applyStatus } from '../../combat/status';
import { enemiesWithin, skillDamage } from '../helpers';
import type { HeroModule } from '../module';
import { fx, heal, pull } from '../primitives';
import { defineUltimate, perSecond } from '../ultimateDefs';

const RADIUS = 200;
const PULL_PER_S = 80;
const DAMAGE_PER_S = 0.6;
const LOCK_S = 2;

/**
 * Pelny cykl (mechaniczny, auto, 12): 5 s, everyone within 200 is pulled into the drum at 80/s and takes 0.6x each second; at the
 * end they drop zablokowany for 2 s. § 2 delikatny: 8 s, 0.3x/s, no lock, +3 racja/s. § 3 intensywny: regulaminowy, 3 s, 1.2x/s, r 140.
 */
const pelnyCykl = defineUltimate('pralka', {
  id: 'pelnyCykl',
  type: 'mechaniczny',
  seconds: 5,
  radius: RADIUS,
  two: { patch: { dur: 1.6, dmg: 0.5 }, tune: { noLock: 1, heal: 3 } },
  three: { patch: { type: 'regulaminowy', dur: 0.6, dmg: 2, cost: 8 }, tune: { radius: 140 } },
  cast({ c, p, tune }) {
    fx(c, 'swirl', p.x, p.y, tune('radius', RADIUS));
  },
  tick(e, dt) {
    const { s, bus, p, u, tune } = e;
    const r = tune('radius', RADIUS);
    u.x = p.x;
    u.y = p.y;
    const inside = enemiesWithin(s, p.x, p.y, r);
    for (const en of inside) if (!en.boss) pull(e.c, en, p, PULL_PER_S * s.law.knockbackMul * dt, p.r + en.r + 2);
    const heals = tune('heal', 0);
    if (heals > 0) heal(e.c, { amount: heals * dt });
    perSecond(u, dt, () => {
      for (const en of enemiesWithin(s, p.x, p.y, r)) skillDamage(s, bus, en, e.type, DAMAGE_PER_S * u.dmg);
    });
  },
  end(e) {
    const { p, tune } = e;
    if (tune('noLock', 0) > 0) return;
    for (const en of enemiesWithin(e.s, p.x, p.y, tune('radius', RADIUS))) if (!en.boss) applyStatus(en, 'zablokowany', LOCK_S, p.id);
  },
});

export const ultimates: NonNullable<HeroModule['ultimates']> = [pelnyCykl];
