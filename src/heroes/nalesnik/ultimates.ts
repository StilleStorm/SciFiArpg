/** The ultimates of the Nalesnik (S3): Decyzja Komisji. */
import { applyStatus } from '../../combat/status';
import { enemiesWithin, skillDamage } from '../helpers';
import type { HeroModule } from '../module';
import { fx, heal } from '../primitives';
import { defineUltimate, perSecond } from '../ultimateDefs';

const RADIUS = 200;
const LOCK_S = 1.5;
const ENTRY_DAMAGE = 1;
const HEAL_PER_S = 6;

/**
 * Decyzja Komisji (regulaminowy, auto, 12): for 8 s a Wniosek of radius 200 moves with him, and whoever enters it (once) is
 * zablokowany for 1.5 s and takes 1.0x; he gains 6 racja a second. § 2 odmowna: egzystencjalny, 4 s, 2.0x. § 3 warunkowa:
 * mechaniczny, no lock, instead 0.5x to everyone inside each second.
 */
const decyzja = defineUltimate('nalesnik', {
  id: 'decyzjaKomisji',
  type: 'regulaminowy',
  seconds: 8,
  radius: RADIUS,
  two: { patch: { type: 'egzystencjalny', dur: 0.5, dmg: 2, cost: 8 } },
  three: { patch: { type: 'mechaniczny', cost: 6 }, tune: { noLock: 1, perSec: 0.5 } },
  cast({ c, p }) {
    fx(c, 'ring', p.x, p.y, RADIUS);
  },
  tick(e, dt) {
    const { s, bus, p, u, tune } = e;
    u.x = p.x;
    u.y = p.y;
    const inside = enemiesWithin(s, p.x, p.y, RADIUS);
    for (const en of inside) {
      if (u.ids.includes(en.id)) continue;
      u.ids.push(en.id);
      if (tune('noLock', 0) === 0 && !en.boss) applyStatus(en, 'zablokowany', LOCK_S, p.id);
      if (tune('perSec', 0) === 0) skillDamage(s, bus, en, e.type, ENTRY_DAMAGE * u.dmg);
    }
    heal(e.c, { amount: HEAL_PER_S * dt });
    const each = tune('perSec', 0);
    if (each > 0) perSecond(u, dt, () => {
      for (const en of enemiesWithin(s, p.x, p.y, RADIUS)) skillDamage(s, bus, en, e.type, each * u.dmg);
    });
  },
});

export const ultimates: NonNullable<HeroModule['ultimates']> = [decyzja];
