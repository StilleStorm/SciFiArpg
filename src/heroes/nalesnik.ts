/**
 * Nalesnik (DESIGN 10, item 5): the roll of Orbita and the satellite it catches, the pull of Grawitacja, the zone of
 * Wniosek o status. Per-step functions on the run state; heroes/system.ts calls them in its fixed order, heroes/skills.ts
 * starts them. The numbers are here so that the skills, the aim preview and the tests read the same ones.
 */
import { applyStatus } from '../combat/status';
import type { Bus } from '../core/events';
import type { Enemy, Zone } from '../entities/types';
import { rtOf } from '../enemies/runtime';
import { resolveMove } from '../world/pages';
import type { RunState } from '../world/run';
import { heroDef } from './defs';
import { durationOf, enemiesWithin, power, skillDamage, touchStatus } from './helpers';

/** Orbita: seconds the roll lasts (the length is ORBITA_LENGTH in aim.ts), and the satellite's circle. */
export const ORBITA_TIME = 0.5;
export const SATELLITE_S = 3;
export const SATELLITE_R = 70;
/** The satellite goes round once in this many seconds, after easing onto its circle in SATELLITE_EASE_S. */
export const SATELLITE_TURN_S = 1.5;
export const SATELLITE_EASE_S = 0.3;
export const ORBITA_DAMAGE = 1.3;

/** Grawitacja: reach, seconds, pull in units per second, rim damage factor. */
export const GRAVITY_R = 180;
export const GRAVITY_S = 2;
export const GRAVITY_SPEED = 120;
export const GRAVITY_DAMAGE = 1.5;
/** An enemy at this distance beyond the two radii has reached the rim. */
export const RIM_GAP = 4;

/** Wniosek o status: seconds the flag stands, how long an entering enemy is zablokowany, racja per second inside. */
export const FLAG_S = 8;
export const FLAG_BLOCK_S = 1;
export const FLAG_REGEN = 4;
export const FLAG_DAMAGE = 1;

// ---------- Orbita ----------

/** Make `e` the satellite of the player for `seconds` (przeczytane with the player as the source). */
export function catchSatellite(s: RunState, bus: Bus, e: Enemy): void {
  const p = s.player;
  const seconds = SATELLITE_S * durationOf(s, 0);
  s.hero.orbit = { id: e.id, angle: Math.atan2(e.y - p.y, e.x - p.x), r0: Math.hypot(e.x - p.x, e.y - p.y), age: 0, left: seconds };
  applyStatus(e, 'przeczytane', seconds, p.id);
  bus.emit('skill:fx', { kind: 'ring', x: p.x, y: p.y, x2: p.x, y2: p.y, r: SATELLITE_R });
}

/** The roll: the player is carried along the line, bounces off what is in the way, strikes what it passes. */
export function stepRoll(s: RunState, bus: Bus, dt: number): void {
  const roll = s.hero.roll;
  if (!roll) return;
  const p = s.player;
  const type = heroDef(p.heroId).skills[0].type;
  const move = Math.min(roll.left, dt) * roll.speed;
  const want = { x: p.x + roll.dx * move, y: p.y + roll.dy * move };
  const pos = { x: want.x, y: want.y };
  resolveMove(s.page, pos, p.r);
  const px = pos.x - want.x;
  const py = pos.y - want.y;
  const push = Math.hypot(px, py);
  if (push > 0.5) {
    // something was in the way: turn the direction about the push
    const nx = px / push;
    const ny = py / push;
    const dot = roll.dx * nx + roll.dy * ny;
    if (dot < 0) {
      roll.dx -= 2 * dot * nx;
      roll.dy -= 2 * dot * ny;
      const l = Math.hypot(roll.dx, roll.dy) || 1;
      roll.dx /= l;
      roll.dy /= l;
    }
  }
  p.x = pos.x;
  p.y = pos.y;
  p.moving = true;
  p.target = null;
  if (Math.abs(roll.dx) > 0.2) p.facing = roll.dx > 0 ? 1 : -1;
  for (const e of enemiesWithin(s, p.x, p.y, p.r + 4)) {
    if (roll.hit.includes(e.id)) continue;
    roll.hit.push(e.id);
    skillDamage(s, bus, e, type, ORBITA_DAMAGE * power(s, 0));
    // the first one that is still there and is not a boss goes into orbit
    if (!s.hero.orbit && !e.boss && s.enemies.includes(e)) catchSatellite(s, bus, e);
  }
  roll.left -= dt;
  if (roll.left <= 0) s.hero.roll = null;
}

