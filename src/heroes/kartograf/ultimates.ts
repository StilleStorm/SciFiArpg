/** The ultimates of the Kartograf (S3): Mapa ostateczna. */
import { applyStatus } from '../../combat/status';
import { pinExistence } from '../../enemies/hooks';
import type { Enemy } from '../../entities/types';
import { killEnemy } from '../../systems/combat';
import type { RunState } from '../../world/run';
import { enemiesWithin, skillDamage, touchStatus } from '../helpers';
import type { HeroModule } from '../module';
import { line, summon, zone } from '../primitives';
import { defineUltimate } from '../ultimateDefs';
import { critHit, lineHit } from './hits';
import {
  KONTROLNY_BENCH_S,
  KONTROLNY_CROSS_R,
  KONTROLNY_DAMAGE,
  KONTROLNY_PLACE,
  KONTROLNY_RAYS,
  KONTROLNY_RAYS_TWO,
  KONTROLNY_REACH,
  PRZEKROJ_HALF,
  SKRESLENIE_BELOW,
  SKRESLENIE_DAMAGE,
  SKRESLENIE_EXISTENCE,
  SKRESLENIE_H,
  SKRESLENIE_PLACE,
  SKRESLENIE_R,
  SKRESLENIE_W,
} from './numbers';
import { kartState } from './state';

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

/** The place within `reach` of him where the most enemies stand within `r` (an ultimate has no aim): the enemy at the heart of the biggest crowd, else a spot ahead of him. */
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

const inRect = (e: Enemy, x: number, y: number): boolean => Math.abs(e.x - x) <= SKRESLENIE_W / 2 + e.r && Math.abs(e.y - y) <= SKRESLENIE_H / 2 + e.r;

/**
 * Skreslenie z mapy (egzystencjalny, wskazanie in the table, here the heart of the crowd within 200, 24): a ruled rectangle of
 * 200 x 140. Wygenerowane below existence 0.5 are crossed out at once (a normal death); everything else in it takes 2.5x and is
 * held at existence 0.3. § 2: regulaminowy, no execute, 3.5x. § 3: the rectangle stays 5 s and holds as Teren nieistniejacy
 * (do_weryfikacji, existence 0.3).
 */
const skreslenie = defineUltimate('kartograf', {
  id: 'skreslenie',
  level: 24,
  type: 'egzystencjalny',
  seconds: 1.5,
  radius: SKRESLENIE_R,
  two: { patch: { type: 'regulaminowy', dmg: 1.4, cost: 4 }, tune: { execute: 0 } },
  three: { patch: { dur: 10 / 3, cost: 5 }, tune: { stay: 1 } },
  cast(e) {
    const { s, bus, u, c } = e;
    const at = crowdCentre(s, SKRESLENIE_PLACE, SKRESLENIE_R * 0.6);
    u.x = at.x;
    u.y = at.y;
    zone(c, { variant: 'skreslenie', x: at.x, y: at.y, r: SKRESLENIE_R, ttl: u.dur, own: true, max: 1 });
    const execute = e.tune('execute', 1) > 0;
    for (const en of s.enemies.filter((x) => inRect(x, at.x, at.y))) {
      if (execute && !en.boss && en.family === 'wygenerowane' && (en.existence ?? 1) < SKRESLENIE_BELOW) {
        if (!s.law.botTime) killEnemy(s, bus, en); // crossed out: a normal death with normal drops
        continue;
      }
      if (skillDamage(s, bus, en, e.type, SKRESLENIE_DAMAGE * u.dmg)) continue;
      pinExistence(en, SKRESLENIE_EXISTENCE, u.dur);
    }
  },
  tick(e) {
    if (e.tune('stay', 0) <= 0) return;
    const { s, u } = e;
    for (const en of s.enemies) {
      if (!inRect(en, u.x, u.y)) continue;
      touchStatus(en, 'do_weryfikacji', 0.6, s.player.id);
      pinExistence(en, SKRESLENIE_EXISTENCE, 0.6);
    }
  },
});

/**
 * Pomiar kontrolny (mechaniczny, wskazanie in the table, here the heart of the crowd within 200, 36): three survey lines from the
 * point at 120 degrees, reach 200, 1.8x each, and a crit on whoever stands where they cross. § 2: six lines at 60 degrees, 1.0x.
 * § 3: regulaminowy; the crossing is a benchmark for 20 s.
 */
const pomiarKontrolny = defineUltimate('kartograf', {
  id: 'pomiarKontrolny',
  level: 36,
  type: 'mechaniczny',
  seconds: 1.2,
  radius: KONTROLNY_REACH,
  two: { patch: { dmg: 1 / KONTROLNY_DAMAGE, cost: 4 }, tune: { rays: KONTROLNY_RAYS_TWO } },
  three: { patch: { type: 'regulaminowy', cost: 5 }, tune: { bench: 1 } },
  cast(e) {
    const { s, bus, p, u, c } = e;
    const at = crowdCentre(s, KONTROLNY_PLACE, KONTROLNY_CROSS_R * 2);
    u.x = at.x;
    u.y = at.y;
    const rays = Math.round(e.tune('rays', KONTROLNY_RAYS));
    const base = Math.atan2(at.y - p.y, at.x - p.x);
    const strikes: { e: Enemy; cross: boolean }[] = [];
    for (let k = 0; k < rays; k++) {
      const a = base + (k * Math.PI * 2) / rays;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      zone(c, { variant: 'przekroj', x: at.x, y: at.y, r: KONTROLNY_REACH, ttl: u.dur, angle: a, own: true, max: 12 });
      for (const { e: en } of line(c, { x: at.x, y: at.y, dx, dy, reach: KONTROLNY_REACH, half: PRZEKROJ_HALF })) {
        strikes.push({ e: en, cross: Math.hypot(en.x - at.x, en.y - at.y) <= KONTROLNY_CROSS_R + en.r });
      }
    }
    for (const st of strikes) {
      if (!s.enemies.includes(st.e)) continue;
      if (st.cross) critHit(s, bus, st.e, e.type, KONTROLNY_DAMAGE * u.dmg);
      else lineHit(s, bus, st.e, e.type, KONTROLNY_DAMAGE * u.dmg);
    }
    if (e.tune('bench', 0) > 0) {
      const m = summon(c, { variant: 'benchmark', heroId: p.heroId, x: at.x, y: at.y, ttl: KONTROLNY_BENCH_S, damageMul: 0, speed: 0, attackRange: 0, settle: true, max: 2 });
      kartState(s).benches.set(m.id, { pull: false, next: s.time });
    }
  },
});

export const ultimates: NonNullable<HeroModule['ultimates']> = [mapa, skreslenie, pomiarKontrolny];
