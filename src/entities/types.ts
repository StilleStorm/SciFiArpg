import type { Claim } from '../combat/claims';
import type { DamageType, Stats } from '../combat/damage';
import type { Status } from '../combat/status';
import type { Vec } from '../core/vec';
import type { Item } from '../items';

interface Base {
  id: number;
  x: number;
  y: number;
  /** Collision radius in world units. */
  r: number;
}

/** A living fighter. hp is shown in the UI as "Racja". */
interface Fighter extends Base {
  hp: number;
  hpMax: number;
  speed: number;
  /** +1 faces right, -1 faces left. */
  facing: 1 | -1;
  moving: boolean;
  stats: Stats;
  damageType: DamageType;
  attackRange: number;
  attackCooldown: number;
  /** Seconds until the next attack is allowed. */
  attackTimer: number;
  /** Active status effects (combat/status.ts). */
  statuses: Status[];
}

export interface Player extends Fighter {
  kind: 'player';
  /** Where the finger told us to walk; null = standing. */
  target: Vec | null;
  /** Seconds spent pushing against something without getting anywhere. */
  stuck: number;
  level: number;
  gwiazdki: number;
}

export interface Enemy extends Fighter {
  kind: 'enemy';
  /** Drives the procedural look (see render/figures.ts). */
  seed: number;
  home: Vec;
  mode: 'wander' | 'chase';
  wanderTarget: Vec | null;
  /** Seconds until a new wander target is picked. */
  wanderTimer: number;
  /** The thesis in the speech bubble (combat/claims.ts). Placeholder enemies have none. */
  claim?: Claim;
}

export interface Projectile extends Base {
  kind: 'projectile';
  vx: number;
  vy: number;
  /** Seconds left. */
  ttl: number;
  damage: number;
  damageType: DamageType;
  owner: 'player' | 'enemy';
}

export interface Pickup extends Base {
  kind: 'pickup';
  item: Item;
  /** The number printed on the plate and used in the footnote. */
  number: number;
}

export type Entity = Player | Enemy | Projectile | Pickup;
export type EntityKind = Entity['kind'];
