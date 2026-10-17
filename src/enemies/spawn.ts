/**
 * The spawning API (also re-exported from systems/enemies.ts): single enemies, waves around a point, elites,
 * the trickle. Everything rolls on `s.rngs.spawn`, so a seed reproduces the population.
 */
import type { Vec } from '../core/vec';
import type { Enemy } from '../entities/types';
import { resolveMove } from '../world/pages';
import { nextId, type RunState } from '../world/run';
import { ELITE_IDS, FAMILY_IDS, makeMix, pickFamily, type EliteId, type FamilyId, type MissionMix } from './families';
import { makeEnemy } from './make';

export type { MissionMix };
export const ENEMY_COUNT = 5;
const MIN_SPAWN_DISTANCE = 320;
/** Share of ordinary spawns that come as elites. */
const ELITE_CHANCE = 0.07;

export interface SpawnOpts {
  tier?: number;
  elite?: EliteId;
  /** Ring around `around` the enemies are placed on. */
  minRadius?: number;
  maxRadius?: number;
  /** Nobody is placed closer than this to the player (default 160). */
  minPlayer?: number;
}

/** Put one enemy at (x, y) if the spot is free (not inside an obstacle). */
export function placeEnemy(s: RunState, family: FamilyId, x: number, y: number, opts: SpawnOpts = {}): Enemy | null {
  const r = s.rngs.spawn;
  const e = makeEnemy(nextId(s), x, y, r.int(1, 1e6), family, opts);
  const before = { x: e.x, y: e.y };
  resolveMove(s.page, e, e.r);
  if (Math.hypot(e.x - before.x, e.y - before.y) > 1) return null;
  e.home = { x: e.x, y: e.y };
  s.enemies.push(e);
  return e;
}

/** The mission's tier for a family: Powiadomienia start at 1, the others rise with the page. */
function pageTier(s: RunState): number {
  return 1 + Math.floor(s.pageIndex / 2);
}

/** `count` enemies of a family around a point (a ring of 90-230 units). Returns those that fit. */
export function spawnWave(s: RunState, family: FamilyId, count: number, around: Vec, opts: SpawnOpts = {}): Enemy[] {
  const fam = FAMILY_IDS.includes(family) ? family : 'urzadzenia';
  const r = s.rngs.spawn;
  const out: Enemy[] = [];
  const total = count * (s.law.spawnPairs ? 2 : 1);
  const lo = opts.minRadius ?? 90;
  const hi = opts.maxRadius ?? 230;
  let wantElite = s.law.extraElites > 0 && !s.enemies.some((e) => e.elite);
  for (let i = 0; i < total; i++) {
    for (let tries = 0; tries < 12; tries++) {
      const a = r.range(0, Math.PI * 2);
      const d = out.length === 0 && i === 0 ? r.range(0, 60) : r.range(lo, hi);
      const x = around.x + Math.cos(a) * d;
      const y = around.y + Math.sin(a) * d;
      if (x < 60 || y < 60 || x > s.page.w - 60 || y > s.page.h - 60) continue;
      if (Math.hypot(x - s.player.x, y - s.player.y) < (opts.minPlayer ?? 160)) continue;
      const elite = opts.elite ?? (wantElite || r.chance(ELITE_CHANCE) ? r.pick(ELITE_IDS) : undefined);
      const tier = opts.tier ?? (fam === 'powiadomienia' ? 1 : pageTier(s));
      const e = placeEnemy(s, fam, x, y, { tier, elite });
      if (e) {
        if (e.elite) wantElite = false;
        out.push(e);
        break;
      }
    }
  }
  return out;
}

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Nobody of the entry wave stands closer than this to the player. */
export const ENTRY_MIN = 180;
/** At least this many enemies are inside the camera view when a page is entered. */
export const ENTRY_VISIBLE = 3;

const inRect = (e: { x: number; y: number }, v: Rect): boolean => e.x >= v.x0 && e.x <= v.x1 && e.y >= v.y0 && e.y <= v.y1;

