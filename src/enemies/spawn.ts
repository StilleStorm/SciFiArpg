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
      if (Math.hypot(x - s.player.x, y - s.player.y) < 160) continue;
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

/** One elite of a family near a point (default: somewhere on the page, away from the player). */
export function spawnElite(s: RunState, family: FamilyId, around?: Vec, affix?: EliteId): Enemy | null {
  const r = s.rngs.spawn;
  const at = around ?? { x: r.range(160, s.page.w - 160), y: r.range(160, s.page.h - 160) };
  const got = spawnWave(s, family, 1, at, { elite: affix ?? r.pick(ELITE_IDS), minRadius: 0, maxRadius: 80 });
  // spawnWave doubles under Parzystosc; the elite is the first one
  return got[0] ?? null;
}

/** A random-family enemy somewhere on the page, away from the player (the old placeholder entry). */
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
