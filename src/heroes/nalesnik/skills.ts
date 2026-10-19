/** The casts of the Nalesnik, each a list of primitive calls (heroes/primitives). */
import { radiusOf, reachOf, resolveDirection, terenCentre } from '../aim';
import { cast } from '../cast';
import { areaOf, durationOf, power } from '../helpers';
import type { SkillFn } from '../module';
import { FLAG_S, GRAVITY_R, GRAVITY_S, ORBITA_TIME } from './steps';
import { KSIEZYC_DAMAGE, KSIEZYC_HIT_R, KSIEZYC_ORBIT, KSIEZYC_S, PLYWY_R } from '../numbers';
import { dash, fx, summon, zone } from '../primitives';
import { syncMoonUpor } from '../steps2';

/** Orbita: a roll along the line (heroes/nalesnik.ts steps it); the first enemy hit that survives becomes a satellite for 3 s. */
const orbita = cast(0, [
  ({ c, s, sk, aim }) => {
    const a = resolveDirection(s, sk, aim);
    dash(c, { dx: a.dx, dy: a.dy, len: reachOf(s, sk), time: ORBITA_TIME, kind: 'roll', rank: s.hero.ranks[0], face: true });
  },
]);

/** Grawitacja wlasna: for 2 s everything within 180 units, loot included, falls toward the hero (heroes/nalesnik.ts). */
const grawitacja = cast(1, [
  ({ c, s, p }) => {
    const radius = GRAVITY_R * areaOf(s, 1);
    s.hero.gravity = { left: GRAVITY_S * durationOf(s, 1), radius, rim: [] };
    fx(c, 'swirl', p.x, p.y, radius);
  },
]);

/** Wniosek o status: a flag at the point, one at a time; within its zone the pancake is officially a planet. */
const wniosek = cast(2, [
  ({ c, s, sk, aim }) => {
    const { x, y } = terenCentre(s, sk, aim);
    const r = radiusOf(s, sk);
    zone(c, { x, y, variant: 'wniosek', r, ttl: FLAG_S * durationOf(s, 2), inside: [], max: 1 });
    fx(c, 'ring', x, y, r);
  },
]);

/** Plywy: the tide ring runs out from the rim (heroes/steps2.ts stepTide). */
const plywy = cast(3, [
  ({ c, s, p }) => {
    const max = PLYWY_R * areaOf(s, 3);
    s.hero.tide = { age: 0, radius: 0, max, hit: [] };
    fx(c, 'tide', p.x, p.y, max);
  },
]);

/** Ksiezyc: a pebble launched along the direction, settling on its circle; one moon at a time, +10 upor while it lasts. */
const ksiezyc = cast(4, [
  ({ c, s, p, sk, aim }) => {
    const a = resolveDirection(s, sk, aim);
    summon(c, {
      variant: 'moon',
      heroId: p.heroId,
      x: p.x,
      y: p.y,
      max: 1,
      ttl: KSIEZYC_S * durationOf(s, 4),
      damageType: sk.type,
      attackRange: 0,
      damageMul: KSIEZYC_DAMAGE * power(s, 4),
      r: KSIEZYC_HIT_R,
      orbit: { angle: Math.atan2(a.dy, a.dx), r: 0, ring: KSIEZYC_ORBIT * areaOf(s, 4), hits: {} },
    });
    syncMoonUpor(s);
  },
]);

export const casts: Readonly<Record<string, SkillFn>> = { orbita, grawitacja, wniosek, plywy, ksiezyc };
