/**
 * What Pralka's later skills leave running (S19): Program 90's zone, Tryb oszczędny's resist, Odpompowanie's puddle, and the
 * bookkeeping of her passives 9 and 10 and of her second ultimate. The state is a plain record per run in a WeakMap keyed by
 * `HeroRun` (never saved, never part of the contract digest); `tickPralka` is called every step from her quirk (heroes/quirks.ts
 * `tickRound`), after the ordinary per-step code of heroes/system.ts.
 */
import { DAMAGE_TYPES } from '../../combat/damage';
import type { Bus } from '../../core/events';
import { t } from '../../i18n';
import { recomputeStats } from '../../items/stats';
import type { RunState } from '../../world/run';
import { heroDef } from '../defs';
import { enemiesWithin, power, skillDamage, touchStatus } from '../helpers';
import { effectiveSkill } from '../loadout';
import { TICK_S } from '../numbers';
import { fx, pull, shield } from '../primitives';
import type { HeroRun } from '../state';
import {
  BEBEN_CAP,
  BEBEN_STEP,
  ECO_SLOW,
  GWARANCJA_BELOW,
  GWARANCJA_S,
  GWARANCJA_SHIELD,
  PROGRAM_LEAVE,
  PROGRAM_DAMAGE,
  PROGRAM_SLOW,
  PUDDLE_DAMAGE,
  PUDDLE_PULL,
  PUDDLE_SLIDE,
} from './numbers';

/** The ultimate whose upor and stillness the janitor in `tickPralka` takes back when it is gone. */
export const UZNANIE_ID = 'uznanieOsobowosci';

export interface Program {
  x: number;
  y: number;
  r: number;
  until: number;
  acc: number;
  page: number;
  /** Ids of the enemies inside at the last step (§ 3 strikes the ones that left). */
  inside: number[];
  /** § 3: leaving costs the enemy a blow. */
  leave: boolean;
  /** Her speed is cut while it runs (§ 2 does not). */
  slow: boolean;
  /** The Bęben pełny share taken at the cast. */
  bonus: number;
}

export interface Eco {
  until: number;
  /** Resist added to every damage type, to be taken back. */
  resist: number;
  slow: boolean;
  /** § 3: no status holds her. */
  immune: boolean;
  next: number;
}

export interface Puddle {
  x: number;
  y: number;
  r: number;
  until: number;
  page: number;
  acc: number;
  fxAt: number;
  /** § 2: damage per second inside. § 3: pulls to the centre. */
  strikes: boolean;
  pulls: boolean;
}

export interface PralkaRun {
  program: Program | null;
  eco: Eco | null;
  puddle: Puddle | null;
  /** Płukanie casts so far (§ 3: every third makes Wirowanie ready). */
  rinses: number;
  /** The page index of the last Gwarancja shield. */
  guaranteePage: number;
  /** Bęben pełny: the share waiting for her next offensive skill. */
  bonus: number;
  /** Run time of the previous tick. */
  last: number;
  /** `p.speed` is held at the slowed value. */
  speedHeld: boolean;
  /** Uznanie osobowości: the upor added, and whether she may not move (§ 3). */
  ultUpor: number;
  still: boolean;
}

const runs = new WeakMap<HeroRun, PralkaRun>();

/** The record of this run's Pralka, made on first use. */
export function runOf(s: RunState): PralkaRun {
  let r = runs.get(s.hero);
  if (!r) {
    r = { program: null, eco: null, puddle: null, rinses: 0, guaranteePage: -1, bonus: 0, last: s.time, speedHeld: false, ultUpor: 0, still: false };
    runs.set(s.hero, r);
  }
  return r;
}

const taken = (s: RunState, id: string): boolean => (s.hero.upgrades[id] ?? 0) > 0;
/** Passive 8, Wersja 1.1: the rule fires on a shorter count. */
export const hasWersja = (s: RunState): boolean => taken(s, 'passive8');

// ---------- Bęben pełny (passive 10) ----------

/** Wirowanie pulled `n` enemies: each adds a share to her next offensive skill, up to the cap. */
export function addBonus(s: RunState, n: number): void {
  if (!taken(s, 'passive10') || n <= 0) return;
  const r = runOf(s);
  r.bonus = Math.min(BEBEN_CAP, r.bonus + BEBEN_STEP * n);
}

/** The factor an offensive skill takes with it now (1 + the waiting share); the share is spent. */
export function takeBonus(s: RunState): number {
  const r = runOf(s);
  const m = 1 + r.bonus;
  r.bonus = 0;
  return m;
}

// ---------- speed and resist ----------

function syncSpeed(s: RunState, r: PralkaRun): void {
  const slow = (r.program?.slow ? PROGRAM_SLOW : 1) * (r.eco?.slow ? ECO_SLOW : 1) * (r.still ? 0 : 1);
  if (slow === 1 && !r.speedHeld) return;
  const p = s.player;
  p.speed = heroDef(p.heroId).speed * s.hero.mods.speed * slow;
  r.speedHeld = slow !== 1;
}

/** Add `amount` of resist to every damage type of her base stats (a negative amount takes it back). */
function shiftResist(s: RunState, amount: number): void {
  const p = s.player;
  for (const type of DAMAGE_TYPES) p.baseStats.stats.resist[type] = (p.baseStats.stats.resist[type] ?? 0) + amount;
  recomputeStats(p);
}

// ---------- starts (called by the casts) ----------

export function startEco(s: RunState, e: Omit<Eco, 'next'>): void {
  const r = runOf(s);
  if (r.eco) shiftResist(s, -r.eco.resist);
  shiftResist(s, e.resist);
  r.eco = { ...e, next: s.time };
}

