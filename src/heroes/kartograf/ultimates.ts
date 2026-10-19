/** The ultimates of the Kartograf (S3): Mapa ostateczna. */
import { applyStatus } from '../../combat/status';
import type { HeroModule } from '../module';
import { defineUltimate } from '../ultimateDefs';

/**
 * Mapa ostateczna (regulaminowy, auto, 12): 6 s at scale 1:1. Every enemy on the page is measured and zgloszony for the length of
 * it (the page-wide part, through that status); his auto fires twice and every line pierces (heroes/auto.ts reads `shots` and
 * `pierce` of the running record). § 2: 8 s (the cap), a single auto. § 3: mechaniczny, 4 s, the auto fires four times.
 */
const mapa = defineUltimate('kartograf', {
  id: 'mapaOstateczna',
  type: 'regulaminowy',
  seconds: 6,
  radius: null,
  pageWide: true,
  two: { patch: { dur: 4 / 3 }, tune: { shots: 1 } },
  three: { patch: { type: 'mechaniczny', dur: 2 / 3, cost: 6 }, tune: { shots: 4 } },
  cast(e) {
    const { s, p, u, tune } = e;
    for (const en of s.enemies) applyStatus(en, 'zgloszony', u.dur, p.id);
    u.shots = tune('shots', 2);
    u.pierce = true;
  },
});

export const ultimates: NonNullable<HeroModule['ultimates']> = [mapa];
