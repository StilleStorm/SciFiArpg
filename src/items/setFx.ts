/**
 * The three-piece effects of the sets that are not a stat or a skill patch (ITEMS 4.1), and the one two-piece mechanic (Domniemanie).
 * Wired once by items/install.ts (`bindSetEffects`); `onSetHurt` is called by enemies/hooks.ts `onEnemyHurt`. Skill patches and the
 * Awaria hero rules read `Player.sets` directly (heroes/grants.ts, the quirks, death/outcomes.ts, items/reviews.ts).
 */
import { applyStatus } from '../combat/status';
import type { DamageType } from '../combat/damage';
import type { Bus } from '../core/events';
import { createRng } from '../core/rng';
import type { Enemy } from '../entities/types';
import { SLOTS } from './types';
import type { RunState } from '../world/run';
import { hasEffect, piecesOf, SET_BONUS_PIECES } from './sets';
import { recomputeStats } from './stats';

/** «Obieg»: a rebuttal of a regulaminowy claim also stamps the enemy zgłoszony this long. */
export const OBIEG_ZGLOSZONY_S = 2;
/** «Serwis»: the podstawowa's cooldown resets on a crit at most this often. */
export const SERWIS_RESET_EVERY_S = 2;
/** «Domniemanie»: the first egzystencjalny hit on an enemy makes it do weryfikacji this long. */
export const DOMNIEMANIE_VERIFY_S = 1;
/** «Domniemanie», two pieces: a Wygenerowane enemy's existence coefficient drops by this on its first hit (floor 0.3). */
export const DOMNIEMANIE_EXISTENCE = 0.1;
/** «Awaria»: the numbers of a worn piece are scaled by a factor within this of 1 on every page entry. */
export const AWARIA_SPREAD = 0.15;

const verified = new WeakSet<Enemy>();
const lowered = new WeakSet<Enemy>();

/** An enemy took a hit and lives: the Domniemanie effects. Called by enemies/hooks.ts onEnemyHurt. */
export function onSetHurt(s: RunState, e: Enemy, type: DamageType | undefined): void {
  const p = s.player;
  if (!p.sets) return;
  if (type === 'egzystencjalny' && hasEffect(p, 'do-weryfikacji-pierwsze') && !verified.has(e)) {
    verified.add(e);
    applyStatus(e, 'do_weryfikacji', DOMNIEMANIE_VERIFY_S, null);
  }
  if (e.existence !== undefined && piecesOf(p, 'domniemanie') >= SET_BONUS_PIECES[0] && !lowered.has(e)) {
    lowered.add(e);
    e.existence = Math.max(0.3, e.existence - DOMNIEMANIE_EXISTENCE);
  }
}

/** «Awaria», three pieces: re-roll the factor of every worn piece (seeded by ticket, page and piece). */
export function rerollAwaria(s: RunState): boolean {
  if (!hasEffect(s.player, 'regula-podwojona')) return false;
  let any = false;
  for (const slot of SLOTS) {
    const item = s.player.equipment[slot];
    if (!item || item.setId !== 'awaria') continue;
    const rng = createRng(s.seed).fork(`awaria:${s.pageIndex}:${item.uid}`);
    item.rollMul = 1 + rng.range(-AWARIA_SPREAD, AWARIA_SPREAD);
    any = true;
  }
  if (any) recomputeStats(s.player);
  return any;
}

/** Subscribe the event-driven effects. Call once; `getState` returns the current run. */
export function bindSetEffects(bus: Bus, getState: () => RunState | null): void {
  let critAt = -1;
  let resetAt = -99;
  bus.on('enemy:rebutted', (e) => {
    const s = getState();
    if (!s || !hasEffect(s.player, 'zgloszony-na-odparcie')) return;
    const enemy = s.enemies.find((x) => x.id === e.id);
    if (enemy?.claim?.type === 'regulaminowy') applyStatus(enemy, 'zgloszony', OBIEG_ZGLOSZONY_S, null);
  });
  // «Serwis»: a crit struck inside the cast of the podstawowa (the first skill) resets its cooldown, once per two seconds
  bus.on('enemy:hit', (e) => {
    const s = getState();
    if (s && e.crit) critAt = s.time;
  });
  bus.on('skill:cast', (e) => {
    const s = getState();
    if (!s || e.skill !== 0 || e.free || !hasEffect(s.player, 'krytyk-podstawowej')) return;
    if (critAt !== s.time || s.time - resetAt < SERWIS_RESET_EVERY_S) return;
    resetAt = s.time;
    s.hero.cd[0] = 0;
  });
  bus.on('page:entered', () => {
    const s = getState();
    if (s) rerollAwaria(s);
  });
}
