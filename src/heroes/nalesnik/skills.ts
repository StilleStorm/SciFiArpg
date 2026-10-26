/** The casts of the Nalesnik, each a list of primitive calls (heroes/primitives). */
import { t } from '../../i18n';
import { blinkOf, pickTarget, radiusOf, reachOf, resolveDirection, terenCentre } from '../aim';
import { cast, firstCast } from '../cast';
import { rankOf } from '../grants';
import { areaOf, countOf, durationOf, enemiesWithin, patchOf, power, reachMulOf, skillDamage } from '../helpers';
import type { SkillFn } from '../module';
import { FLAG_S, GRAVITY_R, GRAVITY_S, ORBITA_TIME } from './steps';
import { KSIEZYC_DAMAGE, KSIEZYC_HIT_R, KSIEZYC_ORBIT, KSIEZYC_S, PLYWY_DAMAGE, PLYWY_R } from '../numbers';
import { dash, fx, push, summon, teleport, zone } from '../primitives';
import { syncMoonUpor } from '../steps2';
import { takeMass } from './hits';
import {
  IX,
  KRATER_DAMAGE,
  KRATER_S,
  KRAWEDZ_DAMAGE,
  KRAWEDZ_LEN,
  KRAWEDZ_S,
  PIERSCIEN_DAMAGE,
  PIERSCIEN_HALF,
  PIERSCIEN_MID,
  PIERSCIEN_S,
  UPADEK_DAMAGE,
  UPADEK_PUSH,
  UPADEK_R,
  UPADEK_ROUND_S,
  ZAOKR_FLAT_MELEE,
  ZAOKR_RESIST,
  ZAOKR_S,
  ZAOKR_SPEED,
  ZAOKR_UPOR,
  ZMIANA_BEND,
  ZMIANA_DAMAGE,
  ZMIANA_RING_R,
  ZMIANA_S,
} from './numbers';

import { beginRound, roundFor } from './quirk';
import { nalState } from './state';

