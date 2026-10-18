/**
 * The fourth and fifth skills of the heroes (DESIGN 10.1) except Juz to bylo, which repeats other skills and lives in skills.ts.
 * Casts only: what they leave running (the reading, the case number, the tide, the moon, the zones) is stepped by heroes/steps2.ts.
 * Skill indices: 3 is the fourth skill, 4 the fifth.
 */
import { applyStatus } from '../combat/status';
import type { Bus } from '../core/events';
import { createSummon, createZone } from '../entities/factory';
import type { Enemy } from '../entities/types';
import { t } from '../i18n';
import { recomputeStats } from '../items/stats';
import { applyDamage, killEnemy } from '../systems/combat';
import { resolveMove } from '../world/pages';
import { nextId, type RunState } from '../world/run';
import type { HeroDef } from './defs';
import { pickTarget, radiusOf, reachOf, resolveDirection, terenCentre, type Aim } from './aim';
import { areaOf, durationOf, power, skillDamage, touchStatus } from './helpers';
import {
  BEBEN_DAMAGE,
  BEBEN_HALF,
  BEBEN_KNOCKBACK,
  BEBEN_VERIFY_S,
  KSIEZYC_DAMAGE,
  KSIEZYC_HIT_R,
  KSIEZYC_ORBIT,
  KSIEZYC_S,
  LEGENDA_NAMES,
  LEGENDA_S,
  NUMER_S,
  NUMER_STAMP_DAMAGE,
  PLYWY_R,
  READING_R,
  READING_S,
  READING_UPOR,
  ROZLACZENIE_BELOW,
  ROZLACZENIE_BLOCK_S,
  ROZLACZENIE_DAMAGE,
  ROZLACZENIE_HALF,
  ROZLACZENIE_THROW,
  SKALA_RANGE,
  SKALA_S,
  START_DELAY_S,
} from './numbers';
import { syncMoonUpor } from './steps2';

type FxKind = 'drum' | 'wet' | 'section' | 'cut' | 'tide' | 'capsule' | 'ring';
type SkillFn = (s: RunState, bus: Bus, hero: HeroDef, aim: Aim) => void | false;

function fx(bus: Bus, kind: FxKind, x: number, y: number, r: number, x2 = x, y2 = y): void {
  bus.emit('skill:fx', { kind, x, y, x2, y2, r });
}

/** Bit of `HeroRun.noted` for the footnote printed on the first cast of skill `i`. */
function firstCast(s: RunState, i: number): boolean {
  const bit = 1 << i;
  if ((s.hero.noted & bit) !== 0) return false;
  s.hero.noted |= bit;
  return true;
}

// ---------- Pralka Emancypowana ----------

/** Otwarcie bebna: a cone of wet laundry (reach 150, half-angle 35 degrees): 1.3x, pushed along the cone, do_weryfikacji. */
const beben: SkillFn = (s, bus, hero, aim) => {
  const p = s.player;
  const sk = hero.skills[3];
  const a = resolveDirection(s, sk, aim);
  const reach = reachOf(s, sk);
  const base = Math.atan2(a.dy, a.dx);
  fx(bus, 'drum', p.x, p.y, reach, p.x + a.dx * reach, p.y + a.dy * reach);
  const secs = BEBEN_VERIFY_S * durationOf(s, 3);
  let any = false;
  for (const e of [...s.enemies]) {
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    if (Math.hypot(dx, dy) > reach + e.r) continue;
    let diff = Math.atan2(dy, dx) - base;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    if (Math.abs(diff) > BEBEN_HALF) continue;
    any = true;
    fx(bus, 'wet', e.x, e.y, e.r);
    if (skillDamage(s, bus, e, sk.type, BEBEN_DAMAGE * power(s, 3))) continue;
    touchStatus(e, 'do_weryfikacji', secs, p.id);
    if (e.boss) continue;
    const push = BEBEN_KNOCKBACK * s.law.knockbackMul;
    e.x += a.dx * push;
    e.y += a.dy * push;
    resolveMove(s.page, e, e.r);
  }
  return any ? undefined : false;
};

