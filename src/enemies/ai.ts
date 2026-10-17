/**
 * Enemy AI: wander near home, notice the player inside the aggro radius, chase or keep range, attack, go home
 * when led too far. Simple obstacle steering, group spacing, defect and elite mechanics, escalation, claim
 * rotation, existence drift, first-meeting footnotes. `updateEnemyAi` is the one entry (systems/enemies.ts).
 */
import { applyStatus, getStatus, isSilenced, isStunned, statusSpeedMul } from '../combat/status';
import type { Bus } from '../core/events';
import type { Rng } from '../core/rng';
import { clamp } from '../core/vec';
import type { Enemy, Grid } from '../entities';
import { t } from '../i18n';
import { attack } from '../systems/combat';
import { aggroMul } from '../world/laws';
import { resolveMove } from '../world/pages';
import type { RunState } from '../world/run';
import { assemble, assembleBoss, serialOf } from './assemble';
import { tickBoss } from './bosses';
import {
  AURA_DMG_MUL,
  AURA_RADIUS,
  BOSS_OF,
  CLAIMS,
  CLAIM_ROTATE_S,
  DEFECTS,
  ELITES,
  ESCALATE_S,
  SPONSOR_SPEED_MUL,
  enemyName,
  tierStats,
} from './families';
import { applyTierStats } from './make';
import { fireShot, updateEnemyProjectiles } from './projectiles';
import { rtOf } from './runtime';
import type { RangedSpec } from './partsBase';

const WANDER_RADIUS = 120;
const LEASH = 480;
const LEASH_HOME_S = 6;
const WAKE_RADIUS = 100;
const MEET_RANGE = 300;
const MEET_RANGE_SEES_DEFECTS = 620;
const MEET_GAP_S = 2.5;
const BOSS_AGGRO = 700;

interface Target {
  x: number;
  y: number;
  r: number;
  /** The enemy being chased, when it is not the player (a taunting copy). */
  enemy: Enemy | null;
  player: boolean;
}

/** The ranged weapon of an enemy, resolved once. */
export function rangedOf(e: Enemy): RangedSpec | null {
  const rt = rtOf(e);
  if (rt.ranged === undefined) {
    const a = e.boss ? assembleBoss(BOSS_OF[e.family], e.seed) : assemble(e.seed, e.family, e.tier);
    rt.ranged = a.ranged ?? null;
  }
  return rt.ranged;
}

export function aggroRadius(s: RunState, e: Enemy): number {
  const base = e.boss ? BOSS_AGGRO : tierStats(e.family, e.tier).aggro;
  return base * (e.defect === 'loud' ? 2 : 1) * aggroMul(s);
}

function findTarget(s: RunState, e: Enemy): Target | null {
  const p = s.player;
  const taunt = getStatus(e, 'przeczytane');
  if (taunt && taunt.source !== null && taunt.source !== p.id) {
    const other = s.enemies.find((o) => o.id === taunt.source);
    if (other) return { x: other.x, y: other.y, r: other.r, enemy: other, player: false };
    const sum = s.summons.find((o) => o.id === taunt.source);
    if (sum) return { x: sum.x, y: sum.y, r: sum.r, enemy: null, player: false };
  }
  if (p.suspended || s.status !== 'running') return null;
  return { x: p.x, y: p.y, r: p.r, enemy: null, player: true };
}

// ---------- timed traits (exported for tests) ----------

/** Existence drifts to a new value every few seconds; a pin (confirm / mark) overrides it. */
export function tickExistence(e: Enemy, rng: Rng, dt: number): void {
  if (e.existence === undefined) return;
  const rt = rtOf(e);
  if (rt.ePin) {
    rt.ePin.t -= dt;
    e.existence = rt.ePin.value;
    if (rt.ePin.t <= 0) rt.ePin = null;
    return;
  }
  rt.eTimer -= dt;
  if (rt.eTimer <= 0) {
    rt.eTimer = rng.range(2, 4.5);
    rt.eTarget = rng.range(0.3, 1);
  }
  e.existence = clamp(e.existence + (rt.eTarget - e.existence) * Math.min(1, dt * 1.5), 0.3, 1);
}

