import type { Claim } from '../combat/claims';
import type { DamageType, Stats } from '../combat/damage';
import type { Status } from '../combat/status';
import type { Vec } from '../core/vec';
import type { EnemyRt } from '../enemies/runtime';
import type { DefectId, EliteId, FamilyId } from '../enemies/ids';
import type { HeroId } from '../heroes';
import type { Item, ItemGrant, SetId, Slot } from '../items';

/** What a hero gives before any equipment (items/stats.ts adds the gear). B3 sets it per hero. */
export interface BaseStats {
  hpMax: number;
  stats: Stats;
  damageType: DamageType;
  attackRange: number;
  attackCooldown: number;
}

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
  /**
   * Joystick steering (ui/joystick.ts): unit direction and strength 0..1. Set every frame by game.ts while a thumb
   * is on the stick, absent otherwise; it overrides `target` (systems/movement.ts).
   */
  steer?: { dx: number; dy: number; mag: number };
  level: number;
  gwiazdki: number;
  /** Percent more gwiazdki from pickups, from the gear (items/stats.ts sets it; economy/stars.ts earnStars reads it). */
  starBonus?: number;
  /** The fraction of a gwiazdka the bonus has accumulated so far (economy/stars.ts). Never saved. */
  starCarry?: number;
  /** Worn items by slot (items/inventory.ts equips; items/stats.ts recomputes stats from them). */
  equipment: Partial<Record<Slot, Item>>;
  /** Carried items, at most INVENTORY_CAP (20). */
  inventory: Item[];
  /** What the hero gives before equipment; items/stats.ts recomputeStats(player) adds the gear on top. */
  baseStats: BaseStats;
  /** Which hero is being played (heroes/defs.ts). */
  heroId: HeroId;
  /** Reputacja collected towards the next level (progression/xp.ts). */
  xp: number;
  /** Foam shield: absorbs this much damage before racja is touched (heroes/skills.ts). */
  shield: number;
  /** Items are trialed this many times faster (Konsultant: 2). */
  trialSpeed: number;
  /** Enemy defects are visible at once (Konsultant). */
  seesDefects: boolean;
  /** The whole page map is revealed on entry (Kartograf). */
  revealsPage: boolean;
  /** Shadowbanned: enemies ignore the player, no pickups, -30% damage (death/outcomes.ts). */
  suspended: boolean;
  /** Permission tokens (a family id such as 'urzadzenia') that unlock gated updates. */
  permissions: string[];
  /** Nalesnik's quirk: rounded up for a few seconds (heroes/quirks.ts sets it; the figure is drawn rounder). */
  round?: boolean;
  /** The hero has the `skim` trait (heroes/defs.ts HeroTraits): projectiles skim off it at full racja (heroes/shield.ts). */
  skim?: boolean;
  /** The Argument meter, 0..1 (combat/meter.ts): fills from rebuttals, kills and a right Spor reply; full = one ultimate. Never saved. */
  meter: number;
  /** Potwierdzenia held for later use, 0..5 (systems/recovery.ts; saved with the character). Absent = none. */
  potwierdzenia?: number;
  /** Run time (s) of the last blow that took racja; regen waits 4 s after it (systems/recovery.ts). */
  hurtAt?: number;
  /** S17: worn set pieces per set that count (items/stats.ts recomputeStats; items/sets.ts). Absent = none. Never saved. */
  sets?: Partial<Record<SetId, number>>;
  /** S17: walking speed factor from worn sets (1 = none); systems/movement.ts multiplies by it. Never saved. */
  gearSpeed?: number;
  /** S17: what the worn uniques give the hero's skills (items/uniques.ts grantsOf; heroes/grants.ts reads it). Never saved. */
  grants?: ItemGrant[];
}

