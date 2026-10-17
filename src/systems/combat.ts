import { rollDamage, type DamageType } from '../combat/damage';
import { canMelee, enemyOutgoing, modifyDamage, onEnemyHurt } from '../enemies/hooks';
import type { Bus } from '../core/events';
import type { Grid } from '../entities';
import type { Enemy, Player } from '../entities';
import { type RunState } from '../world/run';
import { fireAuto } from '../heroes/auto';
import { absorbShield, playerDamageMul } from '../heroes/shield';

type Fighter = Player | Enemy;

/** One attack: roll, apply, emit. Returns true if the defender died. */
export function attack(s: RunState, bus: Bus, attacker: Fighter, defender: Fighter): boolean {
  const res = rollDamage(attacker.stats, defender.stats, attacker.damageType, s.rngs.combat);
  attacker.attackTimer = attacker.attackCooldown;
  const dir = defender.x - attacker.x;
  if (Math.abs(dir) > 1) attacker.facing = dir > 0 ? 1 : -1;
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
  if (defender.kind === 'player') amount = absorbShield(defender, amount);
  if (amount <= 0) return false;
  defender.hp -= amount;
  const payload = { x: defender.x, y: defender.y, amount, crit };
  if (defender.kind === 'enemy') bus.emit('enemy:hit', { id: defender.id, ...payload });
  else bus.emit('player:hit', payload);
  if (defender.hp > 0) {
    if (defender.kind === 'enemy') onEnemyHurt(s, bus, defender, type);
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

/** Auto-attack the nearest enemy in range when standing still or when one is adjacent. */
export function playerAttacks(s: RunState, grid: Grid<Enemy>, bus: Bus, dt: number): void {
  const p = s.player;
  p.attackTimer = Math.max(0, p.attackTimer - dt);
  if (p.attackTimer > 0) return;
  let nearest: Enemy | null = null;
  let best = Infinity;
  let adjacent = false;
  for (const e of grid.query(p.x, p.y, p.attackRange)) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < best) {
      best = d;
      nearest = e;
    }
    if (d <= p.r + e.r + 8) adjacent = true;
  }
  if (nearest && (!p.moving || adjacent) && !fireAuto(s, p, nearest)) attack(s, bus, p, nearest);
}

export function enemiesAttack(s: RunState, bus: Bus, dt: number): void {
  const p = s.player;
  for (const e of [...s.enemies]) {
    e.attackTimer = Math.max(0, e.attackTimer - dt);
    if (e.attackTimer > 0 || s.status !== 'running' || p.suspended || !canMelee(s, e)) continue;
    if (Math.hypot(p.x - e.x, p.y - e.y) <= e.attackRange + p.r) attack(s, bus, e, p);
  }
}