function endEco(s: RunState, r: PralkaRun): void {
  if (!r.eco) return;
  shiftResist(s, -r.eco.resist);
  r.eco = null;
}

// ---------- per step ----------

function stepProgram(s: RunState, bus: Bus, r: PralkaRun, dt: number): void {
  const pr = r.program;
  if (!pr) return;
  if (s.time >= pr.until || s.pageIndex !== pr.page) {
    r.program = null;
    return;
  }
  const type = effectiveSkill(s, 6).type;
  const here = enemiesWithin(s, pr.x, pr.y, pr.r);
  if (pr.leave) {
    for (const id of pr.inside) {
      const e = s.enemies.find((x) => x.id === id);
      if (e && !here.includes(e)) skillDamage(s, bus, e, type, PROGRAM_LEAVE * power(s, 6) * pr.bonus);
    }
  }
  pr.inside = here.map((e) => e.id);
  pr.acc += dt;
  if (pr.acc < TICK_S) return;
  pr.acc -= TICK_S;
  for (const e of here) skillDamage(s, bus, e, type, PROGRAM_DAMAGE * TICK_S * power(s, 6) * pr.bonus);
  if (Math.floor(s.time) !== Math.floor(s.time - TICK_S)) fx({ s, bus }, 'steam', pr.x, pr.y, pr.r);
}

function stepEco(s: RunState, bus: Bus, r: PralkaRun): void {
  const eco = r.eco;
  if (!eco) return;
  if (s.time >= eco.until) {
    endEco(s, r);
    return;
  }
  if (eco.immune) s.player.statuses.length = 0;
  if (s.time >= eco.next) {
    eco.next = s.time + 1;
    fx({ s, bus }, 'ring', s.player.x, s.player.y, s.player.r + 16); // the dotted frame
  }
}

function stepPuddle(s: RunState, bus: Bus, r: PralkaRun, dt: number): void {
  const pd = r.puddle;
  if (!pd) return;
  if (s.time >= pd.until || s.pageIndex !== pd.page) {
    r.puddle = null;
    return;
  }
  const c = { s, bus };
  const p = s.player;
  for (const e of enemiesWithin(s, pd.x, pd.y, pd.r)) {
    touchStatus(e, 'do_weryfikacji', 0.6, p.id);
    if (pd.pulls && !e.boss) pull(c, e, pd, PUDDLE_PULL * s.law.knockbackMul * dt, e.r + 4);
  }
  // loot slides out to the rim
  for (const k of s.pickups) {
    const d = Math.hypot(k.x - pd.x, k.y - pd.y);
    if (d >= pd.r - 3) continue;
    const away = Math.min(PUDDLE_SLIDE * dt, pd.r - 3 - d);
    const ux = d < 0.001 ? 1 : (k.x - pd.x) / d;
    const uy = d < 0.001 ? 0 : (k.y - pd.y) / d;
    k.x += ux * away;
    k.y += uy * away;
  }
  if (pd.strikes) {
    pd.acc += dt;
    if (pd.acc >= TICK_S) {
      pd.acc -= TICK_S;
      const type = effectiveSkill(s, 9).type;
      for (const e of enemiesWithin(s, pd.x, pd.y, pd.r)) skillDamage(s, bus, e, type, PUDDLE_DAMAGE * TICK_S * power(s, 9));
    }
  }
  if (s.time >= pd.fxAt) {
    pd.fxAt = s.time + 1.2;
    fx(c, 'puddle', pd.x, pd.y, pd.r);
  }
}

/** Passive 9, Gwarancja: below a fifth of racja, once a page, a foam shield. */
function stepGwarancja(s: RunState, bus: Bus, r: PralkaRun): void {
  const p = s.player;
  if (!taken(s, 'passive9') || r.guaranteePage === s.pageIndex || p.hp <= 0 || p.hp >= p.hpMax * GWARANCJA_BELOW) return;
  r.guaranteePage = s.pageIndex;
  const c = { s, bus };
  shield(c, GWARANCJA_SHIELD, GWARANCJA_S);
  fx(c, 'foam', p.x, p.y, 44);
  bus.emit('footnote', { text: t('heroes.pralka.gwarancjaNote') });
}

/** Take back what the second ultimate laid on her when it is no longer running (it ended, or the loadout changed under it). */
function stepUznanie(s: RunState, r: PralkaRun): void {
  if (r.ultUpor === 0 && !r.still) return;
  if (s.hero.ult?.active.some((u) => u.id === UZNANIE_ID)) return;
  releaseUznanie(s, r);
}

/** Give back the upor and let her move again. */
export function releaseUznanie(s: RunState, r: PralkaRun = runOf(s)): void {
  if (r.ultUpor !== 0) {
    s.player.baseStats.stats.upor -= r.ultUpor;
    r.ultUpor = 0;
    recomputeStats(s.player);
  }
  r.still = false;
  syncSpeed(s, r);
}

/** Every step of a run, from her quirk: the running effects, then her speed. */
export function tickPralka(s: RunState, bus: Bus): void {
  if (s.phase !== 'run') return;
  const r = runOf(s);
  const dt = Math.max(0, Math.min(0.1, s.time - r.last));
  r.last = s.time;
  stepProgram(s, bus, r, dt);
  stepEco(s, bus, r);
  stepPuddle(s, bus, r, dt);
  stepGwarancja(s, bus, r);
  stepUznanie(s, r);
  syncSpeed(s, r);
}
