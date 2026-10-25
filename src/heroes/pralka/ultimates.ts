/** The ultimates of the Pralka Emancypowana (S3): Pelny cykl. Each is a cast and a tick over the primitives (heroes/ultimateDefs.ts). */
import { applyStatus } from '../../combat/status';
import { enemiesWithin, setExistence, skillDamage } from '../helpers';
import type { HeroModule } from '../module';
import { buff, fx, heal, pull } from '../primitives';
import { defineUltimate, perSecond } from '../ultimateDefs';
import {
  REKLAMACJA_LOCK_S,
  REKLAMACJA_LOCKED,
  REKLAMACJA_MARK_S,
  REKLAMACJA_SIGNS,
  UZNANIE_DAMAGE,
  UZNANIE_EXISTENCE,
  UZNANIE_RADIUS,
  UZNANIE_UPOR,
} from './numbers';
import { releaseUznanie, runOf } from './running';

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

/**
 * Uznanie osobowosci (egzystencjalny, auto, level 24, 6 s): she is a person for the length of it: no status holds her, +30 upor, whoever
 * stands within 160 is struck 0.8x a second and holds on to no more than 0.3 of its existence. § 2 podpisane: 8 s, 0.5x a second. § 3
 * warunkowe: regulaminowy, 4 s, 1.5x a second, she cannot move; it costs 6 racja. (SKILLS.md asks 12 s for § 2; no ultimate runs past 8.)
 */
const uznanieOsobowosci = defineUltimate('pralka', {
  id: 'uznanieOsobowosci',
  level: 24,
  type: 'egzystencjalny',
  seconds: 6,
  radius: UZNANIE_RADIUS,
  two: { patch: { dur: 1.33, dmg: 0.63 } },
  three: { patch: { type: 'regulaminowy', dur: 0.67, dmg: 1.88, cost: 6 }, tune: { still: 1 } },
  cast({ c, p, u, tune }) {
    const run = runOf(c.s);
    if (run.ultUpor === 0) {
      buff(c, 'upor', UZNANIE_UPOR);
      run.ultUpor = UZNANIE_UPOR;
    }
    run.still = tune('still', 0) > 0;
    u.x = p.x;
    u.y = p.y;
    fx(c, 'section', p.x, p.y, tune('radius', UZNANIE_RADIUS));
  },
  tick(e, dt) {
    const { s, bus, p, u, tune } = e;
    const r = tune('radius', UZNANIE_RADIUS);
    u.x = p.x;
    u.y = p.y;
    p.statuses.length = 0; // no status holds a person
    for (const en of enemiesWithin(s, p.x, p.y, r)) setExistence(en, UZNANIE_EXISTENCE);
    perSecond(u, dt, () => {
      for (const en of enemiesWithin(s, p.x, p.y, r)) skillDamage(s, bus, en, e.type, UZNANIE_DAMAGE * u.dmg);
    });
  },
  end(e) {
    releaseUznanie(e.s);
  },
});

/**
 * Reklamacja (regulaminowy, auto, level 36): the one page-wide ultimate, through a status. Every enemy on the page is zgloszony for
 * 8 s and struck once for 1.0x. § 2: mechaniczny, and the three nearest are also zablokowany for 2 s. § 3 odrzucona: egzystencjalny,
 * 2.0x, and only the enemies whose claim still stands (not yet rebutted); it costs 6 racja.
 */
const reklamacja = defineUltimate('pralka', {
  id: 'reklamacja',
  level: 36,
  type: 'regulaminowy',
  seconds: 2,
  radius: null,
  pageWide: true,
  two: { patch: { type: 'mechaniczny' }, tune: { lock: 1 } },
  three: { patch: { type: 'egzystencjalny', dmg: 2, cost: 6 }, tune: { unrebutted: 1 } },
  cast({ c, s, bus, p, u, tune, type }) {
    const onlyOpen = tune('unrebutted', 0) > 0;
    const struck = s.enemies.filter((en) => !onlyOpen || (en.claim !== undefined && en.claim.struck !== true));
    const nearest = [...struck].sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
    nearest.forEach((en, i) => {
      applyStatus(en, 'zgloszony', REKLAMACJA_MARK_S, p.id);
      if (tune('lock', 0) > 0 && i < REKLAMACJA_LOCKED && !en.boss) applyStatus(en, 'zablokowany', REKLAMACJA_LOCK_S, p.id);
      if (i < REKLAMACJA_SIGNS) fx(c, 'section', en.x, en.y - en.r, en.r + 6); // a struck number over each
      skillDamage(s, bus, en, type, u.dmg);
    });
  },
});

export const ultimates: NonNullable<HeroModule['ultimates']> = [pelnyCykl, uznanieOsobowosci, reklamacja];
