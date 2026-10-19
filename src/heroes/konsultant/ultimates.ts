/** The ultimates of the Konsultant Infolinii (S3): Przekazanie do dzialu. */
import { applyStatus } from '../../combat/status';
import { skillDamage } from '../helpers';
import type { HeroModule } from '../module';
import { defineUltimate } from '../ultimateDefs';

const DAMAGE = 0.8;
/** Where the first strike lands from, between the enemies, once a second. */
const REDIRECT_STEP_S = 0.8;

/**
 * Przekazanie do dzialu (regulaminowy, auto, 12): every enemy on the page is zgloszony and attacks the nearest other enemy for 5 s,
 * and takes 0.8x once. The only page-wide ultimate of the hero, and it acts through that status (and the redirect the skill
 * Przekierowuje uses). § 2: egzystencjalny, 3 s, 1.5x. § 3: 8 s, no damage, every death drops a gwiazdka.
 */
const przekazanie = defineUltimate('konsultant', {
  id: 'przekazanie',
  type: 'regulaminowy',
  seconds: 5,
  radius: null,
  pageWide: true,
  two: { patch: { type: 'egzystencjalny', dur: 0.6, dmg: 1.875, cost: 6 } },
  three: { patch: { dur: 1.6, dmg: 0, cost: 5 }, tune: { gwiazdka: 1 } },
  cast(e) {
    const { s, bus, p, u } = e;
    for (const en of [...s.enemies]) {
      if (u.dmg > 0 && skillDamage(s, bus, en, e.type, DAMAGE * u.dmg)) continue; // it fell to the hit
      if (!s.enemies.includes(en)) continue;
      applyStatus(en, 'zgloszony', u.dur, p.id);
      if (en.boss) continue;
      en.attackTimer = Math.max(en.attackTimer, u.dur);
      s.hero.redirects = s.hero.redirects.filter((r) => r.id !== en.id);
      s.hero.redirects.push({ id: en.id, until: s.time + u.dur, next: s.time + REDIRECT_STEP_S * 0.4 });
    }
    u.seen = s.kills; // the kills of the opening strike are not the ones the gwiazdki are paid for
  },
  tick({ s, p, u, tune }) {
    const fallen = s.kills - u.seen;
    u.seen = s.kills;
    if (fallen > 0 && tune('gwiazdka', 0) > 0) p.gwiazdki += fallen * tune('gwiazdka', 0);
  },
});

export const ultimates: NonNullable<HeroModule['ultimates']> = [przekazanie];
