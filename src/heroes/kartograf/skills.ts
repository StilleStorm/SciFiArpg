/** The casts of the Kartograf Planet Nieistniejacych, each a list of primitive calls (heroes/primitives). */
import { applyStatus, hasStatus } from '../../combat/status';
import type { RunState } from '../../world/run';
import type { Aim } from '../aim';
import type { SkillDef } from '../defs';
import { t } from '../../i18n';
import { blinkOf, fitAim, LINE_SPEED, LINE_TTL, pickTarget, radiusOf, reachOf, resolveDirection, terenCentre } from '../aim';
import { SIGHT_DX, SIGHT_DY } from '../auto';
import { cast, firstCast } from '../cast';
import { areaOf, countOf, durationOf, enemiesWithin, patchOf, power, reachMulOf, skillDamage, touchStatus, widthOf } from '../helpers';
import type { SkillFn } from '../module';
import { LEGENDA_NAMES, LEGENDA_S, MAX_ZONES, SKALA_RANGE, SKALA_S } from '../numbers';
import { aoe, decoy, fx, line, projectile, pull, push, statusApply, summon, teleport, zone } from '../primitives';
import { lineHit, taken } from './hits';
import {
  BLAD_EXTRA_S,
  GRANICA_DAMAGE,
  GRANICA_FRONT,
  GRANICA_LEN,
  GRANICA_PUSH,
  GRANICA_S,
  GRANICA_STATUS_S,
  IX,
  ODNIESIENIA_BLINK_DEG,
  ODNIESIENIA_PULL_EVERY_S,
  ODNIESIENIA_S,
  POMIAR_DAMAGE,
  POMIAR_MARK_AT,
  POMIAR_MARK_S,
  POMIAR_SECOND_R,
  PRZEKROJ_DAMAGE,
  PRZEKROJ_FAN_DEG,
  PRZEKROJ_HALF,
  PRZEKROJ_LINES,
  PRZEKROJ_SHOW_S,
  ROZA_DAMAGE,
  ROZA_PUSH,
  ROZA_R,
  ROZA_SHOW_S,
  ROZA_STATUS_S,
} from './numbers';
import { kartState } from './state';

const LINE_TURN = (15 * Math.PI) / 180;

/** Triangulacja: a line shot through everything; damage grows with every enemy passed. */
const triangulacja = cast(0, [
  ({ c, s, p, sk, aim }) => {
    const a = resolveDirection(s, sk, aim);
    const length = reachOf(s, sk);
    // the line, then (paragraph) `count` more at 15 degrees either side, alternating, each one wider than the last
    for (let k = 0; k <= countOf(s, 0); k++) {
      const turn = k === 0 ? 0 : (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2) * LINE_TURN;
      const dx = a.dx * Math.cos(turn) - a.dy * Math.sin(turn);
      const dy = a.dx * Math.sin(turn) + a.dy * Math.cos(turn);
      projectile(c, {
        x: p.x + dx * 14,
        y: p.y + dy * 14,
        r: 7,
        vx: dx * LINE_SPEED,
        vy: dy * LINE_SPEED,
        ttl: LINE_TTL * areaOf(s, 0) * reachMulOf(s, 0),
        damage: power(s, 0),
        damageType: sk.type,
        pierce: 99,
        bonusPerPass: 0.35,
      });
      fx(c, 'line', p.x, p.y, 0, p.x + dx * length, p.y + dy * length);
    }
  },
]);

/** Teren nieistniejacy: a marked area. Inside, enemies are do_weryfikacji and Wygenerowane exist at 0.3 (heroes/system.ts). */
const teren = cast(1, [
  ({ c, s, sk, aim }) => {
    const { x, y } = terenCentre(s, sk, aim);
    zone(c, { x, y, variant: 'teren', r: 85 * areaOf(s, 1), ttl: 6 * durationOf(s, 1), max: MAX_ZONES });
  },
]);

