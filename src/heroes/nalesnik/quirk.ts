/**
 * The Nalesnik's quirk, rownowaga hydrostatyczna: rounds up below a third of racja (and skims projectiles at full racja: heroes/shield.ts).
 * It also steps what his skills 6 to 10 leave running (docs/SKILLS.md section 5) through `HeroQuirk.tick`: the short roll of Krawedz, the
 * ring of debris, the round buff, the craters, the curve of Zmiana orbity, and passives 8 to 10. Everything lives in `nalesnik/state.ts`.
 */
import { DAMAGE_TYPES } from '../../combat/damage';
import type { Bus } from '../../core/events';
import { pinExistence } from '../../enemies/hooks';
import type { Enemy } from '../../entities/types';
import { t } from '../../i18n';
import { hasEffect } from '../../items/sets';
import { recomputeStats } from '../../items/stats';
import { resolveMove } from '../../world/pages';
import type { RunState } from '../../world/run';
import { enemiesWithin, power, skillDamage, touchStatus } from '../helpers';
import { effectiveSkill } from '../loadout';
import type { HeroQuirk } from '../module';
import { push } from '../primitives';
import { critHit, taken } from './hits';
import { IX, KRAWEDZ_MARK_S, PIERSCIEN_EXISTENCE, PIERSCIEN_MARK_S, PORY_RETURN, SATELITA_DAMAGE, ZMIANA_MARK_S } from './numbers';
import { nalState, nalStateIfAny, type NalState, type RoundBuff } from './state';
import { PLYWY_PUSH, TICK_S } from '../numbers';

/** Below this share of racja it rounds up (DESIGN 10, item 5). */
export const ROUND_BELOW = 1 / 3;
/** «Awaria», three pieces: rounds up below half (items/sets.ts). */
export const ROUND_BELOW_AWARIA = 1 / 2;
export const ROUND_S = 5;
export const ROUND_COOLDOWN_S = 20;
export const ROUND_UPOR = 20;

// ---------- the round (the quirk below a third, Zaokraglenie, the landing of Upadek) ----------

/** Draw the pancake round for `seconds` (the figure reads `player.round`); the quirk below takes it off again when the time is up. */
export function roundFor(s: RunState, seconds: number): void {
  s.player.round = true;
  s.hero.roundUntil = Math.max(s.hero.roundUntil, s.time + seconds);
}

/** What Zaokraglenie lays on the hero: it is taken back by `endRound`; a second cast first takes the first back. */
export interface RoundSpec {
  seconds: number;
  upor: number;
  resist: number;
  speed: number;
  /** § 3: lies flat instead of round: every projectile skims off (`Player.flat`). */
  flat: boolean;
}

export function beginRound(s: RunState, o: RoundSpec): void {
  endRound(s);
  const p = s.player;
  const k = nalState(s);
  p.baseStats.stats.upor += o.upor;
  for (const type of DAMAGE_TYPES) p.baseStats.stats.resist[type] = (p.baseStats.stats.resist[type] ?? 0) + o.resist;
  p.speed *= o.speed;
  if (o.flat) p.flat = true;
  else roundFor(s, o.seconds);
  k.round = { until: s.time + o.seconds, upor: o.upor, resist: o.resist, speed: o.speed };
  recomputeStats(p);
}

export function endRound(s: RunState): void {
  const k = nalStateIfAny(s);
  const r: RoundBuff | null | undefined = k?.round;
  if (!k || !r) return;
  const p = s.player;
  p.baseStats.stats.upor -= r.upor;
  for (const type of DAMAGE_TYPES) p.baseStats.stats.resist[type] = (p.baseStats.stats.resist[type] ?? 0) - r.resist;
  p.speed /= r.speed;
  delete p.flat;
  k.round = null;
  recomputeStats(p);
}

// ---------- per step ----------

/** Seconds since the last tick (the quirk has no dt of its own): one step on the first, never more than a tenth. */
function stepDt(s: RunState, k: NalState): number {
  const dt = k.last < 0 ? 1 / 60 : Math.min(0.1, Math.max(0, s.time - k.last));
  k.last = s.time;
  return dt;
}