/** Wniosek o osobowosc: six seconds of reading aloud (heroes/steps2.ts ticks it); +20 upor while she reads. */
const osobowosc: SkillFn = (s, bus) => {
  const p = s.player;
  const h = s.hero;
  const secs = READING_S * durationOf(s, 4);
  if (h.reading) {
    h.reading.until = s.time + secs;
    h.reading.acc = 0;
  } else {
    h.reading = { until: s.time + secs, acc: 0, upor: READING_UPOR };
    p.baseStats.stats.upor += READING_UPOR;
    recomputeStats(p);
  }
  fx(bus, 'section', p.x, p.y, READING_R * areaOf(s, 4));
  if (firstCast(s, 4)) bus.emit('footnote', { text: t('heroes.pralka.osobowoscNote', { number: 1000 + (s.seed % 9000) }) });
};

// ---------- Konsultant Infolinii ----------

/** Numer sprawy: a stamp on the target; for 6 s it takes +35% from everything (heroes/steps2.ts hands it over when it dies). */
const numer: SkillFn = (s, bus, hero, aim) => {
  const sk = hero.skills[3];
  const target = pickTarget(s, sk, aim);
  if (!target) return false;
  skillDamage(s, bus, target, sk.type, NUMER_STAMP_DAMAGE * power(s, 3)); // before the number: the stamp itself takes no bonus
  if (!s.enemies.includes(target)) return;
  for (let i = s.zones.length - 1; i >= 0; i--) if (s.zones[i]?.variant === 'numer') s.zones.splice(i, 1);
  const secs = NUMER_S * durationOf(s, 3);
  const number = 1000 + s.rngs.combat.int(0, 8999);
  s.hero.numer = { id: target.id, until: s.time + secs, handovers: 0, number, x: target.x, y: target.y };
  s.zones.push(createZone(nextId(s), target.x, target.y - target.r - 18, { variant: 'numer', r: 14, ttl: secs, follow: target.id, number }));
};

/** Pushes `e` up to `dist` along (dx, dy), stopping where an obstacle or the edge of the page is in the way. */
function throwAlong(s: RunState, e: Enemy, dx: number, dy: number, dist: number): void {
  const step = 10;
  let left = dist;
  while (left > 0.5) {
    const len = Math.min(step, left);
    const next = { x: e.x + dx * len, y: e.y + dy * len };
    const want = { x: next.x, y: next.y };
    resolveMove(s.page, next, e.r);
    if (Math.hypot(next.x - want.x, next.y - want.y) > 0.5) return;
    e.x = next.x;
    e.y = next.y;
    left -= len;
  }
}

/** Rozlaczenie: the first enemy on the line is thrown 180 further and zablokowany 2 s; below 25% racja the call just drops. */
const rozlaczenie: SkillFn = (s, bus, hero, aim) => {
  const p = s.player;
  const sk = hero.skills[4];
  const a = resolveDirection(s, sk, aim);
  const reach = reachOf(s, sk);
  let first: Enemy | null = null;
  let best = Infinity;
  for (const e of s.enemies) {
    const along = (e.x - p.x) * a.dx + (e.y - p.y) * a.dy;
    if (along < 0 || along > reach + e.r) continue;
    if (Math.abs((e.x - p.x) * a.dy - (e.y - p.y) * a.dx) > e.r + ROZLACZENIE_HALF) continue;
    if (along < best) {
      best = along;
      first = e;
    }
  }
  if (!first) return false;
  fx(bus, 'cut', p.x, p.y, 0, first.x, first.y);
  if (!first.boss && first.hp < first.hpMax * ROZLACZENIE_BELOW) {
    // the call simply drops: a normal death with normal drops
    if (!s.law.botTime) {
      applyDamage(s, bus, first, first.hp, false, sk.type);
      if (s.enemies.includes(first)) killEnemy(s, bus, first);
    }
    return;
  }
  if (!first.boss) throwAlong(s, first, a.dx, a.dy, ROZLACZENIE_THROW * areaOf(s, 4));
  if (skillDamage(s, bus, first, sk.type, ROZLACZENIE_DAMAGE * power(s, 4))) return;
  applyStatus(first, 'zablokowany', ROZLACZENIE_BLOCK_S * durationOf(s, 4), p.id);
};

