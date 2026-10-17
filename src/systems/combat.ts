import { rollDamage } from '../combat/damage';
import type { Bus } from '../core/events';
import type { Grid } from '../entities';
import { createPickup } from '../entities/factory';
import type { Enemy, Player } from '../entities';
import { nextId, type RunState } from '../world/run';

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
  return applyDamage(s, bus, defender, res.amount, res.crit);
}

/** Subtract racja, emit the hit event, and handle death. Returns true if the defender died. */
export function applyDamage(s: RunState, bus: Bus, defender: Fighter, amount: number, crit: boolean): boolean {
  defender.hp -= amount;
  const payload = { x: defender.x, y: defender.y, amount, crit };
  if (defender.kind === 'enemy') bus.emit('enemy:hit', { id: defender.id, ...payload });
  else bus.emit('player:hit', payload);
  if (defender.hp > 0) return false;
  if (defender.kind === 'enemy') killEnemy(s, bus, defender);
  else killPlayer(s, bus, defender);
  return true;
}

export function killEnemy(s: RunState, bus: Bus, e: Enemy): void {
  const i = s.enemies.indexOf(e);
  if (i < 0) return;
  s.enemies.splice(i, 1);
  s.kills++;
  s.player.gwiazdki++; // placeholder income; the economy agent owns gwiazdki
  s.pickups.push(createPickup(nextId(s), e.x, e.y, s.nextItemNumber++));
  bus.emit('enemy:died', { id: e.id, x: e.x, y: e.y });
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
  if (nearest && (!p.moving || adjacent)) attack(s, bus, p, nearest);
}

export function enemiesAttack(s: RunState, bus: Bus, dt: number): void {
  const p = s.player;
  for (const e of [...s.enemies]) {
    e.attackTimer = Math.max(0, e.attackTimer - dt);
    if (e.attackTimer > 0 || s.status !== 'running') continue;
    if (Math.hypot(p.x - e.x, p.y - e.y) <= e.attackRange + p.r) attack(s, bus, e, p);
  }
}