/** The hero rolled along (dx, dy) by `move`, held by the page; true when a wall stopped the move. */
export function rollBy(s: RunState, dx: number, dy: number, move: number): boolean {
  const p = s.player;
  const want = { x: p.x + dx * move, y: p.y + dy * move };
  const pos = { x: want.x, y: want.y };
  resolveMove(s.page, pos, p.r);
  p.x = pos.x;
  p.y = pos.y;
  p.moving = true;
  p.target = null;
  if (Math.abs(dx) > 0.2) p.facing = dx > 0 ? 1 : -1;
  return Math.hypot(pos.x - want.x, pos.y - want.y) > 0.5;
}

/** Krawedz: a short roll at the target; from behind (it faces the way he rolls) the blow is a crit. */
function stepEdge(s: RunState, bus: Bus, k: NalState, dt: number): void {
  const r = k.edge;
  if (!r) return;
  const p = s.player;
  const move = Math.min(r.left, dt) * r.speed;
  const stopped = rollBy(s, r.dx, r.dy, move);
  for (const e of [...s.enemies]) {
    if (r.hit.includes(e.id) || (!r.all && e.id !== r.target)) continue;
    if (Math.hypot(e.x - p.x, e.y - p.y) > p.r + e.r + 6) continue;
    r.hit.push(e.id);
    const behind = Math.abs(r.dx) > 0.3 && e.facing * r.dx > 0;
    if (behind ? critHit(s, bus, e, r.type, r.mul) : skillDamage(s, bus, e, r.type, r.mul)) continue;
    if (r.mark) touchStatus(e, 'do_weryfikacji', KRAWEDZ_MARK_S, p.id);
  }
  r.left -= dt;
  if (r.left <= 0 || stopped) k.edge = null;
}

/** Pierscien: the zone follows him; an enemy that enters the band is struck once per crossing and waits for verification. */
function stepRing(s: RunState, bus: Bus, k: NalState): void {
  const g = k.ring;
  if (!g) return;
  const z = s.zones.find((x) => x.id === g.zone);
  if (!z || s.time >= g.until) {
    k.ring = null;
    return;
  }
  const p = s.player;
  z.x = p.x;
  z.y = p.y;
  const now = new Set<number>();
  for (const e of [...s.enemies]) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (Math.abs(d - g.mid) > g.half + e.r * 0.5) continue;
    now.add(e.id);
    if (g.inside.has(e.id)) continue;
    if (skillDamage(s, bus, e, g.type, g.mul)) continue;
    touchStatus(e, 'do_weryfikacji', PIERSCIEN_MARK_S, p.id);
    if (g.existence) pinExistence(e, PIERSCIEN_EXISTENCE, 3);
  }
  g.inside = now;
}

function stepRound(s: RunState, k: NalState): void {
  if (k.round && s.time >= k.round.until) endRound(s);
}

/** Craters: whoever stands in one is marked while it lasts (Zderzenie) and/or struck every half second (Upadek § 3). */
function stepCraters(s: RunState, bus: Bus, k: NalState, dt: number): void {
  if (k.craters.length === 0) return;
  k.craters = k.craters.filter((c) => s.time < c.until && s.zones.some((z) => z.id === c.zone));
  for (const c of k.craters) {
    const inside = enemiesWithin(s, c.x, c.y, c.r);
    if (c.mark) for (const e of inside) touchStatus(e, 'do_weryfikacji', 0.6, s.player.id);
    if (c.mul <= 0) continue;
    c.acc += dt;
    if (c.acc < TICK_S) continue;
    c.acc -= TICK_S;
    for (const e of inside) skillDamage(s, bus, e, c.type, c.mul * TICK_S);
  }
}

