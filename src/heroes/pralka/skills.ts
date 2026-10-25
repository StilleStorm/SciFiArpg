/** The casts of the Pralka Emancypowana, each a list of primitive calls (heroes/primitives). */
import { t } from '../../i18n';
import { autoTarget, radiusOf, reachOf, resolveDirection, terenCentre } from '../aim';
import { cast, directionOf, firstCast } from '../cast';
import { paragraphAt, rankOf } from '../grants';
import { areaOf, durationOf, power, skillDamage, touchStatus, widthOf } from '../helpers';
import { padOf } from '../loadout';
import type { SkillFn } from '../module';
import { BEBEN_DAMAGE, BEBEN_HALF, BEBEN_KNOCKBACK, BEBEN_VERIFY_S, FOAM_RADIUS, READING_R, READING_S, READING_UPOR } from '../numbers';
import { aoe, buff, cone, cooldownReset, dash, fx, pull, push, shield } from '../primitives';
import { fire } from '../skills';
import {
  ECO_RESIST,
  ECO_RESIST_NIGHT,
  ECO_S,
  PLUKANIE_DAMAGE,
  PLUKANIE_EVERY,
  PLUKANIE_R,
  PLUKANIE_RANGE,
  PROGRAM_R,
  PROGRAM_S,
  PUDDLE_S,
  ZMIANA_COST,
} from './numbers';
import { addBonus, runOf, startEco, takeBonus } from './running';

/** Wirowanie: a spin around herself, pulling the nearest in. */
const wirowanie = cast(0, [
  ({ c, s, bus, p, sk }) => {
    const radius = 96 * areaOf(s, 0);
    fx(c, 'swirl', p.x, p.y, radius);
    const pulled = aoe(c, {
      x: p.x,
      y: p.y,
      r: radius,
      each: (e) => {
        pull(c, e, p, 34 * s.law.knockbackMul, p.r + e.r + 2);
        skillDamage(s, bus, e, sk.type, 1.4 * power(s, 0));
      },
    });
    addBonus(s, pulled.length); // passive 10, Beben pelny
  },
]);

/** Pranie wstepne: a foam shield for 5 s. Enemies that touch it are do_weryfikacji (heroes/system.ts). */
const pranieWstepne = cast(1, [
  ({ c, s, p }) => {
    shield(c, (30 + 4 * p.level + s.hero.mods.shield) * (1 + 0.25 * rankOf(s, 1)), 5 * durationOf(s, 1));
    fx(c, 'foam', p.x, p.y, FOAM_RADIUS);
  },
]);

/** Odwirowanie: a dash that drags one enemy along and drops it zablokowany. */
const odwirowanie = cast(2, [
  (e) => {
    const a = directionOf(e);
    dash(e.c, { dx: a.dx, dy: a.dy, len: reachOf(e.s, e.sk), time: 0.22, kind: 'dash', drag: a.target ? a.target.id : null, rank: rankOf(e.s, 2) });
  },
]);

/** Otwarcie bebna: a cone of wet laundry (reach 150, half-angle 35 degrees): 1.3x, pushed along the cone, do_weryfikacji. */
const beben = cast(3, [
  ({ c, s, bus, p, sk, aim }) => {
    const a = resolveDirection(s, sk, aim);
    const reach = reachOf(s, sk);
    fx(c, 'drum', p.x, p.y, reach, p.x + a.dx * reach, p.y + a.dy * reach);
    const secs = BEBEN_VERIFY_S * durationOf(s, 3);
    const bonus = takeBonus(s); // passive 10, Beben pelny
    const hit = cone(c, {
      x: p.x,
      y: p.y,
      dx: a.dx,
      dy: a.dy,
      reach,
      half: BEBEN_HALF * widthOf(s, 3),
      each: (e) => {
        fx(c, 'wet', e.x, e.y, e.r);
        if (skillDamage(s, bus, e, sk.type, BEBEN_DAMAGE * power(s, 3) * bonus)) return;
        touchStatus(e, 'do_weryfikacji', secs, p.id);
        if (e.boss) return;
        push(c, e, a.dx, a.dy, BEBEN_KNOCKBACK * s.law.knockbackMul);
      },
    });
    return hit.length > 0 ? undefined : false;
  },
]);

/** Wniosek o osobowosc: six seconds of reading aloud (heroes/steps2.ts ticks it); +20 upor while she reads. */
const osobowosc = cast(4, [
  ({ c, s, bus, p }) => {
    const h = s.hero;
    const secs = READING_S * durationOf(s, 4);
    if (h.reading) {
      h.reading.until = s.time + secs;
      h.reading.acc = 0;
    } else {
      h.reading = { until: s.time + secs, acc: 0, upor: READING_UPOR };
      buff(c, 'upor', READING_UPOR);
    }
    fx(c, 'section', p.x, p.y, READING_R * areaOf(s, 4));
    if (firstCast(s, 4)) bus.emit('footnote', { text: t('heroes.pralka.osobowoscNote', { number: 1000 + (s.seed % 9000) }) });
  },
]);

