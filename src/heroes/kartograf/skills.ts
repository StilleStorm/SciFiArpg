/** The casts of the Kartograf Planet Nieistniejacych, each a list of primitive calls (heroes/primitives). */
import { t } from '../../i18n';
import { blinkOf, LINE_SPEED, LINE_TTL, radiusOf, reachOf, resolveDirection, terenCentre } from '../aim';
import { cast } from '../cast';
import { areaOf, durationOf, power } from '../helpers';
import type { SkillFn } from '../module';
import { LEGENDA_NAMES, LEGENDA_S, MAX_ZONES, SKALA_RANGE, SKALA_S } from '../numbers';
import { aoe, decoy, fx, projectile, statusApply, teleport, zone } from '../primitives';

/** Triangulacja: a line shot through everything; damage grows with every enemy passed. */
const triangulacja = cast(0, [
  ({ c, s, p, sk, aim }) => {
    const a = resolveDirection(s, sk, aim);
    projectile(c, {
      x: p.x + a.dx * 14,
      y: p.y + a.dy * 14,
      r: 7,
      vx: a.dx * LINE_SPEED,
      vy: a.dy * LINE_SPEED,
      ttl: LINE_TTL * areaOf(s, 0),
      damage: power(s, 0),
      damageType: sk.type,
      pierce: 99,
      bonusPerPass: 0.35,
    });
    const length = reachOf(s, sk);
    fx(c, 'line', p.x, p.y, 0, p.x + a.dx * length, p.y + a.dy * length);
  },
]);

/** Teren nieistniejacy: a marked area. Inside, enemies are do_weryfikacji and Wygenerowane exist at 0.3 (heroes/system.ts). */
const teren = cast(1, [
  ({ c, s, sk, aim }) => {
    const { x, y } = terenCentre(s, sk, aim);
    zone(c, { x, y, variant: 'teren', r: 85 * areaOf(s, 1), ttl: 6 * durationOf(s, 1), max: MAX_ZONES });
  },
]);

/** Korekta: a short blink toward the aimed point (a tap: where the hero walks, else ahead); a "blad pomiaru" decoy stays and draws the attention. */
const korekta = cast(2, [
  ({ c, s, p, sk, aim }) => {
    const { dx, dy, len } = blinkOf(s, sk, aim);
    const from = { x: p.x, y: p.y };
    const secs = 5 * durationOf(s, 2);
    const stand = decoy(c, { x: from.x, y: from.y, ttl: secs });
    teleport(c, { x: p.x + dx * len, y: p.y + dy * len, resolve: true });
    aoe(c, { x: from.x, y: from.y, r: 190, each: (e) => statusApply([e], { kind: 'przeczytane', seconds: secs, source: stand.id }) });
  },
]);

/** Skala 1:1: five seconds at full scale: auto range +60% (heroes/steps2.ts keeps it), every survey line pierces (heroes/auto.ts). */
const skala = cast(3, [
  ({ c, s, bus, p }) => {
    const h = s.hero;
    const secs = SKALA_S * durationOf(s, 3);
    if (h.scale) h.scale.until = s.time + secs;
    else {
      const from = p.attackRange;
      h.scale = { until: s.time + secs, from, to: from * SKALA_RANGE };
      p.attackRange = h.scale.to;
    }
    fx(c, 'ring', p.x, p.y, 40);
    bus.emit('margin:note', { text: t('heroes.kartograf.skalaNote'), x: p.x, y: p.y - p.r - 52 });
  },
]);

/** Legenda: the legend box at the point; heroes/steps2.ts names, reads and wears down whoever stands in it. */
const legenda = cast(4, [
  ({ c, s, sk, aim }) => {
    const at = terenCentre(s, sk, aim);
    // the drawn box (124 x 78, buildLegend in render/heroFx.ts) stays on the paper: the centre keeps its half-size and a margin from the wall
    const pg = s.page;
    const x = Math.max(pg.inset + 70, Math.min(pg.w - pg.inset - 70, at.x));
    const y = Math.max(pg.inset + 47, Math.min(pg.h - pg.inset - 47, at.y));
    const order: number[] = [];
    for (let i = 1; i <= LEGENDA_NAMES; i++) order.push(i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = s.rngs.combat.int(0, i);
      const a = order[i] ?? 1;
      order[i] = order[j] ?? 1;
      order[j] = a;
    }
    zone(c, { x, y, variant: 'legenda', r: radiusOf(s, sk), ttl: LEGENDA_S * durationOf(s, 4), inside: [], acc: 0, order });
  },
]);

export const casts: Readonly<Record<string, SkillFn>> = { triangulacja, teren, korekta, skala, legenda };
