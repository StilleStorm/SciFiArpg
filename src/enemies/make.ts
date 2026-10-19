/** Building an Enemy from a seed, a family and a tier. Pure data; the look comes from assemble(). */
import { createRng } from '../core/rng';
import { createEnemy } from '../entities/factory';
import type { Enemy } from '../entities/types';
import { assemble } from './assemble';
import {
  DEFECTS,
  DEFECT_VULN,
  ELITE_DMG_MUL,
  ELITE_HP_MUL,
  ESCALATE_S,
  FAMILY_DEFS,
  NIEUCHRONNY_HP_MUL,
  enemyScaleOf,
  pickClaim,
  scaleStats,
  tierStats,
  type EliteId,
  type FamilyId,
} from './families';
import { newRt } from './runtime';

export interface MakeOpts {
  tier?: number;
  elite?: EliteId;
}

/** Apply the numbers of (family, tier) to an enemy, keeping the hp fraction. Used at birth and on escalation. */
export function applyTierStats(e: Enemy, keepFraction: boolean): void {
  const st = scaleStats(tierStats(e.family, e.tier), enemyScaleOf(e));
  const def = FAMILY_DEFS[e.family];
  const asm = assemble(e.seed, e.family, e.tier);
  const elite = e.elite?.affix;
  const hpMul = elite ? ELITE_HP_MUL * (elite === 'nieuchronny' ? NIEUCHRONNY_HP_MUL : 1) : 1;
  const dmgMul = elite ? ELITE_DMG_MUL : 1;
  const frac = keepFraction ? e.hp / Math.max(1, e.hpMax) : 1;
  const jitter = 0.92 + (createRng(e.seed).fork('speed').next() * 0.16);
  const resist = { ...def.resist };
  if (e.defect) {
    const v = DEFECTS[e.defect].vuln;
    resist[v] = (resist[v] ?? 0) - DEFECT_VULN;
  }
  e.hpMax = Math.max(1, Math.round(st.hp * hpMul));
  e.hp = Math.max(1, Math.round(e.hpMax * frac));
  e.speed = st.speed * jitter;
  e.r = Math.round(asm.radius * (elite ? 1.1 : 1));
  e.damageType = def.damageType;
  e.stats = {
    pewnoscSiebie: st.pewnoscSiebie,
    upor: st.upor,
    dmgMin: Math.max(1, Math.round(st.dmgMin * dmgMul)),
    dmgMax: Math.max(1, Math.round(st.dmgMax * dmgMul)),
    critChance: st.critChance,
    resist,
  };
  e.attackRange = asm.ranged ? 18 : st.attackRange;
  e.attackCooldown = st.attackCooldown;
  const rt = (e.rt ??= newRt());
  rt.baseSpeed = e.speed;
  rt.baseCooldown = e.attackCooldown;
  rt.baseDmg = { min: e.stats.dmgMin, max: e.stats.dmgMax };
}

export function makeEnemy(id: number, x: number, y: number, seed: number, family: FamilyId, opts: MakeOpts = {}): Enemy {
  const asm = assemble(seed, family, opts.tier ?? 1);
  const e = createEnemy(id, x, y, seed);
  e.family = family;
  e.tier = asm.tier;
  if (opts.elite) e.elite = { affix: opts.elite };
  if (asm.defect) e.defect = asm.defect;
  e.rt = newRt();
  applyTierStats(e, false);
  e.attackTimer = 0.6;
  e.claim = pickClaim(createRng(seed).fork('claim'), family, e.tier);
  e.facing = seed % 2 === 0 ? 1 : -1;
  const rt = e.rt;
  if (family === 'wygenerowane') {
    e.existence = createRng(seed).fork('e').range(0.45, 1);
    rt.eTarget = e.existence;
    rt.eTimer = createRng(seed).fork('et').range(1, 3);
  }
  if (family === 'powiadomienia' && e.tier < 4) e.escalateIn = ESCALATE_S;
  rt.asleep = e.defect === 'standby';
  rt.shootT = 1 + createRng(seed).fork('shoot').range(0, 1.5);
  rt.claimT = 8;
  return e;
}