/** Orbita: a roll along the line (heroes/nalesnik.ts steps it); the first enemy hit that survives becomes a satellite for 3 s. */
const orbita = cast(0, [
  ({ c, s, sk, aim }) => {
    const a = resolveDirection(s, sk, aim);
    dash(c, { dx: a.dx, dy: a.dy, len: reachOf(s, sk), time: ORBITA_TIME, kind: 'roll', rank: rankOf(s, 0), face: true });
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
    nalState(s).tideMul = takeMass(s); // passive 9: the bonus gathered by Grawitacja goes to this tide (nalesnik/quirk.ts dealtMul)
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

// ---------- skills 6 to 10 (docs/SKILLS.md section 5) ----------

/**
 * Krawedz: a short roll of 80 at the target on its edge for 0.8x (nalesnik/quirk.ts steps it); from behind it is a crit.
 * § 2 zlozona: regulaminowy, strikes everyone on the path for 0.6x. § 3 ostra: egzystencjalny, 1.2x, and the target waits for verification.
 */
const krawedz = cast(IX.krawedz, [
  ({ c, s, bus, p, sk, aim }) => {
    const i = IX.krawedz;
    const target = pickTarget(s, sk, aim);
    if (!target) return false;
    if (firstCast(s, i)) bus.emit('footnote', { text: t('heroes.nalesnik.note.krawedz') });
    const d = Math.hypot(target.x - p.x, target.y - p.y) || 1;
    const dx = (target.x - p.x) / d;
    const dy = (target.y - p.y) / d;
    const len = KRAWEDZ_LEN * reachMulOf(s, i);
    nalState(s).edge = {
      dx,
      dy,
      left: KRAWEDZ_S,
      speed: len / KRAWEDZ_S,
      target: target.id,
      all: countOf(s, i) > 0,
      type: sk.type,
      mul: KRAWEDZ_DAMAGE * power(s, i),
      mark: patchOf(s, i)?.status !== undefined,
      hit: [],
    };
    p.target = null;
    if (Math.abs(dx) > 0.2) p.facing = dx > 0 ? 1 : -1;
    fx(c, 'dash', p.x, p.y, 0, p.x + dx * len, p.y + dy * len);
  },
]);

/**
 * Pierscien: a band of debris at 90 to 120 round him for 4 s (it follows him); whoever enters it takes 0.6x and waits for verification
 * 1 s. § 2 wewnetrzny: 50 to 80, 0.9x, 3 s. § 3 planetarny: egzystencjalny, 6 s, the Wygenerowane that cross it exist at 0.5.
 */
const pierscien = cast(IX.pierscien, [
  ({ c, s, bus, p, sk }) => {
    const i = IX.pierscien;
    if (firstCast(s, i)) bus.emit('footnote', { text: t('heroes.nalesnik.note.pierscien') });
    const mid = PIERSCIEN_MID * reachMulOf(s, i);
    const half = PIERSCIEN_HALF * areaOf(s, i);
    const secs = PIERSCIEN_S * durationOf(s, i);
    const z = zone(c, { variant: 'pierscien', x: p.x, y: p.y, r: mid + half, acc: Math.max(4, mid - half), ttl: secs, own: true, max: 1 });
    nalState(s).ring = {
      zone: z.id,
      mid,
      half,
      until: s.time + secs,
      type: sk.type,
      mul: PIERSCIEN_DAMAGE * power(s, i) * takeMass(s),
      existence: sk.type === 'egzystencjalny',
      inside: new Set(),
    };
    fx(c, 'ring', p.x, p.y, mid + half);
  },
]);

/**
 * Zaokraglenie: round on demand for 3 s: +20 upor, 35% of every blow not taken, 20% slower. § 2 w gore: 5 s, 20% not taken, no slowing.
 * § 3 w dol: regulaminowy, flat instead: projectiles skim off entirely, melee costs 20% more.
 */
const zaokraglenie = cast(IX.zaokraglenie, [
  ({ c, s, bus, p }) => {
    const i = IX.zaokraglenie;
    if (firstCast(s, i)) bus.emit('footnote', { text: t('heroes.nalesnik.note.zaokraglenie') });
    const mode = countOf(s, i); // 0 the base, 1 § 2 (no slowing), 2 § 3 (flat)
    const flat = mode >= 2;
    beginRound(s, {
      seconds: ZAOKR_S * durationOf(s, i),
      upor: flat ? 0 : ZAOKR_UPOR,
      resist: flat ? -ZAOKR_FLAT_MELEE : ZAOKR_RESIST * (patchOf(s, i)?.dmg ?? 1),
      speed: mode >= 1 ? 1 : ZAOKR_SPEED,
      flat,
    });
    fx(c, 'ring', p.x, p.y, 34);
  },
]);

/**
 * Upadek na powierzchnie: he hops to the point (within 140) and lands flat: 1.6x in 100, a push of 50, round for 2 s. § 2 kontrolowany:
 * regulaminowy, radius 60, 2.4x, no push. § 3 z wysokosci: egzystencjalny, and a crater stays 3 s striking for 0.3x a second.
 */
const upadek = cast(IX.upadek, [
  ({ c, s, bus, p, sk, aim }) => {
    const i = IX.upadek;
    if (firstCast(s, i)) bus.emit('footnote', { text: t('heroes.nalesnik.note.upadek') });
    const at = terenCentre(s, sk, aim);
    const r = UPADEK_R * areaOf(s, i);
    const mode = countOf(s, i); // 0 the base, 1 § 2 (no push), 2 § 3 (a crater)
    teleport(c, { x: at.x, y: at.y, resolve: true });
    fx(c, 'ring', p.x, p.y, r);
    const mul = UPADEK_DAMAGE * power(s, i) * takeMass(s);
    for (const e of enemiesWithin(s, p.x, p.y, r)) {
      if (skillDamage(s, bus, e, sk.type, mul) || mode === 1 || e.boss) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
      push(c, e, (e.x - p.x) / d, (e.y - p.y) / d, UPADEK_PUSH * s.law.knockbackMul, { mode: 'sweep' });
    }
    roundFor(s, UPADEK_ROUND_S * durationOf(s, i));
    if (mode < 2) return;
    const secs = KRATER_S * durationOf(s, i);
    const z = zone(c, { variant: 'krater', x: p.x, y: p.y, r, ttl: secs, own: true, max: 2 });
    nalState(s).craters.push({ zone: z.id, x: p.x, y: p.y, r, until: s.time + secs, type: sk.type, mul: KRATER_DAMAGE * power(s, i), mark: false, acc: 0 });
  },
]);

/**
 * Zmiana orbity: he rolls to the point (within 200) on a curve, through enemies and not through walls; whoever he crosses waits for
 * verification 2 s. § 2 na wniosek: mechaniczny, 0.7x to the crossed. § 3 o 180 stopni: egzystencjalny, he lands with a ring of 80.
 */
const zmiana = cast(IX.zmiana, [
  ({ c, s, bus, p, sk, aim }) => {
    const i = IX.zmiana;
    if (firstCast(s, i)) bus.emit('footnote', { text: t('heroes.nalesnik.note.zmiana') });
    const { dx, dy, len } = blinkOf(s, sk, aim);
    const to = { x: p.x + dx * len, y: p.y + dy * len };
    const from = { x: p.x, y: p.y };
    const mode = countOf(s, i); // 0 the base, 1 § 2 (strikes the crossed), 2 § 3 (a ring)
    nalState(s).swerve = {
      from,
      ctrl: { x: (from.x + to.x) / 2 - dy * len * ZMIANA_BEND, y: (from.y + to.y) / 2 + dx * len * ZMIANA_BEND },
      to,
      t: 0,
      dur: ZMIANA_S,
      type: sk.type,
      dmg: mode === 1 ? ZMIANA_DAMAGE * power(s, i) : 0,
      ring: mode >= 2,
      ringMul: PLYWY_DAMAGE * power(s, i),
      ringR: ZMIANA_RING_R * areaOf(s, i),
      hit: [],
    };
    p.target = null;
    if (Math.abs(dx) > 0.2) p.facing = dx > 0 ? 1 : -1;
    zone(c, { variant: 'luk', x: from.x, y: from.y, r: len, angle: Math.atan2(dy, dx), ttl: ZMIANA_S + 0.6, own: true, max: 1 });
  },
]);

export const casts: Readonly<Record<string, SkillFn>> = { orbita, grawitacja, wniosek, plywy, ksiezyc, krawedz, pierscien, zaokraglenie, upadek, zmianaOrbity: zmiana };
