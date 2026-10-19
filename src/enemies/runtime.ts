import type { Vec } from '../core/vec';
import type { RangedSpec } from './partsBase';
import type { DefectId, EliteId } from './ids';

/**
 * Per-enemy mutable state that only the enemy modules read (AI timers, defect and boss phases).
 * Lives on `Enemy.rt`; `rtOf(enemy)` creates it on first use so enemies built by other modules still work.
 */
export interface EnemyRt {
  /** Seconds alive. */
  age: number;
  /** Seconds of visual spin left (defect: spins). */
  spin: number;
  spinDir: 1 | -1;
  /** Defect: the leg already fell off. */
  limped: boolean;
  /** Defect overheat cycle: cool -> hot (fast attacks) -> stall. */
  heatPhase: 'cool' | 'hot' | 'stall';
  heatT: number;
  /** Defect firmware: seconds of random walking left, and its direction. */
  fwWalk: number;
  fwDir: Vec;
  fwT: number;
  /** Defect standby: asleep until someone comes close or hits it. */
  asleep: boolean;
  /** Seconds until an elite swaps its claim. */
  claimT: number;
  /** Elite domniemany: the one teleport was used. */
  teleported: boolean;
  /** Seconds until the next shot of a ranged enemy. */
  shootT: number;
  /** Resolved ranged weapon: undefined = not looked up yet, null = melee only. */
  ranged?: RangedSpec | null;
  /** Values before temporary modifiers. */
  baseSpeed: number;
  baseCooldown: number;
  baseDmg: { min: number; max: number };
  /** Multiplier on damage dealt from auras and phases. */
  dmgMult: number;
  /** Multiplier on attack speed (2 = twice as fast). */
  atkSpeed: number;
  /** The "nie na temat" note was shown. */
  offTopicShown: boolean;
  /** Existence: where e is drifting to, seconds until a new target, and a pinned value. */
  eTarget: number;
  eTimer: number;
  ePin: { value: number; t: number } | null;
  /** Seconds left of walking home after straying too far (leash). */
  leash: number;
  /** Speed factor from boss phases. */
  speedMul: number;
  /** Boss state. */
  phase: number;
  /** A one-off footnote of this enemy was shown. */
  noted: boolean;
  summonT: number;
  /** Prototyp: seconds until the next paper volley. */
  volleyT: number;
  /** Weryfikacja: captcha grid. cells are indices 0..8 of the hydrant squares; time is seconds stood on them. */
  grid?: { cells: [number, number]; time: number; cx: number; cy: number };
  /** Hipoteza: seconds the player has stood in the outline, and whether it is confirmed. */
  confirm: number;
  confirmed: boolean;
  /** Boss: run time at which the first Spor comment is posted (DESIGN 5.4); absent once posted. */
  sporAt?: number;
  /** Every elite affix this enemy carries (a named elite has 2-3; the first is `Enemy.elite.affix`). Empty for plain enemies. */
  affixes: EliteId[];
  /** Affixes borrowed from the pack leader while it lives (enemies/elites.ts SHARED_AFFIXES). */
  shared: EliteId[];
  /** Pack member: the id of the leader. Leader: `packSize` minions were placed with it. */
  packOf?: number;
  packSize?: number;
  /** A named elite: the recorded name (already translated). */
  named?: { name: string };
  /** Run time of the last hit taken (elite odnawialny heals after a quiet spell). */
  hurtAt: number;
}

export function newRt(): EnemyRt {
  return {
    age: 0,
    spin: 0,
    spinDir: 1,
    limped: false,
    heatPhase: 'cool',
    heatT: 0,
    fwWalk: 0,
    fwDir: { x: 0, y: 0 },
    fwT: 0,
    asleep: false,
    claimT: 8,
    teleported: false,
    shootT: 1,
    baseSpeed: 0,
    baseCooldown: 1,
    baseDmg: { min: 1, max: 1 },
    dmgMult: 1,
    atkSpeed: 1,
    offTopicShown: false,
    eTarget: 1,
    eTimer: 0,
    ePin: null,
    leash: 0,
    speedMul: 1,
    phase: 1,
    noted: false,
    summonT: 6,
    volleyT: 4,
    confirm: 0,
    confirmed: false,
    affixes: [],
    shared: [],
    hurtAt: -99,
  };
}

/** The runtime bag of an enemy, created lazily. */
export function rtOf(e: { rt?: EnemyRt }): EnemyRt {
  if (!e.rt) e.rt = newRt();
  return e.rt;
}

// ---------- which defects the player has learned (per run) ----------

const learned = new WeakMap<object, Set<DefectId>>();

/** The player hit an enemy with this defect: its footnote may now be shown (for heroes who do not see defects at once). */
export function learnDefect(run: object, defect: DefectId): void {
  let set = learned.get(run);
  if (!set) {
    set = new Set();
    learned.set(run, set);
  }
  set.add(defect);
}

export const defectLearned = (run: object, defect: DefectId): boolean => learned.get(run)?.has(defect) ?? false;
