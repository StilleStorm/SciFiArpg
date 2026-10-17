import type { Rng } from '../core/rng';
import { clamp } from '../core/vec';

export type DamageType = 'mechaniczny' | 'regulaminowy' | 'egzystencjalny';
export const DAMAGE_TYPES: readonly DamageType[] = ['mechaniczny', 'regulaminowy', 'egzystencjalny'];

export const RESIST_CAP = 75;
export const RESIST_FLOOR = -100;
export const CRIT_MULTIPLIER = 2;
export const HIT_MIN = 0.05;
export const HIT_MAX = 0.95;

/** Combat numbers every fighter carries. Resist is percent; negative = weakness. */
export interface Stats {
  /** Attack rating ("pewnosc siebie"). */
  pewnoscSiebie: number;
  /** Defense rating ("upor"). */
  upor: number;
  dmgMin: number;
  dmgMax: number;
  /** 0..1 */
  critChance: number;
  resist: Partial<Record<DamageType, number>>;
}

export type Attacker = Pick<Stats, 'pewnoscSiebie' | 'dmgMin' | 'dmgMax' | 'critChance'>;
export type Defender = Pick<Stats, 'upor' | 'resist'>;

export interface DamageResult {
  hit: boolean;
  crit: boolean;
  /** Final integer damage; 0 on a miss. */
  amount: number;
  type: DamageType;
}

/** Diablo-2 flavored: 2 * A / (A + D), clamped to 5..95 percent. */
export function hitChance(pewnoscSiebie: number, upor: number): number {
  const sum = pewnoscSiebie + upor;
  if (sum <= 0) return HIT_MAX;
  return clamp((2 * pewnoscSiebie) / sum, HIT_MIN, HIT_MAX);
}

export function effectiveResist(defender: Defender, type: DamageType): number {
  return clamp(defender.resist[type] ?? 0, RESIST_FLOOR, RESIST_CAP);
}

/**
 * The one damage formula. Rolls, in order: hit, crit, damage range.
 * Crit doubles damage before resist; a landed hit always deals at least 1.
 */
export function rollDamage(attacker: Attacker, defender: Defender, type: DamageType, rng: Rng): DamageResult {
  const hit = rng.next() < hitChance(attacker.pewnoscSiebie, defender.upor);
  const crit = rng.next() < attacker.critChance;
  const raw = rng.range(attacker.dmgMin, attacker.dmgMax + 1);
  if (!hit) return { hit: false, crit: false, amount: 0, type };
  const scaled = Math.floor(raw) * (crit ? CRIT_MULTIPLIER : 1);
  const amount = Math.max(1, Math.round(scaled * (1 - effectiveResist(defender, type) / 100)));
  return { hit: true, crit, amount, type };
}
