/** The casts of the Pralka Emancypowana, each a list of primitive calls (heroes/primitives). */
import { t } from '../../i18n';
import { reachOf, resolveDirection } from '../aim';
import { cast, directionOf, firstCast } from '../cast';
import { areaOf, durationOf, power, skillDamage, touchStatus, widthOf } from '../helpers';
import type { SkillFn } from '../module';
import { BEBEN_DAMAGE, BEBEN_HALF, BEBEN_KNOCKBACK, BEBEN_VERIFY_S, FOAM_RADIUS, READING_R, READING_S, READING_UPOR } from '../numbers';
import { aoe, buff, cone, dash, fx, pull, push, shield } from '../primitives';

/** Wirowanie: a spin around herself, pulling the nearest in. */
const wirowanie = cast(0, [
  ({ c, s, bus, p, sk }) => {
    const radius = 96 * areaOf(s, 0);
    fx(c, 'swirl', p.x, p.y, radius);
    aoe(c, {
      x: p.x,
      y: p.y,
      r: radius,
      each: (e) => {
        pull(c, e, p, 34 * s.law.knockbackMul, p.r + e.r + 2);
        skillDamage(s, bus, e, sk.type, 1.4 * power(s, 0));
      },
    });
  },
]);

/** Pranie wstepne: a foam shield for 5 s. Enemies that touch it are do_weryfikacji (heroes/system.ts). */
const pranieWstepne = cast(1, [
  ({ c, s, p }) => {
    shield(c, (30 + 4 * p.level + s.hero.mods.shield) * (1 + 0.25 * s.hero.ranks[1]), 5 * durationOf(s, 1));
    fx(c, 'foam', p.x, p.y, FOAM_RADIUS);
  },
]);

/** Odwirowanie: a dash that drags one enemy along and drops it zablokowany. */
const odwirowanie = cast(2, [
  (e) => {
    const a = directionOf(e);
    dash(e.c, { dx: a.dx, dy: a.dy, len: reachOf(e.s, e.sk), time: 0.22, kind: 'dash', drag: a.target ? a.target.id : null, rank: e.s.hero.ranks[2] });
  },
]);

/** Otwarcie bebna: a cone of wet laundry (reach 150, half-angle 35 degrees): 1.3x, pushed along the cone, do_weryfikacji. */
const beben = cast(3, [
  ({ c, s, bus, p, sk, aim }) => {
    const a = resolveDirection(s, sk, aim);
    const reach = reachOf(s, sk);
    fx(c, 'drum', p.x, p.y, reach, p.x + a.dx * reach, p.y + a.dy * reach);
    const secs = BEBEN_VERIFY_S * durationOf(s, 3);
    const hit = cone(c, {
      x: p.x,
      y: p.y,
      dx: a.dx,
      dy: a.dy,
      reach,
      half: BEBEN_HALF * widthOf(s, 3),
      each: (e) => {
        fx(c, 'wet', e.x, e.y, e.r);
        if (skillDamage(s, bus, e, sk.type, BEBEN_DAMAGE * power(s, 3))) return;
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

export const casts: Readonly<Record<string, SkillFn>> = { wirowanie, pranieWstepne, odwirowanie, beben, osobowosc };
