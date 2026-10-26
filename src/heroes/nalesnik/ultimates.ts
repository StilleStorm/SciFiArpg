/** The ultimates of the Nalesnik: Decyzja Komisji (S3), Zderzenie and Pelnia (S21). */
import { applyStatus } from '../../combat/status';
import { recomputeStats } from '../../items/stats';
import type { RunState } from '../../world/run';
import { enemiesWithin, skillDamage } from '../helpers';
import type { HeroModule } from '../module';
import { fx, heal, summon, zone } from '../primitives';
import { KSIEZYC_HIT_R } from '../numbers';
import { syncMoonUpor } from '../steps2';
import { defineUltimate, perSecond, type UltEnv } from '../ultimateDefs';
import {
  PELNIA_DAMAGE,
  PELNIA_FROM,
  PELNIA_KNOCK,
  PELNIA_MOONS,
  PELNIA_S,
  PELNIA_TO,
  PELNIA_TWO_MOONS_S,
  PELNIA_UPOR,
  ZDERZENIE_CRATER_R,
  ZDERZENIE_CRATER_S,
  ZDERZENIE_DAMAGE,
  ZDERZENIE_PLACE,
  ZDERZENIE_REACH,
  ZDERZENIE_S,
  ZDERZENIE_TEREN_EVERY,
  ZDERZENIE_TEREN_R,
  ZDERZENIE_TOUCH,
} from './numbers';
import { rollBy } from './quirk';
import { nalState } from './state';

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

/** The place within `reach` of him where the most enemies stand within `r` (an ultimate has no aim): the heart of the biggest crowd, else a spot ahead of him. */
function crowdCentre(s: RunState, reach: number, r: number): { x: number; y: number } {
  const p = s.player;
  let at = { x: p.x + p.facing * 90, y: p.y };
  let best = 0;
  for (const e of s.enemies) {
    if (Math.hypot(e.x - p.x, e.y - p.y) > reach) continue;
    const n = enemiesWithin(s, e.x, e.y, r).length;
    if (n > best) {
      best = n;
      at = { x: e.x, y: e.y };
    }
  }
  return at;
}

/** The roll has stopped (its length is covered or a wall is in the way): the crater is made where he stands, and § 2 lays Teren along the path. */
function landCollision(e: UltEnv): void {
  const { s, c, p, u } = e;
  const k = nalState(s);
  const col = k.collision;
  if (!col) return;
  k.collision = null;
  const z = zone(c, { variant: 'krater', x: p.x, y: p.y, r: ZDERZENIE_CRATER_R, ttl: ZDERZENIE_CRATER_S, own: true, max: 2 });
  k.craters.push({ zone: z.id, x: p.x, y: p.y, r: ZDERZENIE_CRATER_R, until: s.time + ZDERZENIE_CRATER_S, type: col.type, mul: 0, mark: true, acc: 0 });
  fx(c, 'ring', p.x, p.y, ZDERZENIE_CRATER_R);
  u.x = p.x;
  u.y = p.y;
  if (!col.teren) return;
  // § 2: the path itself becomes Teren nieistniejacy (heroes/system.ts steps it: do_weryfikacji and a lowered existence)
  const len = Math.hypot(p.x - col.from.x, p.y - col.from.y);
  for (let d = ZDERZENIE_TEREN_EVERY / 2; d < len; d += ZDERZENIE_TEREN_EVERY) {
    zone(c, { variant: 'teren', x: col.from.x + (col.dx * d), y: col.from.y + (col.dy * d), r: ZDERZENIE_TEREN_R, ttl: ZDERZENIE_CRATER_S });
  }
}

/**
 * Zderzenie (mechaniczny, kierunek in the table, here toward the heart of the biggest crowd within 300 or the way he faces, 24): he
 * rolls 600 along it through the enemies (a wall stops him), 3.0x to everyone on the path, and a crater with do_weryfikacji stays
 * 4 s where he stops. § 2: egzystencjalny, the path itself becomes Teren nieistniejacy. § 3: regulaminowy, reach 300, 4.0x.
 */