// ---------- Petlowiec: Odlozony start ----------

/** Odlozony start: a countdown circle at the point; 0.8 s later the capsule lands (heroes/steps2.ts landStart). */
const start: SkillFn = (s, _bus, hero, aim) => {
  const sk = hero.skills[4];
  const { x, y } = terenCentre(s, sk, aim);
  s.zones.push(createZone(nextId(s), x, y, { variant: 'start', r: radiusOf(s, sk), ttl: START_DELAY_S }));
};

// ---------- Kartograf ----------

/** Skala 1:1: five seconds at full scale: auto range +60% (heroes/steps2.ts keeps it), every survey line pierces (heroes/auto.ts). */
const skala: SkillFn = (s, bus) => {
  const p = s.player;
  const h = s.hero;
  const secs = SKALA_S * durationOf(s, 3);
  if (h.scale) h.scale.until = s.time + secs;
  else {
    const from = p.attackRange;
    h.scale = { until: s.time + secs, from, to: from * SKALA_RANGE };
    p.attackRange = h.scale.to;
  }
  fx(bus, 'ring', p.x, p.y, 40);
  bus.emit('margin:note', { text: t('heroes.kartograf.skalaNote'), x: p.x, y: p.y - p.r - 52 });
};

/** Legenda: the legend box at the point; heroes/steps2.ts names, reads and wears down whoever stands in it. */
const legenda: SkillFn = (s, _bus, hero, aim) => {
  const sk = hero.skills[4];
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
  s.zones.push(createZone(nextId(s), x, y, { variant: 'legenda', r: radiusOf(s, sk), ttl: LEGENDA_S * durationOf(s, 4), inside: [], acc: 0, order }));
};

// ---------- Nalesnik ----------

/** Plywy: the tide ring runs out from the rim (heroes/steps2.ts stepTide). */
const plywy: SkillFn = (s, bus) => {
  const p = s.player;
  const max = PLYWY_R * areaOf(s, 3);
  s.hero.tide = { age: 0, radius: 0, max, hit: [] };
  fx(bus, 'tide', p.x, p.y, max);
};

/** Ksiezyc: a pebble launched along the direction, settling on its circle; one moon at a time, +10 upor while it lasts. */
const ksiezyc: SkillFn = (s, bus, hero, aim) => {
  const p = s.player;
  const sk = hero.skills[4];
  const a = resolveDirection(s, sk, aim);
  for (let i = s.summons.length - 1; i >= 0; i--) {
    const old = s.summons[i];
    if (old?.variant !== 'moon') continue;
    s.summons.splice(i, 1);
    bus.emit('summon:expired', { id: old.id });
  }
  s.summons.push(
    createSummon(nextId(s), p.x, p.y, {
      variant: 'moon',
      heroId: 'nalesnik',
      ttl: KSIEZYC_S * durationOf(s, 4),
      damageType: sk.type,
      attackRange: 0,
      damageMul: KSIEZYC_DAMAGE * power(s, 4),
      r: KSIEZYC_HIT_R,
      orbit: { angle: Math.atan2(a.dy, a.dx), r: 0, ring: KSIEZYC_ORBIT * areaOf(s, 4), hits: {} },
    }),
  );
  syncMoonUpor(s);
};

/** The nine new skills by id; skills.ts adds Juz to bylo and registers them all. */
export const SKILLS2: Record<string, SkillFn> = {
  beben,
  osobowosc,
  numer,
  rozlaczenie,
  start,
  skala,
  legenda,
  plywy,
  ksiezyc,
};