/** Plukanie (skill 6): a splash at the nearest enemy, else round her; it also rinses one status off her. § 3: every third makes Wirowanie ready. */
const plukanie = cast(5, [
  ({ c, s, bus, p, sk }) => {
    const target = autoTarget(s, sk, PLUKANIE_RANGE);
    const x = target ? target.x : p.x;
    const y = target ? target.y : p.y;
    const r = PLUKANIE_R * areaOf(s, 5);
    const rinsed = p.statuses.length > 0;
    const hit = aoe(c, {
      x,
      y,
      r,
      each: (e) => {
        fx(c, 'wet', e.x, e.y, e.r);
        skillDamage(s, bus, e, sk.type, PLUKANIE_DAMAGE * power(s, 5));
      },
    });
    if (hit.length === 0 && !rinsed) return false;
    fx(c, 'ring', x, y, r);
    if (rinsed) {
      p.statuses.shift();
      fx(c, 'wet', p.x, p.y, p.r);
    }
    if (paragraphAt(s, 5) === 3) {
      const run = runOf(s);
      run.rinses++;
      if (run.rinses % PLUKANIE_EVERY === 0) cooldownReset(c, 0);
    }
  },
]);

/** Program 90 (skill 7): a zone under her for 3 s (heroes/pralka/running.ts strikes it every half second); she is slowed while it runs. */
const program90 = cast(6, [
  ({ c, s, p }) => {
    const r = PROGRAM_R * areaOf(s, 6);
    const para = paragraphAt(s, 6);
    runOf(s).program = {
      x: p.x,
      y: p.y,
      r,
      until: s.time + PROGRAM_S * durationOf(s, 6),
      acc: 0,
      page: s.pageIndex,
      inside: [],
      leave: para === 3,
      slow: para !== 2,
      bonus: takeBonus(s), // passive 10, Beben pelny
    };
    fx(c, 'steam', p.x, p.y, r);
  },
]);

/** Tryb oszczedny (skill 8): less taken for 4 s, slower, and a hit on her counts double for the rule (heroes/pralka/quirk.ts). */
const trybOszczedny = cast(7, [
  ({ c, s, p }) => {
    const para = paragraphAt(s, 7);
    startEco(s, { until: s.time + ECO_S * durationOf(s, 7), resist: para === 2 ? ECO_RESIST_NIGHT : ECO_RESIST, slow: para !== 2, immune: para === 3 });
    fx(c, 'ring', p.x, p.y, p.r + 16);
  },
]);

/** Zmiana programu (skill 9): the last skill she cast is ready again; it costs racja (§ 3: a longer cooldown instead); § 2 fires it again at once. */
const zmianaProgramu = cast(8, [
  ({ c, s, bus, p }) => {
    const last = s.hero.lastCast;
    if (!last || last.skill === 8) return false;
    const para = paragraphAt(s, 8);
    cooldownReset(c, last.skill);
    fx(c, 'section', p.x, p.y, p.r + 26);
    if (para !== 3) p.hp = Math.max(Math.min(1, p.hp), p.hp - ZMIANA_COST); // § 3 pays in cooldown instead; never fatal
    if (para === 2) fire(s, bus, last.skill, padOf(s, last.skill) ?? 0, true, last.aim);
    if (firstCast(s, 8)) bus.emit('footnote', { text: t('heroes.pralka.zmianaNote') });
  },
]);

/** Odpompowanie (skill 10): a puddle at the point for 5 s (heroes/pralka/running.ts): inside they wait for verification, loot slides to the rim. */
const odpompowanie = cast(9, [
  ({ c, s, bus, sk, aim }) => {
    const { x, y } = terenCentre(s, sk, aim);
    const para = paragraphAt(s, 9);
    const r = radiusOf(s, sk);
    runOf(s).puddle = { x, y, r, until: s.time + PUDDLE_S * durationOf(s, 9), page: s.pageIndex, acc: 0, fxAt: s.time + 1.2, strikes: para === 2, pulls: para === 3 };
    fx(c, 'puddle', x, y, r);
    if (firstCast(s, 9)) bus.emit('footnote', { text: t('heroes.pralka.odpompowanieNote') });
  },
]);

export const casts: Readonly<Record<string, SkillFn>> = { wirowanie, pranieWstepne, odwirowanie, beben, osobowosc, plukanie, program90, trybOszczedny, zmianaProgramu, odpompowanie };