const zderzenie = defineUltimate('nalesnik', {
  id: 'zderzenie',
  level: 24,
  type: 'mechaniczny',
  seconds: ZDERZENIE_S + 0.1,
  radius: null,
  two: { patch: { type: 'egzystencjalny', cost: 4 }, tune: { teren: 1 } },
  three: { patch: { type: 'regulaminowy', dmg: 4 / 3, cost: 6 }, tune: { reach: ZDERZENIE_REACH / 2 } },
  cast(e) {
    const { s, c, p, u } = e;
    const at = crowdCentre(s, ZDERZENIE_PLACE, 60);
    const d = Math.hypot(at.x - p.x, at.y - p.y);
    const dx = d < 8 ? p.facing : (at.x - p.x) / d;
    const dy = d < 8 ? 0 : (at.y - p.y) / d;
    const reach = e.tune('reach', ZDERZENIE_REACH);
    nalState(s).collision = { dx, dy, left: ZDERZENIE_S, speed: reach / ZDERZENIE_S, type: e.type, mul: ZDERZENIE_DAMAGE * u.dmg, teren: e.tune('teren', 0) > 0, hit: [], from: { x: p.x, y: p.y } };
    p.target = null;
    if (Math.abs(dx) > 0.2) p.facing = dx > 0 ? 1 : -1;
    fx(c, 'dash', p.x, p.y, 0, p.x + dx * reach, p.y + dy * reach);
  },
  tick(e, dt) {
    const { s, bus, p, u } = e;
    const col = nalState(s).collision;
    if (!col) return;
    const stopped = rollBy(s, col.dx, col.dy, Math.min(col.left, dt) * col.speed);
    u.x = p.x;
    u.y = p.y;
    for (const en of [...s.enemies]) {
      if (col.hit.includes(en.id) || Math.hypot(en.x - p.x, en.y - p.y) > p.r + en.r + ZDERZENIE_TOUCH) continue;
      col.hit.push(en.id);
      skillDamage(s, bus, en, col.type, col.mul);
    }
    col.left -= dt;
    if (col.left <= 0 || stopped) landCollision(e);
  },
  end: landCollision,
});

/** Pelnia's moons are summons of variant moon whose orbit widens (heroes/steps2.ts stepMoon reads `grow`); the +20 upor is taken back when it ends. */
function endPelnia(e: UltEnv): void {
  const k = nalState(e.s);
  if (k.pelniaUpor === 0) return;
  e.p.baseStats.stats.upor -= k.pelniaUpor;
  k.pelniaUpor = 0;
  recomputeStats(e.p);
}

/**
 * Pelnia (egzystencjalny, auto, 36): three moons for 8 s on orbits that widen from 90 to 160, 0.7x to whoever one passes, +30 upor
 * (the moon's own 10 and 20 more). § 2: mechaniczny, the moons knock back 40. § 3: regulaminowy, two moons that stay 14 s (the
 * record of the ultimate ends at 8; the moons, like a skill's, keep their own time).
 */
const pelnia = defineUltimate('nalesnik', {
  id: 'pelnia',
  level: 36,
  type: 'egzystencjalny',
  seconds: PELNIA_S,
  radius: PELNIA_TO,
  two: { patch: { type: 'mechaniczny', cost: 4 }, tune: { knock: PELNIA_KNOCK } },
  three: { patch: { type: 'regulaminowy', cost: 6 }, tune: { moons: 2, ttl: PELNIA_TWO_MOONS_S } },
  cast(e) {
    const { s, c, p, u } = e;
    const n = Math.round(e.tune('moons', PELNIA_MOONS));
    const ttl = e.tune('ttl', PELNIA_S);
    const knock = e.tune('knock', 0);
    for (let i = 0; i < n; i++) {
      summon(c, {
        variant: 'moon',
        heroId: p.heroId,
        x: p.x,
        y: p.y,
        ttl,
        damageType: e.type,
        attackRange: 0,
        damageMul: PELNIA_DAMAGE * u.dmg,
        r: KSIEZYC_HIT_R,
        orbit: { angle: (i * Math.PI * 2) / n, r: 0, ring: PELNIA_TO, hits: {}, grow: { from: PELNIA_FROM, to: PELNIA_TO, born: s.time, over: ttl }, ...(knock > 0 ? { knock } : {}) },
      });
    }
    syncMoonUpor(s);
    const k = nalState(s);
    if (k.pelniaUpor === 0) {
      p.baseStats.stats.upor += PELNIA_UPOR;
      k.pelniaUpor = PELNIA_UPOR;
      recomputeStats(p);
    }
    u.x = p.x;
    u.y = p.y;
    fx(c, 'ring', p.x, p.y, PELNIA_TO);
  },
  tick(e) {
    e.u.x = e.p.x;
    e.u.y = e.p.y;
  },
  end: endPelnia,
});

export const ultimates: NonNullable<HeroModule['ultimates']> = [decyzja, zderzenie, pelnia];