/** A notification left alive climbs to the next tier every ESCALATE_S seconds. Returns true when it did. */
export function tickEscalation(e: Enemy, rng: Rng, bus: Bus, dt: number): boolean {
  if (e.escalateIn === undefined || e.boss) return false;
  e.escalateIn -= dt;
  if (e.escalateIn > 0) return false;
  if (e.tier >= 4) {
    e.escalateIn = undefined;
    return false;
  }
  e.tier += 1;
  applyTierStats(e, true);
  const list = CLAIMS.powiadomienia;
  const c = list[e.tier - 1];
  if (c) e.claim = { textKey: c.key, type: c.type };
  rtOf(e).offTopicShown = false;
  e.escalateIn = e.tier < 4 ? ESCALATE_S : undefined;
  void rng;
  bus.emit('enemy:escalated', { id: e.id, tier: e.tier, x: e.x, y: e.y });
  return true;
}

/** Elites swap their claim every CLAIM_ROTATE_S seconds (a new bubble, drawn in). */
export function tickClaimRotation(e: Enemy, rng: Rng, dt: number): boolean {
  if (!e.elite || e.boss) return false;
  const rt = rtOf(e);
  rt.claimT -= dt;
  if (rt.claimT > 0) return false;
  rt.claimT = CLAIM_ROTATE_S;
  const all = CLAIMS[e.family].filter((c) => c.key !== e.claim?.textKey);
  const c = rng.pick(all);
  e.claim = { textKey: c.key, type: c.type };
  rtOf(e).offTopicShown = false;
  return true;
}

function tickDefects(s: RunState, e: Enemy, dt: number, engaged: boolean): void {
  const rt = rtOf(e);
  const ai = s.rngs.ai;
  rt.spin = Math.max(0, rt.spin - dt);
  if (rt.fwWalk > 0) rt.fwWalk = Math.max(0, rt.fwWalk - dt);
  if (e.defect === 'firmware') {
    rt.fwT -= dt;
    if (rt.fwT <= 0) {
      rt.fwT = 1;
      if (engaged && rt.fwWalk <= 0 && ai.chance(0.2)) {
        rt.fwWalk = 1;
        const a = ai.range(0, Math.PI * 2);
        rt.fwDir = { x: Math.cos(a), y: Math.sin(a) };
      }
    }
  }
  if (e.defect === 'overheat') {
    if (!engaged && rt.heatPhase === 'cool') {
      rt.heatT = 5;
    } else {
      rt.heatT -= dt;
      if (rt.heatT <= 0) {
        if (rt.heatPhase === 'cool') {
          rt.heatPhase = 'hot';
          rt.heatT = 3;
        } else if (rt.heatPhase === 'hot') {
          rt.heatPhase = 'stall';
          rt.heatT = 2;
          applyStatus(e, 'zablokowany', 2, null);
        } else {
          rt.heatPhase = 'cool';
          rt.heatT = 5;
        }
      }
    }
  }
}

// ---------- first meetings ----------

interface Meetings {
  keys: Set<string>;
  last: number;
}
const meetings = new WeakMap<RunState, Meetings>();

function meet(s: RunState, e: Enemy, bus: Bus): void {
  let m = meetings.get(s);
  if (!m) {
    m = { keys: new Set(), last: -99 };
    meetings.set(s, m);
  }
  if (s.time - m.last < MEET_GAP_S) return;
  const d = Math.hypot(e.x - s.player.x, e.y - s.player.y);
  const note = (key: string, text: string): void => {
    m.keys.add(key);
    m.last = s.time;
    bus.emit('footnote', { text });
  };
  if (e.boss) {
    const key = `boss:${e.family}`;
    if (!m.keys.has(key) && d < MEET_RANGE * 1.7) note(key, t(`enemies.boss.${BOSS_OF[e.family]}.meet`));
    return;
  }
  if (d > (s.player.seesDefects ? MEET_RANGE_SEES_DEFECTS : MEET_RANGE)) return;
  const fk = `family:${e.family}`;
  if (!m.keys.has(fk) && d < MEET_RANGE) {
    note(fk, t(`enemies.family.${e.family}.meet`));
    return;
  }
  if (e.defect) {
    const dk = `defect:${e.defect}`;
    if (!m.keys.has(dk)) {
      const def = DEFECTS[e.defect];
      note(dk, t('enemies.defect.footnote', { serial: serialOf(e.seed), cause: t(def.causeKey), effect: t(def.effectKey), vuln: t(`combat.type.${def.vuln}`) }));
      return;
    }
  }
  if (e.elite) {
    const ek = `elite:${e.elite.affix}`;
    if (!m.keys.has(ek) && d < MEET_RANGE) {
      const body = assemble(e.seed, e.family, e.tier).body;
      note(ek, t('enemies.elite.footnote', { serial: serialOf(e.seed), name: enemyName(body, e.elite.affix), effect: t(`${ELITES[e.elite.affix].prefix}.effect`) }));
    }
  }
}

