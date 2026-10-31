/**
 * Bosses, one per family, with a simple phase model (DESIGN 6).
 * Prototyp: every part; at half racja it drops a leg and speeds up.
 * Weryfikacja: stands still, summons Przypomnienia every 6 s; standing on its two hydrant squares for 2 s in
 * total blocks it for 3 s. The grid is a 3x3 of hatched squares drawn around it (render/enemyFigures.ts).
 * Ankieta (planet 6, STORY 8.10): walks; every 8 s a row of five star squares is drawn between it and the player (render/enemyFigures.ts);
 * 1.5 s on the 1-star square files a complaint (it is blocked 3 s), 1.5 s on the 5-star square thanks it (it heals 10%, the row goes);
 * a row left 6 s summons two Przypomnienia and draws the next. At half racja the row is drawn round the player every 6 s.
 * Hipoteza: e = 0.3 until the player stands inside its outline for 3 s; then e = 1 and attacks come 1.5x faster.
 */
import { SPOR_FIRST_S, postSpor } from '../combat/spor';
import { applyStatus, isSilenced, isStunned } from '../combat/status';
import type { Bus } from '../core/events';
import type { Enemy } from '../entities/types';
import { t } from '../i18n';
import { planetDef } from '../world/campaign';
import { resolveMove } from '../world/pages';
import { nextId, type RunState } from '../world/run';
import { assembleBoss } from './assemble';
import { bossBodyOf, setBossBody } from './bossBody';
import { BOSS_FAMILY, BOSS_OF, FAMILY_DEFS, FAMILY_IDS, type BossId, type FamilyId } from './families';
import { makeEnemy } from './make';
import { newRt, rtOf, type Survey } from './runtime';
import { placeEnemy } from './spawn';
import { tickAnomalia } from './anomalia/core';

/** Seconds on the hydrant squares needed to block Weryfikacja, and how long the block lasts. */
export const GRID_NEED_S = 2;
export const GRID_BLOCK_S = 3;
export const GRID_CELL = 52;
/** Hipoteza: radius of the drawn outline, and seconds inside it to confirm it. */
export const CONFIRM_R = 72;
export const CONFIRM_NEED_S = 3;
export const SUMMON_EVERY_S = 6;
const SUMMON_CAP = 6;
export const BOSS_HIPOTEZA_E = 0.3;

interface BossDef {
  hp: number;
  speed: number;
  dmgMin: number;
  dmgMax: number;
  pewnoscSiebie: number;
  upor: number;
  attackRange: number;
  attackCooldown: number;
  /** The claim: its type is the family's weakness, so the clean play opens with a rebuttal. */
  claimType: 'mechaniczny' | 'regulaminowy' | 'egzystencjalny';
}

export const BOSSES: Record<BossId, BossDef> = {
  prototyp: { hp: 300, speed: 50, dmgMin: 5, dmgMax: 8, pewnoscSiebie: 80, upor: 50, attackRange: 44, attackCooldown: 1.5, claimType: 'egzystencjalny' },
  weryfikacja: { hp: 220, speed: 0, dmgMin: 3, dmgMax: 5, pewnoscSiebie: 70, upor: 40, attackRange: 40, attackCooldown: 1.4, claimType: 'regulaminowy' },
  hipoteza: { hp: 260, speed: 46, dmgMin: 6, dmgMax: 9, pewnoscSiebie: 80, upor: 40, attackRange: 42, attackCooldown: 1.3, claimType: 'mechaniczny' },
  ankieta: { hp: 300, speed: 30, dmgMin: 4, dmgMax: 7, pewnoscSiebie: 75, upor: 45, attackRange: 44, attackCooldown: 1.4, claimType: 'regulaminowy' },
};

/** Ankieta (STORY 8.10): the row of five squares, its timings. */
export const SURVEY_CELLS = 5;
export const SURVEY_FIRST_S = 4;
export const SURVEY_EVERY_S = 8;
export const SURVEY_EVERY_S2 = 6;
export const SURVEY_NEED_S = 1.5;
export const SURVEY_BLOCK_S = 3;
export const SURVEY_REMIND_S = 6;
export const SURVEY_HEAL = 0.1;