/** The benchmark the aim points toward (a drag within 25 degrees of its bearing), if one stands: Korekta blinks to it, whatever the distance. */
function benchmarkOf(s: RunState, sk: SkillDef, aim: Aim): { x: number; y: number } | null {
  const a = fitAim(sk, aim);
  if (a.kind !== 'wskazanie') return null;
  const p = s.player;
  const want = Math.atan2(a.y - p.y, a.x - p.x);
  if (Math.hypot(a.x - p.x, a.y - p.y) < 20) return null;
  let best: { x: number; y: number } | null = null;
  let bd = (ODNIESIENIA_BLINK_DEG * Math.PI) / 180;
  for (const m of s.summons) {
    if (m.variant !== 'benchmark') continue;
    let diff = Math.atan2(m.y - p.y, m.x - p.x) - want;
    diff = Math.abs(Math.atan2(Math.sin(diff), Math.cos(diff)));
    if (diff <= bd) {
      bd = diff;
      best = { x: m.x, y: m.y };
    }
  }
  return best;
}

/** Korekta: a short blink toward the aimed point (a tap: where the hero walks, else ahead); a "blad pomiaru" decoy stays and draws the attention. */
const korekta = cast(2, [
  ({ c, s, p, sk, aim }) => {
    const to = benchmarkOf(s, sk, aim);
    const { dx, dy, len } = blinkOf(s, sk, aim);
    const from = { x: p.x, y: p.y };
    const secs = 5 * durationOf(s, 2) + (taken(s, 'passive9') ? BLAD_EXTRA_S : 0); // Blad pomiaru (passive 9): the decoy lasts longer
    const stand = decoy(c, { x: from.x, y: from.y, ttl: secs });
    // Punkt odniesienia: a drag toward a benchmark blinks to it from anywhere on the page
    teleport(c, to ? { x: to.x, y: to.y, resolve: true } : { x: p.x + dx * len, y: p.y + dy * len, resolve: true });
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

// ---------- skills 6 to 10 (docs/SKILLS.md section 4) ----------

/**
 * Pomiar: a measured hitscan for 0.9x on the target; the third measurement running on the same enemy stamps it zgloszony for 3 s.
 * § 2 przyblizony: mechaniczny, the two nearest, no mark. § 3 kontrolowany: egzystencjalny, 1.4x on an enemy that is zgloszony already.
 */
const pomiar = cast(IX.pomiar, [
  ({ c, s, bus, p, sk }) => {
    const i = IX.pomiar;
    const first = pickTarget(s, sk, { kind: 'auto' });
    if (!first) return false;
    if (firstCast(s, i)) bus.emit('footnote', { text: t('heroes.kartograf.note.pomiar') });
    const targets = [first];
    if (countOf(s, i) > 0) {
      let second = null as (typeof s.enemies)[number] | null;
      let best = POMIAR_SECOND_R + 1e-6;
      for (const e of s.enemies) {
        if (e === first) continue;
        const d = Math.hypot(e.x - first.x, e.y - first.y);
        if (d < best) {
          best = d;
          second = e;
        }
      }
      if (second) targets.push(second);
    }
    const bonus = patchOf(s, i)?.dmg ?? 1; // above 1: a bonus that only a marked enemy takes (§ 3)
    const k = kartState(s);
    const side = first.x < p.x ? -1 : 1;
    for (const e of targets) {
      fx(c, 'line', p.x + side * SIGHT_DX, p.y - SIGHT_DY, 0, e.x, e.y);
      const marked = hasStatus(e, 'zgloszony');
      const mult = POMIAR_DAMAGE * (bonus > 1 && !marked ? power(s, i) / bonus : power(s, i));
      if (lineHit(s, bus, e, sk.type, mult)) continue;
      if (targets.length > 1) continue; // § 2: no mark
      k.measured = k.measured && k.measured.id === e.id ? { id: e.id, n: k.measured.n + 1 } : { id: e.id, n: 1 };
      if (k.measured.n >= POMIAR_MARK_AT) {
        k.measured = null;
        applyStatus(e, 'zgloszony', POMIAR_MARK_S * durationOf(s, i), p.id);
      }
    }
  },
]);

/**
 * Przekroj: five survey lines fanned over 40 degrees, reach 220, 0.5x on everything on each. § 2 poprzeczny: one thick line, 2.0x,
 * reach 160. § 3 warstwowy: egzystencjalny, the lines stay 1.5 s and whoever stands on one is do_weryfikacji.
 */
const przekroj = cast(IX.przekroj, [
  ({ c, s, bus, p, sk, aim }) => {
    const i = IX.przekroj;
    const a = resolveDirection(s, sk, aim);
    const reach = reachOf(s, sk);
    const thick = widthOf(s, i) >= 2;
    const n = thick ? 1 : PRZEKROJ_LINES;
    const half = PRZEKROJ_HALF * widthOf(s, i);
    const fan = (PRZEKROJ_FAN_DEG * Math.PI) / 180;
    const lines: { dx: number; dy: number; on: ReturnType<typeof line> }[] = [];
    for (let k = 0; k < n; k++) {
      const turn = n === 1 ? 0 : (k / (n - 1) - 0.5) * fan;
      const dx = a.dx * Math.cos(turn) - a.dy * Math.sin(turn);
      const dy = a.dx * Math.sin(turn) + a.dy * Math.cos(turn);
      lines.push({ dx, dy, on: line(c, { x: p.x, y: p.y, dx, dy, reach, half }) });
    }
    if (lines.every((l) => l.on.length === 0)) return false;
    if (firstCast(s, i)) bus.emit('footnote', { text: t('heroes.kartograf.note.przekroj') });
    const stay = patchOf(s, i)?.status?.seconds ?? PRZEKROJ_SHOW_S;
    const st = kartState(s);
    const mult = PRZEKROJ_DAMAGE * power(s, i);
    for (const l of lines) {
      const z = zone(c, { variant: 'przekroj', x: p.x, y: p.y, r: reach, ttl: stay, angle: Math.atan2(l.dy, l.dx), own: true, max: 12 });
      if (stay > PRZEKROJ_SHOW_S) st.lines.push({ x: p.x, y: p.y, dx: l.dx, dy: l.dy, reach, half, until: s.time + stay, zone: z.id });
      for (const { e } of l.on) if (s.enemies.includes(e)) lineHit(s, bus, e, sk.type, mult);
    }
  },
]);

/**
 * Granica: a ruled border of 160 across the aim, put 70 ahead of him, for 4 s; whoever crosses it is pushed back 60 and is
 * do_weryfikacji for 1 s (heroes/kartograf/quirk.ts watches it). § 2 sporna: egzystencjalny, no push, a crosser takes 0.8x.
 * § 3 panstwowa: regulaminowy, 6 s, a crosser is zablokowany 1 s.
 */
const granica = cast(IX.granica, [
  ({ c, s, bus, p, sk, aim }) => {
    const i = IX.granica;
    if (firstCast(s, i)) bus.emit('footnote', { text: t('heroes.kartograf.note.granica') });
    const a = resolveDirection(s, sk, aim);
    const pg = s.page;
    const cx = Math.max(pg.inset, Math.min(pg.w - pg.inset, p.x + a.dx * GRANICA_FRONT));
    const cy = Math.max(pg.inset, Math.min(pg.h - pg.inset, p.y + a.dy * GRANICA_FRONT));
    const half = (GRANICA_LEN * areaOf(s, i)) / 2;
    const secs = GRANICA_S * durationOf(s, i);
    const damaging = countOf(s, i) > 0;
    const z = zone(c, { variant: 'granica', x: cx, y: cy, r: half, ttl: secs, angle: Math.atan2(a.dx, -a.dy), own: true, max: 2 });
    const sides = new Map<number, number>();
    const border = {
      zone: z.id,
      x: cx,
      y: cy,
      ux: -a.dy,
      uy: a.dx,
      nx: a.dx,
      ny: a.dy,
      half,
      until: s.time + secs,
      push: damaging ? 0 : GRANICA_PUSH,
      dmg: damaging ? GRANICA_DAMAGE * power(s, i) : 0,
      type: sk.type,
      status: patchOf(s, i)?.status ?? { kind: 'do_weryfikacji' as const, seconds: GRANICA_STATUS_S },
      sides,
    };
    for (const e of s.enemies) sides.set(e.id, Math.sign((e.x - cx) * border.nx + (e.y - cy) * border.ny) || 1);
    const st = kartState(s);
    st.borders = st.borders.filter((b) => s.zones.some((x) => x.id === b.zone)); // the zone of the oldest went with `max`
    st.borders.push(border);
  },
]);

/**
 * Punkt odniesienia: a benchmark at the point for 20 s. Korekta blinks to it from anywhere (a drag toward it); his autos pierce
 * from within 60 of it (heroes/auto.ts). § 2 niwelacyjny: two benchmarks (the second where he stands), 12 s. § 3 sporny:
 * egzystencjalny; every 4 s whoever is within 90 reads it (przeczytane) for a second.
 */
const odniesienia = cast(IX.odniesienia, [
  ({ c, s, bus, p, sk, aim }) => {
    const i = IX.odniesienia;
    if (firstCast(s, i)) bus.emit('footnote', { text: t('heroes.kartograf.note.odniesienia') });
    const at = terenCentre(s, sk, aim);
    const n = 1 + countOf(s, i);
    const secs = ODNIESIENIA_S * durationOf(s, i);
    const pull = patchOf(s, i)?.status !== undefined;
    const k = kartState(s);
    const spots = [at, ...(n > 1 ? [{ x: p.x, y: p.y }] : [])];
    for (const spot of spots) {
      const m = summon(c, { variant: 'benchmark', heroId: p.heroId, x: spot.x, y: spot.y, ttl: secs, damageMul: 0, speed: 0, attackRange: 0, settle: true, max: n });
      k.benches.set(m.id, { pull, next: s.time + ODNIESIENIA_PULL_EVERY_S });
      fx(c, 'ring', m.x, m.y, 20);
    }
  },
]);

/**
 * Roza wiatrow: whoever is within 140 is pushed 90 along the nearest cardinal direction of its bearing and is do_weryfikacji for
 * 1 s (a compass rose is drawn under him). § 2 czterech: mechaniczny, 0.9x to the pushed. § 3 odwrotna: regulaminowy, pulls toward
 * him instead and lays no status.
 */
const roza = cast(IX.roza, [
  ({ c, s, bus, p, sk }) => {
    const i = IX.roza;
    const r = ROZA_R * areaOf(s, i);
    const near = enemiesWithin(s, p.x, p.y, r);
    if (near.length === 0) return false;
    if (firstCast(s, i)) bus.emit('footnote', { text: t('heroes.kartograf.note.roza') });
    const reverse = sk.type === 'regulaminowy';
    const strike = countOf(s, i) > 0;
    zone(c, { variant: 'roza', x: p.x, y: p.y, r, ttl: ROZA_SHOW_S, own: true, max: 1 });
    fx(c, 'ring', p.x, p.y, r);
    for (const e of near) {
      if (strike && skillDamage(s, bus, e, sk.type, ROZA_DAMAGE * power(s, i))) continue;
      if (!reverse) touchStatus(e, 'do_weryfikacji', ROZA_STATUS_S * durationOf(s, i), p.id);
      if (e.boss) continue;
      if (reverse) {
        pull(c, e, p, ROZA_PUSH * reachMulOf(s, i), e.r + p.r + 4);
        continue;
      }
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const horizontal = Math.abs(dx) >= Math.abs(dy);
      push(c, e, horizontal ? (dx < 0 ? -1 : 1) : 0, horizontal ? 0 : dy < 0 ? -1 : 1, ROZA_PUSH * reachMulOf(s, i), { mode: 'sweep' });
    }
  },
]);

export const casts: Readonly<Record<string, SkillFn>> = { triangulacja, teren, korekta, skala, legenda, pomiar, przekroj, granica, punktOdniesienia: odniesienia, rozaWiatrow: roza };
