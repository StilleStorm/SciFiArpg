/**
 * Bosses, one per family, with a simple phase model (DESIGN 6).
 * Prototyp: every part; at half racja it drops a leg and speeds up.
 * Weryfikacja: stands still, summons Przypomnienia every 6 s; standing on its two hydrant squares for 2 s in
 * total blocks it for 3 s. The grid is a 3x3 of hatched squares drawn around it (render/enemyFigures.ts).
 * Ankieta (planet 6, STORY 8.10): walks; every 8 s a row of five star squares is drawn between it and the player (render/enemyFigures.ts);
 * 1.5 s on the 1-star square files a complaint (it is blocked 3 s), 1.5 s on the 5-star square thanks it (it heals 10%, the row goes);
 * a row left 6 s summons two Przypomnienia and draws the next. At half racja the row is drawn round the player every 6 s.
 * Wizualizacja (planet 9, STORY 8.15): walks, existence pinned at 0.4. First 4 s after arrival, then 8 s after each answer, an observation post (a
 * solid circle with a cross-hair) is marked on the floor between it and the player; 2 s inside it is an observation (e = 1 for 6 s, zablokowany for
 * 3); a post left 6 s fills in the detail instead (two Wygenerowane of tier 1, cap 6) and the next is marked. At half racja two posts are marked
 * round the player every 6 s, one true and one dotted: 2 s in the dotted one confirms the picture (it heals 10%, both posts go).
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
import { newRt, rtOf, type Observation, type Survey } from './runtime';
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
  wizualizacja: { hp: 320, speed: 34, dmgMin: 6, dmgMax: 9, pewnoscSiebie: 80, upor: 45, attackRange: 44, attackCooldown: 1.3, claimType: 'mechaniczny' },
};

/** Wizualizacja (STORY 8.15): the pinned existence, the post (radius of Hipoteza's outline), and its timings. */
export const BOSS_WIZUALIZACJA_E = 0.4;
export const POST_R = CONFIRM_R;
export const POST_FIRST_S = 4;
export const POST_EVERY_S = 8;
export const POST_EVERY_S2 = 6;
export const POST_NEED_S = 2;
export const POST_SEEN_S = 6;
export const POST_BLOCK_S = 3;
export const POST_REMIND_S = 6;
export const POST_HEAL = 0.1;
/** Phase 2: how far from the player the two posts are marked. */
export const POST_RING = 105;
/** How far across (units) a post's centre may stand from the player, so the whole circle shows on a phone held upright (the view is at least 390 wide). */
export const POST_REACH = 390 / 2 - POST_R - 3;

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
 * How far across (units) the row's centre may stand from the player: the portrait view is at least 390 units wide (render/camera
 * MIN_VIEW_W) with the player in the middle, so a row of five 52-unit squares plus a margin fits on screen in full.
 */
export const SURVEY_REACH = 390 / 2 - (SURVEY_CELLS * GRID_CELL) / 2 - 12;

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
  arm?: 'stapler' | 'dlon';
  /** The one part drawn on a Weryfikacja's variant: the hydrants of the grid squares as shopping carts (planet 5). */
  grid?: 'koszyk';
  /** i18n key of the captcha hint instead of `enemies.boss.weryfikacja.hint` (planet 5); the solved line stays the family's. */
  hintKey?: string;
  /** i18n key of the line printed when the grid is solved instead of `enemies.boss.weryfikacja.solved` (planet 5). */
  solvedKey?: string;
}

const VARIANTS = new Map<number, BossVariant>();
const variantLines = new WeakMap<object, string>();
const variantArms = new WeakMap<object, 'stapler' | 'dlon'>();
const variantGrids = new WeakMap<object, 'koszyk'>();
const variantHints = new WeakMap<object, string>();
const variantSolved = new WeakMap<object, string>();

/** Register the boss variant of a planet (0-based index). */
export function registerBossVariant(planet: number, v: BossVariant): void {
  VARIANTS.set(planet, v);
}

/** The variant a planet gives its boss, if one is registered. */
export const bossVariantOf = (planet: number | undefined): BossVariant | undefined => (planet === undefined ? undefined : VARIANTS.get(planet));

/** The key of the variant line under this boss's name, or undefined for a plain family boss. */
export const bossVariantLine = (e: object): string | undefined => variantLines.get(e);

/** The extra arm drawn on this boss's variant, if its variant has one. */
export const bossVariantArm = (e: object): 'stapler' | 'dlon' | undefined => variantArms.get(e);

/** The look of the grid squares on this Weryfikacja's variant ('koszyk': shopping carts), if its variant has one. */
export const bossVariantGrid = (e: object): 'koszyk' | undefined => variantGrids.get(e);

/** The key of the captcha hint of this boss: its variant's override, else the family's. */
export const bossHintKey = (e: object): string => variantHints.get(e) ?? 'enemies.boss.weryfikacja.hint';