/**
 * A planet's variant of its family boss (STORY 4, 8.0): a line printed under the boss's name and one data change (racja here).
 * A planet module registers it (`world/planets/p1.ts`); the Spor comments of the variant are `combat/spor.ts`.
 */
export interface BossVariant {
  boss: BossId;
  /** i18n key of the line under the name. */
  lineKey: string;
  /** The racja the variant has instead of `BOSSES[boss].hp`. */
  hp: number;
  /** The reach of its blows instead of `BOSSES[boss].attackRange` (planet 3: 60, an arm with a stapler). */
  attackRange?: number;
  /** The one part drawn on the variant (render/enemyFigures.ts); the body stays. */
  arm?: 'stapler';
  /** The one part drawn on a Weryfikacja's variant: the hydrants of the grid squares as shopping carts (planet 5). */
  grid?: 'koszyk';
  /** i18n key of the captcha hint instead of `enemies.boss.weryfikacja.hint` (planet 5); the solved line stays the family's. */
  hintKey?: string;
}

const VARIANTS = new Map<number, BossVariant>();
const variantLines = new WeakMap<object, string>();
const variantArms = new WeakMap<object, 'stapler'>();
const variantGrids = new WeakMap<object, 'koszyk'>();
const variantHints = new WeakMap<object, string>();

/** Register the boss variant of a planet (0-based index). */
export function registerBossVariant(planet: number, v: BossVariant): void {
  VARIANTS.set(planet, v);
}

/** The variant a planet gives its boss, if one is registered. */
export const bossVariantOf = (planet: number | undefined): BossVariant | undefined => (planet === undefined ? undefined : VARIANTS.get(planet));

/** The key of the variant line under this boss's name, or undefined for a plain family boss. */
export const bossVariantLine = (e: object): string | undefined => variantLines.get(e);

/** The extra arm drawn on this boss's variant, if its variant has one. */
export const bossVariantArm = (e: object): 'stapler' | undefined => variantArms.get(e);

/** The look of the grid squares on this Weryfikacja's variant ('koszyk': shopping carts), if its variant has one. */
export const bossVariantGrid = (e: object): 'koszyk' | undefined => variantGrids.get(e);

/** The key of the captcha hint of this boss: its variant's override, else the family's. */
export const bossHintKey = (e: object): string => variantHints.get(e) ?? 'enemies.boss.weryfikacja.hint';

export { bossBodyOf };

export const bossIdOf = (e: Enemy): BossId | null => (e.boss ? bossBodyOf(e, e.family) : null);

/** Which body a boss of `family` has on `planet`: the record's `boss` when it belongs to the family, else `BOSS_OF[family]`. */
export function bossBodyFor(family: FamilyId, planet?: number): BossId {
  const named = planet === undefined ? undefined : planetDef(planet).boss;
  return named && BOSS_FAMILY[named] === family ? named : BOSS_OF[family];
}

/** World position of the center of survey square `i` (0 = one star .. 4 = five stars) of a row at (cx, cy). */
export const surveyCellCenter = (cx: number, cy: number, i: number): { x: number; y: number } => ({ x: cx + (i - (SURVEY_CELLS - 1) / 2) * GRID_CELL, y: cy });

/** The square (0..4) of the row at (cx, cy) that (x, y) stands on, or -1. */
export function surveyCellAt(cx: number, cy: number, x: number, y: number): number {
  for (let i = 0; i < SURVEY_CELLS; i++) {
    const p = surveyCellCenter(cx, cy, i);
    if (Math.abs(x - p.x) < GRID_CELL / 2 && Math.abs(y - p.y) < GRID_CELL / 2) return i;
  }
  return -1;
}

/** World position of the center of grid cell `i` (0..8, row-major) of a Weryfikacja. */
export function gridCellCenter(cx: number, cy: number, i: number): { x: number; y: number } {
  return { x: cx + ((i % 3) - 1) * GRID_CELL, y: cy + (Math.floor(i / 3) - 1) * GRID_CELL };
}