// ---------- steering ----------

/** Move e one step toward (tx, ty) at `speed`, bending around inked obstacles. Returns true if it moved. */
function steerStep(s: RunState, e: Enemy, tx: number, ty: number, speed: number, dt: number): boolean {
  const dx = tx - e.x;
  const dy = ty - e.y;
  const dl = Math.hypot(dx, dy);
  if (dl < 1 || speed <= 0) return false;
  let ux = dx / dl;
  let uy = dy / dl;
  for (const o of s.page.obstacles) {
    for (const c of o.colliders) {
      const ox = e.x - c.x;
      const oy = e.y - c.y;
      const od = Math.hypot(ox, oy);
      const look = c.r + e.r + 26;
      if (od >= look || od < 1e-6) continue;
      const toward = -(ux * ox + uy * oy) / od;
      if (toward <= 0.15) continue;
      // slide along the circle on the side that agrees with where we want to go
      let tx2 = -oy / od;
      let ty2 = ox / od;
      if (tx2 * ux + ty2 * uy < 0) {
        tx2 = -tx2;
        ty2 = -ty2;
      }
      const w = ((look - od) / look) * toward * 1.8;
      ux += tx2 * w + (ox / od) * w * 0.5;
      uy += ty2 * w + (oy / od) * w * 0.5;
    }
  }
  const ul = Math.hypot(ux, uy) || 1;
  const step = Math.min(speed * dt, dl);
  e.x += (ux / ul) * step;
  e.y += (uy / ul) * step;
  if (Math.abs(ux) > 0.15) e.facing = ux > 0 ? 1 : -1;
  return true;
}

/** Keep apart from neighbours so a wave does not stack on one pixel. */
function separate(e: Enemy, grid: Grid<Enemy>, near: Enemy[]): void {
  near.length = 0;
  for (const o of grid.query(e.x, e.y, e.r * 2.6, near)) {
    if (o === e) continue;
    const ox = e.x - o.x;
    const oy = e.y - o.y;
    const od = Math.hypot(ox, oy) || 0.5;
    const min = (e.r + o.r) * 1.05;
    if (od >= min) continue;
    const push = ((min - od) / 2) * 0.6;
    e.x += (ox / od) * push;
    e.y += (oy / od) * push;
  }
}

// ---------- one enemy ----------