export interface Enemy extends Fighter {
  kind: 'enemy';
  /** Drives the procedural look (enemies/assemble.ts). */
  seed: number;
  home: Vec;
  mode: 'wander' | 'chase';
  wanderTarget: Vec | null;
  /** Seconds until a new wander target is picked. */
  wanderTimer: number;
  /** The thesis in the speech bubble (combat/claims.ts); absent on a hero copy. */
  claim?: Claim;
  /** A copy of a hero left behind by the death outcome Petla (death/outcomes.ts). */
  copyOf?: { heroId: HeroId; level: number };
  /** What this enemy drops when killed in addition to ordinary loot (the copy drops one of your items). */
  drops?: Item;
  /** Enemy family (enemies/families.ts); copies and plain test enemies are Urzadzenia. */
  family: FamilyId;
  /** Powiadomienia: escalation tier 1..4. Others: revision 1.. (scales hp and damage). */
  tier: number;
  /** Elite affix (enemies/families.ts ELITES); the object form is what world/enemyInfo.ts expects. */
  elite?: { affix: EliteId };
  /** Urzadzenia: the factory defect printed in the footnote. */
  defect?: DefectId;
  /** Wygenerowane: existence coefficient e in [0.3, 1]; damage dealt and taken is multiplied by it. */
  existence?: number;
  /** Powiadomienia: seconds until the next tier. */
  escalateIn?: number;
  /** True for the family's boss (which boss: BOSS_OF[family]). */
  boss?: true;
  /** AI timers, defect and boss state (enemies/runtime.ts); read through rtOf(). */
  rt?: EnemyRt;
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
  /** How many more enemies it may pass through (0 or absent: stops at the first). */
  pierce?: number;
  /** Roll hit/crit with the owner's stats on impact instead of using `damage`. */
  roll?: boolean;
  /** Extra damage added per enemy already passed (Triangulacja). */
  bonusPerPass?: number;
  /** Gains one more pierce when its hit was a crit (Kartograf auto-attack). */
  pierceOnCrit?: boolean;
  /** Ids of enemies already hit. */
  passed?: number[];
}

export interface Pickup extends Base {
  kind: 'pickup';
  /** The item on the plate. Absent on a gwiazdki pickup. */
  item?: Item;
  /** A small five-pointed scribble worth this many gwiazdki (items/loot: systems/loot.ts). */
  gwiazdki?: number;
  /** The number printed on the plate and used in the footnote. */
  number: number;
  /** A permission card (a checkbox and the family word): taking it adds the family to player.permissions, never the inventory. */
  permission?: FamilyId;
  /** A potwierdzenie: a stamped slip that restores racja or is kept (systems/recovery.ts). */
  potwierdzenie?: true;
}

/** A friendly figure: a Petlowiec copy, a Kartograf decoy, or the 10-second friendly copy after Petla. */
export interface Summon extends Base {
  kind: 'summon';
  variant: 'copy' | 'decoy' | 'ghost' | 'moon';
  heroId: HeroId;
  facing: 1 | -1;
  moving: boolean;
  /** Seconds left to live. */
  ttl: number;
  damageType: DamageType;
  attackRange: number;
  attackCooldown: number;
  attackTimer: number;
  /** Damage as a fraction of the player's damage range (0 for a decoy). */
  damageMul: number;
  speed: number;
  /** Nalesnik's Ksiezyc (variant 'moon'): where it is on its circle round the player (`ring` is the circle's radius); `hits` is run time of the last strike per enemy id. */
  orbit?: { angle: number; r: number; ring?: number; hits?: Record<number, number> };
}

/** A marked patch of paper: Teren nieistniejacy, or an hourglass drawn over a blocked enemy. */
export interface Zone extends Base {
  kind: 'zone';
  variant: 'teren' | 'hourglass' | 'wniosek' | 'legenda' | 'start' | 'numer';
  /** Seconds left. */
  ttl: number;
  /** Id of the enemy the zone follows (hourglass). */
  follow?: number;
  /** Wniosek: ids of the enemies that have entered already (the entry effects fire once per entry). */
  inside?: number[];
  /** Numer: the case number printed on the stamp (it stays with the case when the number is handed over; `follow` is the enemy). */
  number?: number;
  /** Legenda: seconds gathered towards the next tick of damage. Order of the wrong names for the enemies entering, and which have. */
  acc?: number;
  order?: number[];
}

export type Entity = Player | Enemy | Projectile | Pickup | Summon | Zone;
export type EntityKind = Entity['kind'];
