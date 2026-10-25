/** The ultimates of the Petlowiec (S3): Zebranie wszystkich petli. */
import { applyStatus } from '../../combat/status';
import { knockback } from '../../systems/combat';
import { resolveMove } from '../../world/pages';
import { aoe, fx, heal, summon, teleport } from '../primitives';
import { enemiesWithin, setExistence, skillDamage } from '../helpers';
import type { HeroModule } from '../module';
import { defineUltimate, type UltEnv } from '../ultimateDefs';
import {
  COFNIECIE_BACK_LONG_S,
  COFNIECIE_BACK_S,
  COFNIECIE_DAMAGE,
  COFNIECIE_LOCK_S,
  PRZEDWCZESNY_DAMAGE,
  PRZEDWCZESNY_EXISTENCE,
  PRZEDWCZESNY_GAP_S,
  PRZEDWCZESNY_PUSH,
  PRZEDWCZESNY_R,
} from './numbers';
import { copiesOf } from './quirk';
import { petlState } from './state';

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

/**
 * Cofnięcie zgłoszenia (mechaniczny, auto, level 24): the last 6 s are withdrawn. He and every enemy (not a boss) go back to where
 * they stood then, his racja is raised to what it was; the dead stay crossed out, and every enemy left takes 1.5x. Page-wide, and the
 * only one of the hero that is. § 2 sprostowanie: 10 s back, no blow. § 3 częściowe: egzystencjalny, only he returns, every enemy is
 * zablokowany for 2 s; it costs 6 racja. (The footnote slip retracting its last line is the ui's, not built: a SEAM.)
 */
const cofniecie = defineUltimate('petlowiec', {
  id: 'cofniecie',
  level: 24,
  type: 'mechaniczny',
  seconds: 1,
  radius: null,
  pageWide: true,
  two: { patch: { dmg: 0 }, tune: { back: COFNIECIE_BACK_LONG_S } },
  three: { patch: { type: 'egzystencjalny', cost: 6 }, tune: { partial: 1 } },
  cast({ c, s, bus, p, u, tune, type }) {
    const partial = tune('partial', 0) > 0;
    const want = s.time - tune('back', COFNIECIE_BACK_S);
    const here = petlState(s).snaps.filter((x) => x.page === s.pageIndex);
    const snap = here.find((x) => x.t >= want) ?? here[here.length - 1];
    const from = { x: p.x, y: p.y };
    if (snap) {
      teleport(c, { x: snap.x, y: snap.y, resolve: true });
      heal(c, { atLeast: snap.hp });
      if (!partial) {
        for (const en of s.enemies) {
          const at = snap.at.get(en.id);
          if (!at || en.boss) continue;
          en.x = at[0];
          en.y = at[1];
          resolveMove(s.page, en, en.r);
        }
      }
    }
    fx(c, 'ring', from.x, from.y, p.r + 26);
    u.x = p.x;
    u.y = p.y;
    for (const en of [...s.enemies]) {
      if (partial && !en.boss) applyStatus(en, 'zablokowany', COFNIECIE_LOCK_S, p.id);
      if (u.dmg > 0) skillDamage(s, bus, en, type, COFNIECIE_DAMAGE * u.dmg);
    }
    petlState(s).snaps.length = 0; // a second withdrawal does not return to the same moment
    bus.emit('footnote:retract'); // the slip withdraws its last line too (SKILLS section 3)
  },
});

/** Where the capsules fall: on him and on each copy (§ 3: on him only). */
function landings(e: UltEnv): { x: number; y: number }[] {
  const { s, p, tune } = e;
  return tune('only', 0) > 0 ? [{ x: p.x, y: p.y }] : [{ x: p.x, y: p.y }, ...copiesOf(s)];
}

/** One fall of the capsule on every landing: 2.5x within 100 of each, and a push in § 2. */
function fall(e: UltEnv): void {
  const { c, s, bus, u, tune, type } = e;
  for (const at of landings(e)) {
    fx(c, 'capsule', at.x, at.y, PRZEDWCZESNY_R);
    aoe(c, {
      x: at.x,
      y: at.y,
      r: PRZEDWCZESNY_R,
      each: (en) => {
        if (skillDamage(s, bus, en, type, PRZEDWCZESNY_DAMAGE * u.dmg)) return;
        const away = tune('push', 0);
        if (away > 0 && !en.boss) knockback(s, en, at.x, at.y, away);
      },
    });
  }
}

/**
 * Przedwczesny powrót (egzystencjalny, auto, level 36, 2 s): the capsule he arrived in falls on him and on every copy at once, 2.5x
 * within 100 of each, and the generated inside it hold to 0.3 of their existence while it lasts. § 2 zderzenie: mechaniczny, a push of
 * 90. § 3 trzy kapsuły: three falls 0.5 s apart on him only, 1.5x each; it costs 6 racja.
 */
const przedwczesny = defineUltimate('petlowiec', {
  id: 'przedwczesny',
  level: 36,
  type: 'egzystencjalny',
  seconds: 2,
  radius: null,
  two: { patch: { type: 'mechaniczny' }, tune: { push: PRZEDWCZESNY_PUSH } },
  three: { patch: { dur: 0.75, dmg: 0.6, cost: 6 }, tune: { volley: 3, only: 1 } },
  cast(e) {
    fall(e);
  },
  tick(e, dt) {
    const { s, u, tune } = e;
    for (const at of landings(e)) for (const en of enemiesWithin(s, at.x, at.y, PRZEDWCZESNY_R)) setExistence(en, PRZEDWCZESNY_EXISTENCE);
    if (u.ids.length >= tune('volley', 1) - 1) return;
    u.acc += dt;
    if (u.acc < PRZEDWCZESNY_GAP_S - 1e-6) return;
    u.acc -= PRZEDWCZESNY_GAP_S;
    u.ids.push(u.ids.length + 1);
    fall(e);
  },
});

export const ultimates: NonNullable<HeroModule['ultimates']> = [zebranie, cofniecie, przedwczesny];
