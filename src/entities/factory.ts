import type { Enemy, Pickup, Player, Summon, Zone } from './types';
import type { FamilyId } from '../enemies/ids';
import type { Item } from '../items';
import { DEFAULT_HERO_ID } from '../heroes/registry';

/** Collision radius of a card on the ground (drawn 1.3 times larger than it was). */
export const CARD_R = 18;

export function createPlayer(id: number, x: number, y: number): Player {
  return {
    kind: 'player',
    id,
    x,
    y,
    r: 13,
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
    equipment: {},
    inventory: [],
    baseStats: {
      hpMax: 60,
      stats: { pewnoscSiebie: 90, upor: 40, dmgMin: 4, dmgMax: 8, critChance: 0.1, resist: {} },
      damageType: 'mechaniczny',
      attackRange: 64,
      attackCooldown: 0.6,
    },
    heroId: DEFAULT_HERO_ID,
    xp: 0,
    shield: 0,
    trialSpeed: 1,
    seesDefects: false,
    revealsPage: false,
    suspended: false,
    permissions: [],
    meter: 0,
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
    family: 'urzadzenia',
    tier: 1,
  };
}

/** A plate on the ground: an item, or (with `gwiazdki`) a small star. Neither given = one star. */
export function createPickup(id: number, x: number, y: number, number: number, item?: Item, gwiazdki?: number): Pickup {
  const pickup: Pickup = { kind: 'pickup', id, x, y, r: item ? CARD_R : 14, number };
  if (item) pickup.item = item;
  if (gwiazdki !== undefined) pickup.gwiazdki = gwiazdki;
  else if (!item) pickup.gwiazdki = 1;
  return pickup;
}

/** A permission card for a family: a small checkbox on the ground. Number 0, never an inventory item. */
export function createPermissionPickup(id: number, x: number, y: number, family: FamilyId): Pickup {
  return { kind: 'pickup', id, x, y, r: CARD_R, number: 0, permission: family };
}

/** A potwierdzenie slip on the ground. Number 0, never an inventory item. */
export function createPotwierdzeniePickup(id: number, x: number, y: number): Pickup {
  return { kind: 'pickup', id, x, y, r: 11, number: 0, potwierdzenie: true };
}

export function createSummon(id: number, x: number, y: number, init: Pick<Summon, 'variant' | 'heroId' | 'ttl'> & Partial<Summon>): Summon {
  return {
    kind: 'summon',
    id,
    x,
    y,
    r: 10,
    facing: 1,
    moving: false,
    damageType: 'egzystencjalny',
    attackRange: 120,
    attackCooldown: 1.1,
    attackTimer: 0.4,
    damageMul: 0.6,
    speed: 105,
    ...init,
  };
}

export function createZone(id: number, x: number, y: number, init: Pick<Zone, 'variant' | 'r' | 'ttl'> & Partial<Zone>): Zone {
  return { kind: 'zone', id, x, y, ...init };
}
