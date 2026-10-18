/**
 * What enemies change in combat: claims and rebuttals, existence, statuses on damage taken, defects that
 * react to a hit, elite teleport. Called from systems/combat.ts; pure state changes plus events.
 */
import { isRebuttal } from '../combat/claims';
import type { DamageType } from '../combat/damage';
import { applyStatus, getStatus, isSilenced, isStunned, statusDamageTakenMul } from '../combat/status';
import type { Bus } from '../core/events';
import type { Enemy, Player } from '../entities/types';
import { resolveMove } from '../world/pages';
import { sporMul } from '../combat/spor';
import type { RunState } from '../world/run';
import { rtOf } from './runtime';

type Fighter = Player | Enemy;

/** e in [0.3, 1] for Wygenerowane, 1 for everything else. */
export const existenceOf = (e: Enemy): number => e.existence ?? 1;

/** Damage an enemy deals: existence and the aura of a zweryfikowany elite. */
export function enemyOutgoing(e: Enemy, amount: number): number {
  return Math.max(1, Math.round(amount * existenceOf(e) * rtOf(e).dmgMult));
}

/**
 * Damage about to land: rebuttal crit (x2, bubble struck), the one "nie na temat" note, existence, zgloszony.
 * `type` is the damage type of the attack when known; without it there is no claim logic.
 */
export function modifyDamage(
  bus: Bus,
  defender: Fighter,
  amount: number,
  crit: boolean,
  type: DamageType | undefined,
  s?: Pick<RunState, 'spor'>,
): { amount: number; crit: boolean } {
  if (amount <= 0) return { amount, crit };
  let a = amount;
  let c = crit;
  if (defender.kind === 'enemy') {
    const claim = defender.claim;
    if (type !== undefined && claim) {
      if (isRebuttal(claim, type)) {
        if (!c) {
          a *= 2;
          c = true;
        }
        claim.struck = true;
        bus.emit('enemy:rebutted', { id: defender.id });
      } else if (claim.struck !== true) {
        const rt = rtOf(defender);
        if (!rt.offTopicShown) {
          rt.offTopicShown = true;
          bus.emit('enemy:offTopic', { id: defender.id, x: defender.x, y: defender.y });
        }
      }
    }
    if (s) a *= sporMul(s, defender.id); // the window of a won argument: x2 against that boss, on top of a rebuttal crit
    a *= existenceOf(defender);
  }
  a *= statusDamageTakenMul(defender);
  return { amount: Math.max(1, Math.round(a)), crit: c };
}

/** Move an enemy to a random spot 140-200 units away (elite domniemany). */
export function teleportEnemy(s: RunState, e: Enemy): void {
  const r = s.rngs.ai;
  for (let tries = 0; tries < 8; tries++) {
    const a = r.range(0, Math.PI * 2);
    const d = r.range(140, 200);
    const p = { x: e.x + Math.cos(a) * d, y: e.y + Math.sin(a) * d };
    const before = { x: p.x, y: p.y };
    resolveMove(s.page, p, e.r);
    if (Math.hypot(p.x - before.x, p.y - before.y) > 1) continue;
    e.x = p.x;
    e.y = p.y;
    return;
  }
}

/** An enemy took a hit and lives: defects and affixes react. */
export function onEnemyHurt(s: RunState, bus: Bus, e: Enemy, type: DamageType | undefined): void {
  void bus;
  const rt = rtOf(e);
  rt.asleep = false;
  if (e.defect === 'spins') {
    rt.spin = 0.55;
    rt.spinDir = s.rngs.ai.chance(0.5) ? 1 : -1;
    rt.fwWalk = 0.5;
    const a = s.rngs.ai.range(0, Math.PI * 2);
    rt.fwDir = { x: Math.cos(a), y: Math.sin(a) };
    e.attackTimer = Math.max(e.attackTimer, 0.45);
  }
  if (e.defect === 'thinks' && type === 'egzystencjalny') applyStatus(e, 'zablokowany', 1, null);
  if (e.defect === 'limp' && !rt.limped && e.hp <= e.hpMax / 2) rt.limped = true;
  if (e.elite?.affix === 'domniemany' && !rt.teleported && e.hp < e.hpMax / 2 && !isSilenced(e)) {
    rt.teleported = true;
    teleportEnemy(s, e);
  }
}

/** The existing melee loop asks this before an enemy may strike the player. */
export function canMelee(s: RunState, e: Enemy): boolean {
  const rt = rtOf(e);
  if (isStunned(e) || rt.asleep || rt.heatPhase === 'stall') return false;
  const taunt = getStatus(e, 'przeczytane');
  // taunted by somebody else: it has eyes only for the taunter
  return !(taunt && taunt.source !== null && taunt.source !== s.player.id);
}

/** Existence of an enemy can be pinned (hero skills: confirm the existence, set it to 0.3 inside a marked area). */
export function pinExistence(e: Enemy, value: number, seconds: number): void {
  if (e.existence === undefined) return;
  rtOf(e).ePin = { value, t: seconds };
  e.existence = value;
}
/** "Potwierdzic istnienie": e = 1 for 4 seconds. */
export const confirmExistence = (e: Enemy, seconds = 4): void => pinExistence(e, 1, seconds);