/** Is (x, y) on one of the two hydrant squares? */
export function onHydrant(grid: { cells: [number, number]; cx: number; cy: number }, x: number, y: number): boolean {
  return grid.cells.some((c) => {
    const p = gridCellCenter(grid.cx, grid.cy, c);
    return Math.abs(x - p.x) < GRID_CELL / 2 && Math.abs(y - p.y) < GRID_CELL / 2;
  });
}

/** Turn a freshly made enemy into the family's boss. */
export function makeBoss(id: number, x: number, y: number, seed: number, family: FamilyId, spawnRng: { int(a: number, b: number): number }, planet?: number): Enemy {
  const boss = bossBodyFor(family, planet);
  const def = BOSSES[boss];
  const e = makeEnemy(id, x, y, seed, family);
  setBossBody(e, boss);
  const asm = assembleBoss(boss, seed);
  e.boss = true;
  e.elite = undefined;
  e.defect = undefined;
  e.escalateIn = undefined;
  e.r = asm.radius;
  const variant = bossVariantOf(planet);
  const mine = variant && variant.boss === boss ? variant : undefined;
  e.hp = e.hpMax = mine ? mine.hp : def.hp;
  if (mine) variantLines.set(e, mine.lineKey);
  if (mine?.arm) variantArms.set(e, mine.arm);
  if (mine?.grid) variantGrids.set(e, mine.grid);
  if (mine?.hintKey) variantHints.set(e, mine.hintKey);
  e.speed = def.speed;
  e.attackRange = mine?.attackRange ?? def.attackRange;
  e.attackCooldown = def.attackCooldown;
  e.attackTimer = 1;
  e.damageType = FAMILY_DEFS[family].damageType;
  e.stats = { ...e.stats, pewnoscSiebie: def.pewnoscSiebie, upor: def.upor, dmgMin: def.dmgMin, dmgMax: def.dmgMax, critChance: 0.08 };
  e.claim = { textKey: `enemies.claim.boss.${boss}`, type: def.claimType };
  e.tier = asm.tier;
  const rt = (e.rt = newRt());
  rt.baseSpeed = def.speed;
  rt.baseCooldown = def.attackCooldown;
  rt.baseDmg = { min: def.dmgMin, max: def.dmgMax };
  rt.shootT = 2;
  rt.volleyT = 3;
  rt.summonT = SUMMON_EVERY_S;
  if (boss === 'hipoteza') {
    e.existence = BOSS_HIPOTEZA_E;
    rt.eTarget = BOSS_HIPOTEZA_E;
  } else e.existence = undefined;
  if (boss === 'weryfikacja') {
    const cells = [0, 1, 2, 3, 5, 6, 7, 8];
    const a = cells.splice(spawnRng.int(0, cells.length - 1), 1)[0] ?? 0;
    const b = cells[spawnRng.int(0, cells.length - 1)] ?? 8;
    rt.grid = { cells: [a, b], time: 0, cx: x, cy: y };
  }
  if (boss === 'ankieta') rt.survey = { on: false, cx: x, cy: y, wait: SURVEY_FIRST_S, age: 0, stand: 0, at: -1 };
  return e;
}

/** Put a boss at (x, y) without any placement checks (tests, screenshots). */
export function placeBoss(s: RunState, family: FamilyId, x: number, y: number): Enemy {
  const e = makeBoss(nextId(s), x, y, s.rngs.spawn.int(1, 1e6), family, s.rngs.spawn, s.plan?.planet);
  rtOf(e).sporAt = s.time + SPOR_FIRST_S;
  s.enemies.push(e);
  return e;
}