/** The satellite is moved by hand along its circle and attacks nothing (its timers are held back every step). */
export function stepOrbit(s: RunState, dt: number): void {
  const o = s.hero.orbit;
  if (!o) return;
  const e = s.enemies.find((x) => x.id === o.id);
  if (!e || o.left <= 0) {
    s.hero.orbit = null;
    return;
  }
  const p = s.player;
  o.age += dt;
  o.left -= dt;
  o.angle += ((Math.PI * 2) / SATELLITE_TURN_S) * dt;
  const k = Math.min(1, o.age / SATELLITE_EASE_S);
  const r = o.r0 + (SATELLITE_R - o.r0) * k;
  e.x = p.x + Math.cos(o.angle) * r;
  e.y = p.y + Math.sin(o.angle) * r;
  resolveMove(s.page, e, e.r);
  e.attackTimer = Math.max(e.attackTimer, 0.3);
  const rt = rtOf(e);
  rt.shootT = Math.max(rt.shootT, 0.3);
}

// ---------- Grawitacja ----------

/** Everything within reach falls toward the player at GRAVITY_SPEED; the rim costs an enemy racja once and slows it. */
export function stepGravity(s: RunState, bus: Bus, dt: number): void {
  const g = s.hero.gravity;
  if (!g) return;
  const p = s.player;
  const type = heroDef(p.heroId).skills[1].type;
  const step = GRAVITY_SPEED * dt;
  for (const e of [...s.enemies]) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d > g.radius + e.r) continue;
    const rim = p.r + e.r + RIM_GAP;
    if (d <= rim) {
      if (g.rim.includes(e.id)) continue;
      g.rim.push(e.id);
      touchStatus(e, 'do_weryfikacji', 2 * durationOf(s, 1), p.id);
      skillDamage(s, bus, e, type, GRAVITY_DAMAGE * power(s, 1));
      continue;
    }
    if (e.boss) continue; // a boss does not fall
    const move = Math.min(step, d - rim + 1);
    e.x -= ((e.x - p.x) / d) * move;
    e.y -= ((e.y - p.y) / d) * move;
    resolveMove(s.page, e, e.r);
  }
  for (const k of s.pickups) {
    const d = Math.hypot(k.x - p.x, k.y - p.y);
    const stop = p.r + k.r + 2;
    if (d > g.radius + k.r || d <= stop) continue;
    const move = Math.min(step, d - stop);
    k.x -= ((k.x - p.x) / d) * move;
    k.y -= ((k.y - p.y) / d) * move;
  }
  g.left -= dt;
  if (g.left <= 0) s.hero.gravity = null;
}

// ---------- Wniosek o status ----------

/** The flag's zone: an enemy entering is zablokowany and takes regulaminowy damage; the player inside regains racja. */
export function stepFlag(s: RunState, bus: Bus, z: Zone, dt: number): void {
  const p = s.player;
  const inside = z.inside ?? (z.inside = []);
  const type = heroDef(p.heroId).skills[2].type;
  const here = enemiesWithin(s, z.x, z.y, z.r);
  for (const e of here) {
    if (inside.includes(e.id)) continue;
    inside.push(e.id);
    applyStatus(e, 'zablokowany', FLAG_BLOCK_S, z.id);
    skillDamage(s, bus, e, type, FLAG_DAMAGE * power(s, 2));
  }
  // an enemy that has left may enter again
  for (let i = inside.length - 1; i >= 0; i--) {
    const id = inside[i];
    if (!here.some((e) => e.id === id)) inside.splice(i, 1);
  }
  if (Math.hypot(p.x - z.x, p.y - z.y) <= z.r && p.hp < p.hpMax) p.hp = Math.min(p.hpMax, p.hp + FLAG_REGEN * dt);
}
