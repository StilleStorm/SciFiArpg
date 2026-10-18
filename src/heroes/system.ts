/** The per-step hero system: cooldowns, ring buffer, shield, dash, redirects, summons, zones, player projectiles. */
import { rollDamage } from '../combat/damage';
import { applyStatus } from '../combat/status';
import type { Bus } from '../core/events';
import type { Enemy, Projectile, Summon } from '../entities/types';
import { recomputeStats } from '../items/stats';
import { attack, applyDamage } from '../systems/combat';
import { canOpenUpdate, tickUpdateQueue } from '../progression/queue';
import { PAGE_H, PAGE_W, resolveMove } from '../world/pages';
import type { RunState } from '../world/run';
import { trackRun } from './aim';
import { durationOf, enemiesWithin, nearestEnemy, power, setExistence, skillDamage, touchStatus } from './helpers';
import { FOAM_RADIUS } from './skills';
import { heroDef } from './defs';
import { pushRing, RING_STEP } from './state';

export function heroStep(s: RunState, bus: Bus, dt: number): void {
  trackRun(s); // the pad reads the live run to draw a held aim (heroes/aim.ts)
  const h = s.hero;
  const p = s.player;
  for (let i = 0; i < 3; i++) h.cd[i] = Math.max(0, (h.cd[i] ?? 0) - dt);

  h.ringTimer -= dt;
  if (h.ringTimer <= 0) {
    h.ringTimer = RING_STEP;
    pushRing(h.ring, { t: s.time, x: p.x, y: p.y, hp: p.hp });
  }
  if (h.mods.regen > 0 && p.hp < p.hpMax) p.hp = Math.min(p.hpMax, p.hp + h.mods.regen * dt);

  if (p.shield > 0) {
    if (s.time >= h.shieldUntil) p.shield = 0;
    else for (const e of enemiesWithin(s, p.x, p.y, FOAM_RADIUS)) touchStatus(e, 'do_weryfikacji', 2, p.id);
  }
  if (h.buffCrit !== 0 && s.time >= h.buffUntil) {
    p.baseStats.stats.critChance -= h.buffCrit;
    h.buffCrit = 0;
    recomputeStats(p);
  }

  stepDash(s, bus, dt);
  stepRedirects(s, bus, dt);
  stepSummons(s, bus, dt);
  stepZones(s, dt);
  stepProjectiles(s, bus, dt);
  if (tickUpdateQueue(s, dt) && canOpenUpdate(s, false)) bus.emit('update:ready');
}

/**
 * The hero on the base page (no enemies, no clock): the skill cooldowns run out, and a queued update opens when the player
 * asks for it from the HUD line (`hero.updateRequested`). The quiet of the base never opens it by itself, and skills are not
 * cast here (`castSkill` ignores the pads in the base).
 */
export function heroBaseStep(s: RunState, bus: Bus, dt: number): void {
  trackRun(s);
  const h = s.hero;
  for (let i = 0; i < 3; i++) h.cd[i] = Math.max(0, (h.cd[i] ?? 0) - dt);
  if (h.pendingLevels <= 0) h.updateRequested = false;
  else if (h.updateRequested && canOpenUpdate(s, false)) bus.emit('update:ready');
}

function stepDash(s: RunState, bus: Bus, dt: number): void {
  const d = s.hero.dash;
  if (!d) return;
  const p = s.player;
  const move = Math.min(d.left, dt) * d.speed;
  p.x += d.dx * move;
  p.y += d.dy * move;
  if (Math.abs(d.dx) > 0.2) p.facing = d.dx > 0 ? 1 : -1;
  p.target = null;
  resolveMove(s.page, p, p.r);
  if (d.drag === null) {
    const near = nearestEnemy(s, p.x, p.y, p.r + 18);
    if (near) d.drag = near.id;
  }
  const dragged = d.drag === null ? undefined : s.enemies.find((e) => e.id === d.drag);
  if (dragged) {
    dragged.x = p.x + d.dx * (p.r + dragged.r + 3);
    dragged.y = p.y + d.dy * (p.r + dragged.r + 3);
    resolveMove(s.page, dragged, dragged.r);
  }
  d.left -= dt;
  if (d.left > 0) return;
  s.hero.dash = null;
  if (dragged && s.enemies.includes(dragged)) {
    applyStatus(dragged, 'zablokowany', 1.5 * durationOf(s, 2), p.id);
    skillDamage(s, bus, dragged, heroDef(p.heroId).skills[2].type, power(s, 2));
  }
}

function stepRedirects(s: RunState, bus: Bus, dt: number): void {
  const list = s.hero.redirects;
  for (let i = list.length - 1; i >= 0; i--) {
    const r = list[i];
    if (!r) continue;
    const e = s.enemies.find((x) => x.id === r.id);
    if (!e || s.time >= r.until) {
      list.splice(i, 1);
      continue;
    }
    let other: Enemy | null = null;
    let best = 110;
    for (const o of s.enemies) {
      if (o === e) continue;
      const d = Math.hypot(o.x - e.x, o.y - e.y);
      if (d < best) {
        best = d;
        other = o;
      }
    }
    if (!other) continue;
    if (best > e.attackRange + e.r) {
      e.x += ((other.x - e.x) / best) * 60 * dt;
      e.y += ((other.y - e.y) / best) * 60 * dt;
      resolveMove(s.page, e, e.r);
    }
    if (s.time >= r.next && best <= e.attackRange + e.r + other.r && !s.law.botTime) {
      r.next = s.time + 0.8;
      const res = rollDamage(e.stats, other.stats, e.damageType, s.rngs.combat);
      if (res.hit) applyDamage(s, bus, other, res.amount, res.crit, e.damageType);
    }
  }
}