/** The key of the line printed when the grid is solved: its variant's override, else the family's. */
export const bossSolvedKey = (e: object): string => variantSolved.get(e) ?? 'enemies.boss.weryfikacja.solved';

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
  if (mine?.solvedKey) variantSolved.set(e, mine.solvedKey);
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
  if (boss === 'wizualizacja') {
    e.existence = BOSS_WIZUALIZACJA_E;
    rt.eTarget = BOSS_WIZUALIZACJA_E;
    rt.obs = { posts: [], wait: POST_FIRST_S, age: 0, stand: 0, at: -1, seen: 0 };
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

/** Two of `family` (tier 1) round the boss, cap 6 of them alive: Weryfikacja's and Ankieta's Przypomnienia, Wizualizacja's details. */
function summonAround(s: RunState, e: Enemy, family: FamilyId): void {
  const alive = s.enemies.filter((o) => o.family === family && !o.boss).length;
  for (let i = 0; i < 2 && alive + i < SUMMON_CAP; i++) {
    const a = s.rngs.spawn.range(0, Math.PI * 2);
    placeEnemy(s, family, e.x + Math.cos(a) * (e.r + 40), e.y + Math.sin(a) * (e.r + 40), { tier: 1 });
  }
}
const summonReminders = (s: RunState, e: Enemy): void => summonAround(s, e, 'powiadomienia');

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
  // the whole row is on a phone held upright: its centre stays within SURVEY_REACH of the player across (the camera keeps the player in the middle)
  cx = Math.min(p.x + SURVEY_REACH, Math.max(p.x - SURVEY_REACH, cx));
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

/** Which post of the observation (0..) the point stands in, or -1. */
export function postAt(posts: readonly { x: number; y: number }[], x: number, y: number): number {
  return posts.findIndex((q) => Math.hypot(x - q.x, y - q.y) < POST_R);
}

/** Mark the next post(s): one between the boss and the player (phase 1, the Ankieta's placement), two round the player (phase 2, one of them generated). */
function markPosts(s: RunState, e: Enemy, ob: Observation): void {
  const p = s.player;
  const rng = s.rngs.ai;
  const inPage = (v: number, max: number): number => Math.min(max - POST_R * 0.6, Math.max(POST_R * 0.6, v));
  ob.posts = [];
  if (rtOf(e).phase < 2) {
    const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
    const t0 = Math.min(210, Math.max(135, d * 0.5));
    const x = Math.min(p.x + POST_REACH, Math.max(p.x - POST_REACH, e.x + ((p.x - e.x) / d) * t0));
    ob.posts.push({ x: inPage(x, s.page.w), y: inPage(e.y + ((p.y - e.y) / d) * t0, s.page.h), generated: false });
  } else {
    const a = rng.range(0, Math.PI * 2);
    const first = rng.chance(0.5);
    for (const k of [0, 1]) {
      const b = a + k * Math.PI;
      ob.posts.push({ x: inPage(p.x + Math.cos(b) * POST_RING, s.page.w), y: inPage(p.y + Math.sin(b) * POST_RING, s.page.h), generated: (k === 0) === first });
    }
  }
  ob.age = 0;
  ob.stand = 0;
  ob.at = -1;
}

/** Observed or not: the pinned existence 0.4, or 1 while the observation lasts. Runs even while the boss is held (the 6 s are wall time). */
function tickSeen(e: Enemy, dt: number): void {
  const ob = rtOf(e).obs;
  if (!ob) return;
  if (ob.seen > 0) ob.seen = Math.max(0, ob.seen - dt);
  e.existence = ob.seen > 0 ? 1 : BOSS_WIZUALIZACJA_E;
}

/** Wizualizacja's per-step logic: the posts' timers, the true and the generated one, the details, the half-racja phase. */
function tickObservation(s: RunState, e: Enemy, bus: Bus, dt: number): void {
  const rt = rtOf(e);
  const ob = rt.obs;
  if (!ob) return;
  const p = s.player;
  if (rt.phase === 1 && e.hp <= e.hpMax / 2) {
    rt.phase = 2;
    bus.emit('footnote', { text: t('enemies.boss.wizualizacja.half') });
    bus.emit('boss:phase', { id: e.id, family: e.family, x: e.x, y: e.y });
    postSpor(s, bus, e, 2);
    ob.wait = ob.posts.length > 0 ? 2 : Math.min(ob.wait, POST_EVERY_S2); // a post up at the break is taken down; the pair follows in 2 s
    ob.posts = [];
  }
  if (ob.posts.length === 0) {
    ob.wait -= dt;
    if (ob.wait > 0) return;
    markPosts(s, e, ob);
    if (!rt.noted) {
      rt.noted = true;
      bus.emit('footnote', { text: t('enemies.boss.wizualizacja.hint') });
    }
    return;
  }
  ob.age += dt;
  const at = p.suspended ? -1 : postAt(ob.posts, p.x, p.y);
  if (at >= 0 && at === ob.at) ob.stand += dt;
  else ob.stand = at >= 0 ? 0 : Math.max(0, ob.stand - dt * 0.5);
  ob.at = at;
  const every = rt.phase >= 2 ? POST_EVERY_S2 : POST_EVERY_S;
  const post = at >= 0 ? ob.posts[at] : undefined;
  if (post && ob.stand >= POST_NEED_S) {
    ob.posts = [];
    ob.wait = every;
    ob.stand = 0;
    ob.at = -1;
    if (post.generated) {
      e.hp = Math.min(e.hpMax, e.hp + e.hpMax * POST_HEAL);
      bus.emit('footnote', { text: t('enemies.boss.wizualizacja.false') });
    } else {
      ob.seen = POST_SEEN_S;
      e.existence = 1;
      applyStatus(e, 'zablokowany', POST_BLOCK_S, p.id);
      bus.emit('footnote', { text: t('enemies.boss.wizualizacja.observed') });
    }
    bus.emit('boss:phase', { id: e.id, family: e.family, x: e.x, y: e.y });
    return;
  }
  if (ob.age >= POST_REMIND_S) {
    bus.emit('footnote', { text: t('enemies.boss.wizualizacja.details') });
    if (!isSilenced(e) && !s.law.botTime) summonAround(s, e, 'wygenerowane');
    markPosts(s, e, ob);
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
  if (boss === 'wizualizacja') tickSeen(e, dt);
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
        bus.emit('footnote', { text: t(bossSolvedKey(e)) });
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
  } else if (boss === 'wizualizacja') {
    tickObservation(s, e, bus, dt);
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