/** Put the family's boss on the page, far from the player. B4 calls this on the last page. */
export function spawnBoss(s: RunState, family: FamilyId | string): Enemy | null {
  const fam = FAMILY_IDS.find((f) => f === family);
  if (!fam) return null;
  const r = s.rngs.spawn;
  // a roomy spot first; a page whose aisles are narrow (archiwum, serwerownia) gets two tighter passes before the boss is given up
  for (const pad of [80, 45, 15]) {
    for (let tries = 0; tries < 60; tries++) {
      const x = r.range(260, s.page.w - 260);
      const y = r.range(260, s.page.h * 0.6);
      if (Math.hypot(x - s.player.x, y - s.player.y) < 420) continue;
      const e = makeBoss(nextId(s), x, y, r.int(1, 1e6), fam, r, s.plan?.planet);
      const before = { x: e.x, y: e.y };
      resolveMove(s.page, e, e.r + pad);
      if (Math.hypot(e.x - before.x, e.y - before.y) > 1) continue;
      e.home = { x, y };
      rtOf(e).sporAt = s.time + SPOR_FIRST_S;
      s.enemies.push(e);
      return e;
    }
  }
  return null;
}

/** Two Przypomnienia round the boss (cap 6 alive): Weryfikacja's summon, and Ankieta's reminder. */
function summonReminders(s: RunState, e: Enemy): void {
  const alive = s.enemies.filter((o) => o.family === 'powiadomienia' && !o.boss).length;
  for (let i = 0; i < 2 && alive + i < SUMMON_CAP; i++) {
    const a = s.rngs.spawn.range(0, Math.PI * 2);
    placeEnemy(s, 'powiadomienia', e.x + Math.cos(a) * (e.r + 40), e.y + Math.sin(a) * (e.r + 40), { tier: 1 });
  }
}

/** Draw the next survey row: between the boss and the player (phase 1), or round the player (phase 2, the survey is obligatory). */
function sendSurvey(s: RunState, e: Enemy, sv: Survey): void {
  const p = s.player;
  let cx = p.x;
  let cy = p.y;
  if (rtOf(e).phase < 2) {
    const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
    const t0 = Math.min(210, Math.max(135, d * 0.5));
    cx = e.x + ((p.x - e.x) / d) * t0;
    cy = e.y + ((p.y - e.y) / d) * t0;
  }
  const half = (SURVEY_CELLS * GRID_CELL) / 2 + 12;
  sv.cx = Math.min(s.page.w - half, Math.max(half, cx));
  sv.cy = Math.min(s.page.h - 60, Math.max(60, cy));
  sv.on = true;
  sv.age = 0;
  sv.stand = 0;
  sv.at = -1;
}

/** Ankieta's per-step logic: the row's timers, the two squares that count, the reminder, the half-racja phase. */
function tickSurvey(s: RunState, e: Enemy, bus: Bus, dt: number): void {
  const rt = rtOf(e);
  const sv = rt.survey;
  if (!sv) return;
  const p = s.player;
  if (rt.phase === 1 && e.hp <= e.hpMax / 2) {
    rt.phase = 2;
    bus.emit('footnote', { text: t('enemies.boss.ankieta.half') });
    bus.emit('boss:phase', { id: e.id, family: e.family, x: e.x, y: e.y });
    postSpor(s, bus, e, 2);
    sv.wait = Math.min(sv.wait, SURVEY_EVERY_S2);
  }
  if (!sv.on) {
    sv.wait -= dt;
    if (sv.wait > 0) return;
    sendSurvey(s, e, sv);
    if (!rt.noted) {
      rt.noted = true;
      bus.emit('footnote', { text: t('enemies.boss.ankieta.hint') });
    }
    return;
  }
  sv.age += dt;
  const at = p.suspended ? -1 : surveyCellAt(sv.cx, sv.cy, p.x, p.y);
  const counts = at === 0 || at === SURVEY_CELLS - 1;
  if (counts && at === sv.at) sv.stand += dt;
  else sv.stand = counts ? 0 : Math.max(0, sv.stand - dt * 0.5);
  sv.at = at;
  const every = rt.phase >= 2 ? SURVEY_EVERY_S2 : SURVEY_EVERY_S;
  if (counts && sv.stand >= SURVEY_NEED_S) {
    sv.on = false;
    sv.wait = every;
    sv.stand = 0;
    if (at === 0) {
      applyStatus(e, 'zablokowany', SURVEY_BLOCK_S, p.id);
      bus.emit('footnote', { text: t('enemies.boss.ankieta.filed') });
    } else {
      e.hp = Math.min(e.hpMax, e.hp + e.hpMax * SURVEY_HEAL);
      bus.emit('footnote', { text: t('enemies.boss.ankieta.thanked') });
    }
    bus.emit('boss:phase', { id: e.id, family: e.family, x: e.x, y: e.y });
    return;
  }
  if (sv.age >= SURVEY_REMIND_S) {
    bus.emit('footnote', { text: t('enemies.boss.ankieta.reminder') });
    if (!isSilenced(e) && !s.law.botTime) summonReminders(s, e);
    sendSurvey(s, e, sv);
  }
}

