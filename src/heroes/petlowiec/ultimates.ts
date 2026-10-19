/** The ultimates of the Petlowiec (S3): Zebranie wszystkich petli. */
import { aoe, fx, summon } from '../primitives';
import { skillDamage } from '../helpers';
import type { HeroModule } from '../module';
import { defineUltimate } from '../ultimateDefs';

const COPIES = 4;
const RING_R = 42;
const SPOR_R = 85;
const SPOR_DAMAGE = 0.6;
const COPY_DAMAGE = 0.7;

/**
 * Zebranie wszystkich petli (regulaminowy, auto, 12): four copies for 6 s, past the usual limit of copies, each casting Spor on
 * arrival (an area of 85 around it). The copies stand in a ring round him (his own path). § 2: six copies, 3 s. § 3: egzystencjalny,
 * two copies that hit half as hard again as the others.
 */
const zebranie = defineUltimate('petlowiec', {
  id: 'zebranie',
  type: 'regulaminowy',
  seconds: 6,
  radius: null,
  two: { patch: { count: 2, dur: 0.5 } },
  three: { patch: { type: 'egzystencjalny', count: -2, dmg: 1.5, cost: 6 } },
  cast(e) {
    const { c, s, bus, p, u, patch, type } = e;
    const n = Math.max(1, COPIES + (patch.count ?? 0));
    const start = s.rngs.combat.range(0, Math.PI * 2);
    for (let k = 0; k < n; k++) {
      const a = start + (k / n) * Math.PI * 2;
      const m = summon(c, {
        variant: 'copy',
        heroId: p.heroId,
        x: p.x + Math.cos(a) * RING_R,
        y: p.y + Math.sin(a) * RING_R,
        settle: true,
        ttl: u.dur,
        damageType: type,
        attackRange: p.attackRange,
        attackCooldown: p.attackCooldown * 0.9,
        damageMul: COPY_DAMAGE * u.dmg,
        r: p.r,
        speed: p.speed * 0.9,
        facing: p.facing,
      });
      fx(c, 'ring', m.x, m.y, SPOR_R);
      aoe(c, { x: m.x, y: m.y, r: SPOR_R, each: (en) => void skillDamage(s, bus, en, type, SPOR_DAMAGE * u.dmg) });
    }
  },
});

export const ultimates: NonNullable<HeroModule['ultimates']> = [zebranie];