function tickEnemy(s: RunState, e: Enemy, grid: Grid<Enemy>, near: Enemy[], bus: Bus, dt: number): void {
  const rt = rtOf(e);
  const ai = s.rngs.ai;
  rt.age += dt;
  if (!e.boss) tickExistence(e, ai, dt);
  tickEscalation(e, ai, bus, dt);
  tickClaimRotation(e, ai, dt);
  rt.shootT -= dt;
  meet(s, e, bus);

  const tg = findTarget(s, e);
  const dp = tg ? Math.hypot(tg.x - e.x, tg.y - e.y) : Infinity;
  const taunted = getStatus(e, 'przeczytane') !== undefined && tg !== null;
  const aggro = aggroRadius(s, e);
  if (rt.leash > 0) rt.leash -= dt;
  if (!e.boss && rt.leash <= 0 && Math.hypot(e.x - e.home.x, e.y - e.home.y) > LEASH) rt.leash = LEASH_HOME_S;
  const chasing = tg !== null && rt.leash <= 0 && !rt.asleep && (taunted || dp < (e.mode === 'chase' ? aggro * 1.3 : aggro));
  e.mode = chasing ? 'chase' : 'wander';

  tickDefects(s, e, dt, chasing);
  if (e.boss) tickBoss(s, e, bus, dt);
  e.attackCooldown = rt.baseCooldown / (rt.atkSpeed * (rt.heatPhase === 'hot' ? 2 : 1));

  if (isStunned(e)) {
    e.moving = false;
    return;
  }
  if (rt.asleep) {
    if (tg && dp < WAKE_RADIUS) rt.asleep = false;
    else {
      e.moving = false;
      return;
    }
  }

  let speed = rt.baseSpeed * statusSpeedMul(e) * rt.speedMul * (rt.limped ? 0.6 : 1) * (e.elite?.affix === 'sponsorowany' ? SPONSOR_SPEED_MUL : 1);
  if (rt.heatPhase === 'stall') speed = 0;
  let tx = e.x;
  let ty = e.y;
  let mv = 0;
  const ranged = rangedOf(e);

  if (rt.fwWalk > 0) {
    tx = e.x + rt.fwDir.x * 40;
    ty = e.y + rt.fwDir.y * 40;
    mv = speed * 0.8;
  } else if (rt.leash > 0) {
    tx = e.home.x;
    ty = e.home.y;
    mv = speed * 0.85;
  } else if (chasing && tg) {
    if (ranged) {
      const want = ranged.range * 0.7;
      if (dp > ranged.range * 0.85) {
        tx = tg.x;
        ty = tg.y;
        mv = speed;
      } else if (dp < want * 0.55) {
        tx = e.x - (tg.x - e.x);
        ty = e.y - (tg.y - e.y);
        mv = speed * 0.7;
      }
    } else if (dp > e.attackRange * 0.75 + tg.r) {
      tx = tg.x;
      ty = tg.y;
      mv = speed;
    }
  } else {
    e.wanderTimer -= dt;
    if (e.wanderTimer <= 0) {
      e.wanderTimer = ai.range(1.5, 3.5);
      e.wanderTarget = ai.chance(0.3)
        ? null
        : { x: e.home.x + ai.range(-WANDER_RADIUS, WANDER_RADIUS), y: e.home.y + ai.range(-WANDER_RADIUS, WANDER_RADIUS) };
    }
    if (e.wanderTarget) {
      tx = e.wanderTarget.x;
      ty = e.wanderTarget.y;
      mv = speed * 0.4;
      if (Math.hypot(tx - e.x, ty - e.y) < 4) e.wanderTarget = null;
    }
  }

  e.moving = mv > 0 && steerStep(s, e, tx, ty, mv, dt);
  separate(e, grid, near);
  resolveMove(s.page, e, e.r);

  // shots of ranged enemies (a special: silenced enemies cannot)
  if (ranged && chasing && tg && dp <= ranged.range && rt.shootT <= 0 && !isSilenced(e) && !s.law.botTime) {
    const count = e.boss ? (rt.phase >= 2 ? 5 : 3) : 1;
    fireShot(s, e, tg.x, tg.y, ranged, count);
    rt.shootT = (ranged.cooldown / (rt.atkSpeed * (rt.heatPhase === 'hot' ? 2 : 1))) * ai.range(0.85, 1.2);
  }

  // a taunting copy can be hit too (melee against the player is handled by systems/combat.ts)
  if (tg?.enemy && e.attackTimer <= 0 && !s.law.botTime && dp <= e.attackRange + tg.r + e.r) {
    attack(s, bus, e, tg.enemy);
  }
}

/** Per step: auras, every enemy, then the shots in flight. */
export function updateEnemyAi(s: RunState, grid: Grid<Enemy>, bus: Bus, dt: number): void {
  const list = [...s.enemies];
  for (const e of list) rtOf(e).dmgMult = 1;
  for (const a of list) {
    if (a.elite?.affix !== 'zweryfikowany') continue;
    for (const o of list) {
      if (o !== a && Math.hypot(o.x - a.x, o.y - a.y) < AURA_RADIUS) rtOf(o).dmgMult = AURA_DMG_MUL;
    }
  }
  const near: Enemy[] = [];
  for (const e of list) {
    if (s.enemies.includes(e)) tickEnemy(s, e, grid, near, bus, dt);
  }
  updateEnemyProjectiles(s, bus, dt);
}