/** Zmiana orbity: rolls along the curve, through enemies (not walls); whoever it crosses is marked; § 3 lands with a ring. */
function stepSwerve(s: RunState, bus: Bus, k: NalState, dt: number): void {
  const w = k.swerve;
  if (!w) return;
  const p = s.player;
  w.t = Math.min(1, w.t + dt / w.dur);
  const a = (1 - w.t) ** 2;
  const b = 2 * (1 - w.t) * w.t;
  const c = w.t * w.t;
  p.x = a * w.from.x + b * w.ctrl.x + c * w.to.x;
  p.y = a * w.from.y + b * w.ctrl.y + c * w.to.y;
  resolveMove(s.page, p, p.r);
  p.moving = true;
  p.target = null;
  for (const e of [...s.enemies]) {
    if (w.hit.includes(e.id) || Math.hypot(e.x - p.x, e.y - p.y) > p.r + e.r + 6) continue;
    w.hit.push(e.id);
    if (w.dmg > 0 && skillDamage(s, bus, e, w.type, w.dmg)) continue;
    touchStatus(e, 'do_weryfikacji', ZMIANA_MARK_S, p.id);
  }
  if (w.t < 1) return;
  k.swerve = null;
  if (!w.ring) return;
  bus.emit('skill:fx', { kind: 'ring', x: p.x, y: p.y, x2: p.x, y2: p.y, r: w.ringR });
  for (const e of enemiesWithin(s, p.x, p.y, w.ringR)) {
    if (skillDamage(s, bus, e, w.type, w.ringMul) || e.boss) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
    push({ s, bus }, e, (e.x - p.x) / d, (e.y - p.y) / d, PLYWY_PUSH * s.law.knockbackMul, { mode: 'sweep' });
  }
}

/** Passive 10, Satelita staly: the satellite of Orbita takes 0.2x a second for as long as it is held (steps.ts stepOrbit keeps it). */
function stepSatellite(s: RunState, bus: Bus, k: NalState): void {
  const o = s.hero.orbit;
  if (!o || !taken(s, 'passive10') || s.time < k.satelliteAt) return;
  k.satelliteAt = s.time + 1;
  const e = s.enemies.find((x) => x.id === o.id);
  if (e) skillDamage(s, bus, e, effectiveSkill(s, IX.orbita).type, SATELITA_DAMAGE * power(s, IX.orbita));
}

/** The roll does the ordinary things: Pory (passive 8) answers a skimmed shot with 0.3x mechaniczny at whoever fired it. */
function skimmed(s: RunState, bus: Bus, from: number): void {
  if (!taken(s, 'passive8')) return;
  const e: Enemy | undefined = s.enemies.find((x) => x.id === from);
  if (e) skillDamage(s, bus, e, 'mechaniczny', PORY_RETURN);
}

export const quirk: HeroQuirk = {
  tick(s, bus) {
    const p = s.player;
    const h = s.hero;
    const k = nalState(s);
    const dt = stepDt(s, k);
    stepEdge(s, bus, k, dt);
    stepSwerve(s, bus, k, dt);
    stepRing(s, bus, k);
    stepCraters(s, bus, k, dt);
    stepRound(s, k);
    stepSatellite(s, bus, k);
    if (p.round) {
      if (s.time < h.roundUntil) return;
      p.round = false;
      p.baseStats.stats.upor -= h.roundUpor;
      h.roundUpor = 0;
      recomputeStats(p);
      return;
    }
    if (p.hp <= 0 || p.hp >= p.hpMax * (hasEffect(p, 'regula-podwojona') ? ROUND_BELOW_AWARIA : ROUND_BELOW) || s.time < h.roundReadyAt) return;
    p.round = true;
    h.roundUntil = s.time + ROUND_S;
    h.roundReadyAt = s.time + ROUND_COOLDOWN_S;
    h.roundUpor = ROUND_UPOR;
    p.baseStats.stats.upor += ROUND_UPOR;
    recomputeStats(p);
    bus.emit('footnote', { text: t('heroes.nalesnik.quirkNote') });
  },
  /** Passive 9: the tide of Plywy strikes with the bonus taken at its cast while it runs. */
  dealtMul(s) {
    const k = nalStateIfAny(s);
    return k && s.hero.tide && k.tideMul !== 1 ? k.tideMul : 1;
  },
  onSkim: skimmed,
};