/** Per step for a boss (called from the enemy AI, before it moves). */
export function tickBoss(s: RunState, e: Enemy, bus: Bus, dt: number): void {
  if (!tickAnomalia(s, e, bus, dt)) return; // the Anomalia of the finale (enemies/anomalia/core.ts) runs its own phases; its first-phase forms go on below
  const rt = rtOf(e);
  const p = s.player;
  const boss = bossBodyOf(e, e.family);
  // the first comment (DESIGN 5.4): 1.5 s after the boss is on the page, even if it is stunned
  if (rt.sporAt !== undefined && s.time >= rt.sporAt) {
    rt.sporAt = undefined;
    postSpor(s, bus, e, 1);
  }
  if (isStunned(e)) return;
  if (boss === 'prototyp') {
    if (rt.phase === 1 && e.hp <= e.hpMax / 2) {
      rt.phase = 2;
      rt.speedMul = 1.45;
      bus.emit('footnote', { text: t('enemies.boss.prototyp.half') });
      bus.emit('boss:phase', { id: e.id, family: e.family, x: e.x, y: e.y });
      postSpor(s, bus, e, 2);
    }
  } else if (boss === 'weryfikacja') {
    const g = rt.grid;
    if (!rt.noted && Math.hypot(p.x - e.x, p.y - e.y) < 460) {
      rt.noted = true;
      bus.emit('footnote', { text: t(bossHintKey(e)) });
    }
    if (g && !p.suspended && onHydrant(g, p.x, p.y)) {
      g.time += dt;
      if (g.time >= GRID_NEED_S) {
        g.time = 0;
        applyStatus(e, 'zablokowany', GRID_BLOCK_S, p.id);
        bus.emit('footnote', { text: t('enemies.boss.weryfikacja.solved') });
        bus.emit('boss:phase', { id: e.id, family: e.family, x: e.x, y: e.y });
        postSpor(s, bus, e, 2);
      }
    }
    if (!isSilenced(e) && !s.law.botTime) {
      rt.summonT -= dt;
      if (rt.summonT <= 0) {
        rt.summonT = SUMMON_EVERY_S;
        summonReminders(s, e);
      }
    }
  } else if (boss === 'ankieta') {
    tickSurvey(s, e, bus, dt);
  } else {
    if (!rt.confirmed) {
      e.existence = BOSS_HIPOTEZA_E;
      if (!p.suspended && Math.hypot(p.x - e.x, p.y - e.y) < CONFIRM_R) rt.confirm += dt;
      else rt.confirm = Math.max(0, rt.confirm - dt * 0.5);
      if (rt.confirm >= CONFIRM_NEED_S) {
        rt.confirmed = true;
        e.existence = 1;
        rt.atkSpeed = 1.5;
        rt.speedMul = 1.4;
        bus.emit('footnote', { text: t('enemies.boss.hipoteza.confirmed') });
        bus.emit('stamp', { text: t('combat.verified'), x: e.x, y: e.y - 70 });
        bus.emit('boss:phase', { id: e.id, family: e.family, x: e.x, y: e.y });
        postSpor(s, bus, e, 2);
      }
    } else e.existence = 1;
  }
}