function stepSummons(s: RunState, bus: Bus, dt: number): void {
  const p = s.player;
  for (let i = s.summons.length - 1; i >= 0; i--) {
    const m = s.summons[i];
    if (!m) continue;
    m.ttl -= dt;
    if (m.ttl <= 0) {
      s.summons.splice(i, 1);
      bus.emit('summon:expired', { id: m.id });
      continue;
    }
    if (m.variant === 'decoy') {
      if (Math.floor(s.time * 4) !== Math.floor((s.time - dt) * 4)) {
        for (const e of enemiesWithin(s, m.x, m.y, 190)) touchStatus(e, 'przeczytane', 1, m.id);
      }
      continue;
    }
    const target = nearestEnemy(s, m.x, m.y, 280);
    let tx = m.x;
    let ty = m.y;
    let want = false;
    if (target) {
      const d = Math.hypot(target.x - m.x, target.y - m.y);
      if (d > m.attackRange * 0.75) {
        tx = target.x;
        ty = target.y;
        want = true;
      }
      m.facing = target.x >= m.x ? 1 : -1;
    } else if (Math.hypot(p.x - m.x, p.y - m.y) > 64) {
      tx = p.x;
      ty = p.y;
      want = true;
    }
    m.moving = false;
    if (want) {
      const d = Math.hypot(tx - m.x, ty - m.y) || 1;
      m.x += ((tx - m.x) / d) * m.speed * dt;
      m.y += ((ty - m.y) / d) * m.speed * dt;
      m.moving = true;
      resolveMove(s.page, m, m.r);
    }
    m.attackTimer = Math.max(0, m.attackTimer - dt);
    if (target && m.attackTimer <= 0 && !s.law.botTime && Math.hypot(target.x - m.x, target.y - m.y) <= m.attackRange) {
      m.attackTimer = m.attackCooldown;
      fireFrom(s, m, target);
      bus.emit('attack:started', { attackerId: m.id, attacker: 'summon', x: m.x, y: m.y, tx: target.x, ty: target.y, ranged: true });
    }
  }
}

function fireFrom(s: RunState, m: Summon, target: Enemy): void {
  const d = Math.hypot(target.x - m.x, target.y - m.y) || 1;
  const speed = 400;
  s.projectiles.push({
    kind: 'projectile',
    id: s.nextId++,
    x: m.x,
    y: m.y,
    r: 4,
    vx: ((target.x - m.x) / d) * speed,
    vy: ((target.y - m.y) / d) * speed,
    ttl: Math.min(0.9, (m.attackRange + 40) / speed),
    damage: m.damageMul,
    damageType: m.damageType,
    owner: 'player',
    passed: [],
  });
}

function stepZones(s: RunState, dt: number): void {
  for (let i = s.zones.length - 1; i >= 0; i--) {
    const z = s.zones[i];
    if (!z) continue;
    z.ttl -= dt;
    if (z.variant === 'hourglass') {
      const e = s.enemies.find((x) => x.id === z.follow);
      if (!e || z.ttl <= 0) {
        s.zones.splice(i, 1);
        continue;
      }
      z.x = e.x;
      z.y = e.y - e.r - 18;
      continue;
    }
    if (z.ttl <= 0) {
      s.zones.splice(i, 1);
      continue;
    }
    for (const e of enemiesWithin(s, z.x, z.y, z.r)) {
      touchStatus(e, 'do_weryfikacji', 0.6, z.id);
      setExistence(e, 0.3);
    }
  }
}

function stepProjectiles(s: RunState, bus: Bus, dt: number): void {
  const list = s.projectiles;
  for (let i = list.length - 1; i >= 0; i--) {
    const pr = list[i];
    if (!pr || pr.owner !== 'player') continue;
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    pr.ttl -= dt;
    let done = pr.ttl <= 0 || pr.x < 0 || pr.y < 0 || pr.x > PAGE_W || pr.y > PAGE_H;
    if (!done && !s.law.botTime) {
      for (const e of enemiesWithin(s, pr.x, pr.y, pr.r)) {
        if (pr.passed?.includes(e.id)) continue;
        if (projectileHit(s, bus, pr, e)) {
          done = true;
          break;
        }
      }
    }
    if (done) list.splice(i, 1);
  }
}

/** Returns true if the projectile is spent. */
function projectileHit(s: RunState, bus: Bus, pr: Projectile, e: Enemy): boolean {
  const passed = pr.passed ?? (pr.passed = []);
  const p = s.player;
  if (pr.roll) {
    // an auto-attack: the ordinary roll with the player's stats; keep the attack timer as it was
    const timer = p.attackTimer;
    let crit = false;
    const off = bus.on('enemy:hit', (ev) => {
      if (ev.id === e.id) crit = ev.crit;
    });
    attack(s, bus, p, e);
    off();
    p.attackTimer = timer;
    if (crit && pr.pierceOnCrit) pr.pierce = (pr.pierce ?? 0) + 1;
  } else {
    skillDamage(s, bus, e, pr.damageType, pr.damage + (pr.bonusPerPass ?? 0) * passed.length);
  }
  passed.push(e.id);
  if ((pr.pierce ?? 0) > 0) {
    pr.pierce = (pr.pierce ?? 0) - 1;
    return false;
  }
  return true;
}