/**
 * The first wave of a page: placed inside `view` (what the camera shows on entry) at least ENTRY_MIN from the
 * player, so the first screenshot is not empty paper. Tops up with single enemies of the family if obstacles
 * or walls took some. Returns the enemies it placed.
 */
export function spawnEntryWave(s: RunState, family: FamilyId, count: number, view: Rect): Enemy[] {
  const r = s.rngs.spawn;
  const p = s.player;
  const margin = 70;
  const inner: Rect = { x0: view.x0 + margin, y0: view.y0 + margin, x1: view.x1 - margin, y1: view.y1 - margin };
  const out: Enemy[] = [];
  // an anchor inside the view, 220..340 from the player, where the group gathers
  for (let tries = 0; tries < 60 && out.length === 0; tries++) {
    const ax = r.range(Math.max(inner.x0, 80), Math.min(inner.x1, s.page.w - 80));
    const ay = r.range(Math.max(inner.y0, 80), Math.min(inner.y1, s.page.h - 80));
    const d = Math.hypot(ax - p.x, ay - p.y);
    if (d < ENTRY_MIN + 40 || d > 340) continue;
    out.push(...spawnWave(s, family, count, { x: ax, y: ay }, { minRadius: 20, maxRadius: 80, minPlayer: ENTRY_MIN }));
  }
  // top up: single enemies anywhere in the view
  for (let tries = 0; tries < 200 && s.enemies.filter((e) => inRect(e, view) && Math.hypot(e.x - p.x, e.y - p.y) >= ENTRY_MIN).length < ENTRY_VISIBLE; tries++) {
    const x = r.range(Math.max(view.x0, 70), Math.min(view.x1, s.page.w - 70));
    const y = r.range(Math.max(view.y0, 70), Math.min(view.y1, s.page.h - 70));
    if (Math.hypot(x - p.x, y - p.y) < ENTRY_MIN + 10) continue;
    const e = placeEnemy(s, family, x, y, { tier: family === 'powiadomienia' ? 1 : pageTier(s) });
    if (e) out.push(e);
  }
  return out;
}

/** Enemies inside `view` and at least `minDist` from the player. */
export function countInView(s: RunState, view: Rect, minDist = 0): number {
  return s.enemies.filter((e) => inRect(e, view) && Math.hypot(e.x - s.player.x, e.y - s.player.y) >= minDist).length;
}

/** One elite of a family near a point (default: somewhere on the page, away from the player). */
export function spawnElite(s: RunState, family: FamilyId, around?: Vec, affix?: EliteId): Enemy | null {
  const r = s.rngs.spawn;
  const at = around ?? { x: r.range(160, s.page.w - 160), y: r.range(160, s.page.h - 160) };
  const got = spawnWave(s, family, 1, at, { elite: affix ?? r.pick(ELITE_IDS), minRadius: 0, maxRadius: 80 });
  // spawnWave doubles under Parzystosc; the elite is the first one
  return got[0] ?? null;
}

/** A random-family enemy somewhere on the page, away from the player. */
export function spawnEnemy(s: RunState, minDistance = MIN_SPAWN_DISTANCE): Enemy | null {
  const r = s.rngs.spawn;
  const family = pickFamily(r, s.mix ?? makeMix(s.ticket.family));
  for (let tries = 0; tries < 40; tries++) {
    const x = r.range(80, s.page.w - 80);
    const y = r.range(80, s.page.h - 80);
    if (Math.hypot(x - s.player.x, y - s.player.y) < minDistance) continue;
    const tier = family === 'powiadomienia' ? 1 : pageTier(s);
    const elite = r.chance(ELITE_CHANCE) ? r.pick(ELITE_IDS) : undefined;
    const e = placeEnemy(s, family, x, y, { tier, elite });
    if (e) return e;
  }
  return null;
}

/** Keep a few enemies around: every 10 s, one more if the page is thin. Uses the run's mix. */
export function trickleSpawn(s: RunState, dt: number): void {
  s.spawnTimer -= dt;
  if (s.spawnTimer > 0) return;
  s.spawnTimer = 10;
  if (s.enemies.length < ENEMY_COUNT) spawnEnemy(s);
}

export { makeMix };
