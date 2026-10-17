import type { Enemy, Pickup, Player } from './types';
import { placeholderItem } from '../items';

export function createPlayer(id: number, x: number, y: number): Player {
  return {
    kind: 'player',
    id,
    x,
    y,
    r: 11,
    hp: 60,
    hpMax: 60,
    speed: 130,
    facing: 1,
    moving: false,
    stats: { pewnoscSiebie: 90, upor: 40, dmgMin: 4, dmgMax: 8, critChance: 0.1, resist: {} },
    damageType: 'mechaniczny',
    attackRange: 64,
    attackCooldown: 0.6,
    attackTimer: 0,
    statuses: [],
    target: null,
    stuck: 0,
    level: 1,
    gwiazdki: 0,
  };
}

export function createEnemy(id: number, x: number, y: number, seed: number): Enemy {
  return {
    kind: 'enemy',
    id,
    x,
    y,
    r: 13,
    hp: 20,
    hpMax: 20,
    speed: 72,
    facing: 1,
    moving: false,
    stats: { pewnoscSiebie: 60, upor: 30, dmgMin: 2, dmgMax: 4, critChance: 0.05, resist: {} },
    damageType: 'mechaniczny',
    attackRange: 28,
    attackCooldown: 1,
    attackTimer: 0.5,
    statuses: [],
    seed,
    home: { x, y },
    mode: 'wander',
    wanderTarget: null,
    wanderTimer: 0,
  };
}

export function createPickup(id: number, x: number, y: number, number: number): Pickup {
  return { kind: 'pickup', id, x, y, r: 14, item: placeholderItem(), number };
}
