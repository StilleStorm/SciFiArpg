/**
 * What the fourth and fifth skills leave running (DESIGN 10.1): Pralka's reading, Konsultant's case number, Kartograf's full
 * scale and legend box, Petlowiec's landing capsule, Nalesnik's tide and moon. heroes/system.ts calls these in its fixed order.
 * Damage "per second" is gathered and dealt every TICK_S, not every step.
 */
import { applyStatus, getStatus } from '../combat/status';
import type { Bus } from '../core/events';
import type { Enemy, Summon, Zone } from '../entities/types';
import { t } from '../i18n';
import { recomputeStats } from '../items/stats';
import { knockback } from '../systems/combat';
import { resolveMove } from '../world/pages';
import type { RunState } from '../world/run';
import { trackedRun } from './aim';
import { effectiveSkill } from './loadout';
import { areaOf, enemiesWithin, nearestEnemy, power, setExistence, skillDamage } from './helpers';
import {
  KSIEZYC_GAP_S,
  KSIEZYC_LAUNCH,
  KSIEZYC_ORBIT,
  KSIEZYC_RATE,
  KSIEZYC_UPOR,
  LEGENDA_DAMAGE,
  LEGENDA_NAMES,
  NUMER_BONUS,
  NUMER_HANDOVERS,
  NUMER_HANDOVER_R,
  PLYWY_DAMAGE,
  PLYWY_PUSH,
  PLYWY_S,
  READING_DAMAGE,
  READING_EXISTENCE,
  READING_R,
  START_DAMAGE,
  START_KNOCKBACK,
  START_READ_S,
  TICK_S,
} from './numbers';

/** przeczytane, bez odpowiedzi toward the player: replaces another source's status, only extends the player's own. */
export function readToward(e: Enemy, seconds: number, sourceId: number): void {
  const st = getStatus(e, 'przeczytane');
  if (!st || st.source !== sourceId) applyStatus(e, 'przeczytane', seconds, sourceId);
  else if (st.remaining < seconds) st.remaining = seconds;
}

// ---------- Pralka: Wniosek o osobowosc ----------

export function stepReading(s: RunState, bus: Bus, dt: number): void {
  const rd = s.hero.reading;
  if (!rd) return;
  const p = s.player;
  if (s.time >= rd.until) {
    p.baseStats.stats.upor -= rd.upor;
    s.hero.reading = null;
    recomputeStats(p);
    return;
  }
  const r = READING_R * areaOf(s, 4);
  for (const e of enemiesWithin(s, p.x, p.y, r)) setExistence(e, READING_EXISTENCE);
  rd.acc += dt;
  if (rd.acc < TICK_S) return;
  rd.acc -= TICK_S;
  const type = effectiveSkill(s, 4).type;
  for (const e of enemiesWithin(s, p.x, p.y, r)) skillDamage(s, bus, e, type, READING_DAMAGE * TICK_S * power(s, 4));
  if (Math.floor(s.time) !== Math.floor(s.time - TICK_S)) bus.emit('skill:fx', { kind: 'section', x: p.x, y: p.y, x2: p.x, y2: p.y, r });
}

// ---------- Konsultant: Numer sprawy ----------

/**
 * The case number: while the stamped enemy lives it only follows it. When it dies with time left the number goes to the nearest
 * enemy within NUMER_HANDOVER_R of where it fell, at most NUMER_HANDOVERS times, with the time that remains.
 */
export function stepNumer(s: RunState): void {
  const n = s.hero.numer;
  if (!n) return;
  const drop = (): void => {
    s.hero.numer = null;
    for (let i = s.zones.length - 1; i >= 0; i--) if (s.zones[i]?.variant === 'numer') s.zones.splice(i, 1);
  };
  if (s.time >= n.until) return drop();
  const e = s.enemies.find((x) => x.id === n.id);
  if (e) {
    n.x = e.x;
    n.y = e.y;
    return;
  }
  if (n.handovers >= NUMER_HANDOVERS) return drop();
  const next = nearestEnemy(s, n.x, n.y, NUMER_HANDOVER_R);
  if (!next) return drop();
  n.id = next.id;
  n.handovers++;
  n.x = next.x;
  n.y = next.y;
  const z = s.zones.find((x) => x.variant === 'numer');
  if (z) {
    z.follow = next.id;
    z.ttl = n.until - s.time;
  }
}

const bound = new WeakSet<object>();

/** A numbered enemy takes +35% of every hit on top: the bonus is taken off its racja inside the `enemy:hit` event (a kill is then the usual one). */
export function bindNumerBonus(bus: object & Pick<Bus, 'on'>): void {
  if (bound.has(bus)) return;
  bound.add(bus);
  bus.on('enemy:hit', (ev) => {
    const s = trackedRun();
    const n = s?.hero.numer;
    if (!s || !n || n.id !== ev.id || s.time >= n.until) return;
    const e = s.enemies.find((x) => x.id === ev.id);
    if (e) e.hp -= ev.amount * NUMER_BONUS;
  });
}

// ---------- Petlowiec: Odlozony start ----------

/** The capsule lands: 2.0x in the circle, a push of 60, and the hit are przeczytane toward the Petlowiec for 2 s. */
export function landStart(s: RunState, bus: Bus, z: Zone): void {
  const p = s.player;
  const type = effectiveSkill(s, 4).type;
  bus.emit('skill:fx', { kind: 'capsule', x: z.x, y: z.y, x2: z.x, y2: z.y, r: z.r });
  for (const e of enemiesWithin(s, z.x, z.y, z.r)) {
    if (skillDamage(s, bus, e, type, START_DAMAGE * power(s, 4))) continue;
    if (!e.boss) knockback(s, e, z.x, z.y, START_KNOCKBACK);
    readToward(e, START_READ_S, p.id);
  }
}

