import { rollDamage, type DamageType } from '../combat/damage';
import { learnDefect } from '../enemies/runtime';
import { canMelee, enemyOutgoing, modifyDamage, onEnemyHurt } from '../enemies/hooks';
import type { Bus } from '../core/events';
import type { Grid } from '../entities';
import type { Enemy, Player } from '../entities';
import { isStunned } from '../combat/status';
import { resolveMove } from '../world/pages';
import { type RunState } from '../world/run';
import { fireAuto } from '../heroes/auto';
import { heroDef } from '../heroes/defs';
import { absorbShield, playerDamageMul } from '../heroes/shield';

type Fighter = Player | Enemy;

/** A crit shoves the enemy this far away from the player; the clause Grawitacja doradcza multiplies it. */
export const CRIT_KNOCKBACK = 12;

/** Push `e` away from (fromX, fromY) by `dist * state.law.knockbackMul` units, stopping at walls and obstacles. */
export function knockback(s: RunState, e: Enemy, fromX: number, fromY: number, dist: number): void {
  const d = Math.hypot(e.x - fromX, e.y - fromY);
  const push = dist * s.law.knockbackMul;
  if (d < 0.001 || push <= 0) return;
  e.x += ((e.x - fromX) / d) * push;
  e.y += ((e.y - fromY) / d) * push;
  resolveMove(s.page, e, e.r);
}

/** One attack: roll, apply, emit. Returns true if the defender died. */
export function attack(s: RunState, bus: Bus, attacker: Fighter, defender: Fighter): boolean {
  const res = rollDamage(attacker.stats, defender.stats, attacker.damageType, s.rngs.combat);
  attacker.attackTimer = attacker.attackCooldown;
  const dir = defender.x - attacker.x;
  // a walking player keeps facing where he walks (movement sets it every step); a turn here would flicker one frame
  if (Math.abs(dir) > 1 && !(attacker.kind === 'player' && attacker.moving)) attacker.facing = dir > 0 ? 1 : -1;
  // a ranged hero's shot announced itself when it left the hand (heroes/auto.ts); this call is only its landing
  if (!(attacker.kind === 'player' && heroDef(attacker.heroId).auto.projectile)) {
    bus.emit('attack:started', { attackerId: attacker.id, attacker: attacker.kind, x: attacker.x, y: attacker.y, tx: defender.x, ty: defender.y, ranged: false });
  }
  if (!res.hit) {
    if (defender.kind === 'enemy') bus.emit('enemy:miss', { id: defender.id });
    return false;
  }
  const dealt =
    attacker.kind === 'player' ? Math.max(1, Math.round(res.amount * playerDamageMul(attacker))) : enemyOutgoing(attacker, res.amount);
  return applyDamage(s, bus, defender, dealt, res.crit, attacker.damageType);
}

/** Subtract racja, emit the hit event, and handle death. Returns true if the defender died. */
export function applyDamage(s: RunState, bus: Bus, defender: Fighter, amount: number, crit: boolean, type?: DamageType): boolean {
  ({ amount, crit } = modifyDamage(bus, defender, amount, crit, type)); // claims, existence, zgloszony
  if (defender.kind === 'enemy' && defender.defect) learnDefect(s, defender.defect);
  if (defender.kind === 'player') amount = absorbShield(defender, amount);
  if (amount <= 0) return false;
  defender.hp -= amount;
  const payload = { x: defender.x, y: defender.y, amount, crit };
  if (defender.kind === 'enemy') bus.emit('enemy:hit', { id: defender.id, ...payload });
  else bus.emit('player:hit', payload);
  if (defender.hp > 0) {
    if (defender.kind === 'enemy') {
      onEnemyHurt(s, bus, defender, type);
      if (crit && !defender.boss) knockback(s, defender, s.player.x, s.player.y, CRIT_KNOCKBACK);
    }
    return false;
  }
  if (defender.kind === 'enemy') killEnemy(s, bus, defender);
  else killPlayer(s, bus, defender);
  return true;
}

export function killEnemy(s: RunState, bus: Bus, e: Enemy): void {
  const i = s.enemies.indexOf(e);
  if (i < 0) return;
  s.enemies.splice(i, 1);
  s.kills++;
  bus.emit('enemy:died', { id: e.id, x: e.x, y: e.y, tier: e.boss ? 'boss' : e.elite ? 'elite' : 'common', family: e.family });
  if (e.boss) bus.emit('boss:died', { id: e.id, family: e.family, x: e.x, y: e.y });
}

function killPlayer(s: RunState, bus: Bus, p: Player): void {
  s.status = 'dead';
  p.target = null;
  p.moving = false;
  bus.emit('player:died', { x: p.x, y: p.y });
}

/**
 * Auto-attack the nearest enemy in range, standing or moving (DESIGN 2): a ranged hero shoots while steering or
 * walking to a tap, a melee hero swings at whatever is within reach. Nothing in range, nothing happens.
 */
export function playerAttacks(s: RunState, grid: Grid<Enemy>, bus: Bus, dt: number): void {
  const p = s.player;
  p.attackTimer = Math.max(0, p.attackTimer - dt);
  if (p.attackTimer > 0 || isStunned(p)) return;
  let nearest: Enemy | null = null;
  let best = Infinity;
  for (const e of grid.query(p.x, p.y, p.attackRange)) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < best) {
      best = d;
      nearest = e;
    }
  }
  if (nearest && !fireAuto(s, p, nearest, bus)) attack(s, bus, p, nearest);
}

export function enemiesAttack(s: RunState, bus: Bus, dt: number): void {
  const p = s.player;
  for (const e of [...s.enemies]) {
    e.attackTimer = Math.max(0, e.attackTimer - dt);
    if (e.attackTimer > 0 || s.status !== 'running' || p.suspended || !canMelee(s, e)) continue;
    if (Math.hypot(p.x - e.x, p.y - e.y) <= e.attackRange + p.r) attack(s, bus, e, p);
  }
}