// ---------- Kartograf ----------

/** Skala 1:1: the auto range stays 60% longer while it lasts (a recompute of the stats, an item swapped, is noticed and redone). */
export function stepScale(s: RunState): void {
  const sc = s.hero.scale;
  if (!sc) return;
  const p = s.player;
  if (s.time >= sc.until) {
    if (p.attackRange === sc.to) p.attackRange = sc.from;
    s.hero.scale = null;
    return;
  }
  if (p.attackRange !== sc.to) {
    sc.from = p.attackRange;
    sc.to = sc.from * 1.6;
    p.attackRange = sc.to;
  }
}

/** True while the full scale lasts: every survey line pierces and marks (heroes/auto.ts). */
export const scaleActive = (s: RunState): boolean => s.hero.scale !== null && s.time < s.hero.scale.until;

/** Legenda: a name for each enemy that enters (once per cast), przeczytane toward the player, 0.35x egzystencjalny per second. */
export function stepLegend(s: RunState, bus: Bus, z: Zone, dt: number): void {
  const p = s.player;
  const inside = z.inside ?? (z.inside = []);
  const here = enemiesWithin(s, z.x, z.y, z.r);
  for (const e of here) {
    readToward(e, 0.6, p.id);
    if (inside.includes(e.id)) continue;
    inside.push(e.id);
    const name = inside.length <= LEGENDA_NAMES ? z.order?.[inside.length - 1] : undefined;
    if (name !== undefined) bus.emit('margin:note', { text: t(`heroes.kartograf.legendaNames.${name}`), x: e.x, y: e.y - e.r - 26 });
  }
  z.acc = (z.acc ?? 0) + dt;
  if (z.acc < TICK_S) return;
  z.acc -= TICK_S;
  const type = effectiveSkill(s, 4).type;
  for (const e of here) skillDamage(s, bus, e, type, LEGENDA_DAMAGE * TICK_S * power(s, 4));
}

// ---------- Nalesnik ----------

/** Plywy: the ring runs out to its full size over PLYWY_S; each enemy it reaches is struck and pushed out once, loot is drawn in. */
export function stepTide(s: RunState, bus: Bus, dt: number): void {
  const tide = s.hero.tide;
  if (!tide) return;
  const p = s.player;
  const type = effectiveSkill(s, 3).type;
  const before = tide.age;
  tide.age += dt;
  tide.radius = tide.max * Math.min(1, tide.age / PLYWY_S);
  for (const e of [...s.enemies]) {
    if (tide.hit.includes(e.id)) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d > tide.radius + e.r) continue;
    tide.hit.push(e.id);
    if (skillDamage(s, bus, e, type, PLYWY_DAMAGE * power(s, 3)) || e.boss) continue;
    const push = PLYWY_PUSH * s.law.knockbackMul;
    const dx = d < 0.001 ? 1 : (e.x - p.x) / d;
    const dy = d < 0.001 ? 0 : (e.y - p.y) / d;
    e.x += dx * push;
    e.y += dy * push;
    resolveMove(s.page, e, e.r);
  }
  const share = Math.min(1, dt / Math.max(dt, PLYWY_S - before));
  for (const k of s.pickups) {
    const d = Math.hypot(k.x - p.x, k.y - p.y);
    const stop = p.r + k.r + 2;
    if (d > tide.radius + k.r || d <= stop) continue;
    const move = (d - stop) * share;
    k.x -= ((k.x - p.x) / d) * move;
    k.y -= ((k.y - p.y) / d) * move;
  }
  if (tide.age >= PLYWY_S) s.hero.tide = null;
}

/** The moon's upor: +10 while a moon exists, taken back when none does (cast, expiry and page changes all pass through here). */
export function syncMoonUpor(s: RunState): void {
  const want = s.summons.some((m) => m.variant === 'moon') ? KSIEZYC_UPOR : 0;
  const h = s.hero;
  if (h.moonUpor === want) return;
  s.player.baseStats.stats.upor += want - h.moonUpor;
  h.moonUpor = want;
  recomputeStats(s.player);
}

/** The moon leaves the hand along its direction, eases onto its circle, then goes round at 1.4 rad/s striking what it overlaps. */
export function stepMoon(s: RunState, bus: Bus, m: Summon, dt: number): void {
  const o = m.orbit;
  if (!o) return;
  const p = s.player;
  const circle = KSIEZYC_ORBIT * areaOf(s, 4);
  o.ring = circle;
  o.angle += KSIEZYC_RATE * dt;
  o.r = Math.min(circle, o.r + KSIEZYC_LAUNCH * dt);
  m.x = p.x + Math.cos(o.angle) * o.r;
  m.y = p.y + Math.sin(o.angle) * o.r;
  if (s.law.botTime) return;
  const hits = o.hits ?? (o.hits = {});
  for (const e of enemiesWithin(s, m.x, m.y, m.r)) {
    const last = hits[e.id];
    if (last !== undefined && s.time - last < KSIEZYC_GAP_S) continue;
    hits[e.id] = s.time;
    skillDamage(s, bus, e, m.damageType, m.damageMul);
  }
}
