/**
 * The spawning API (also re-exported from systems/enemies.ts): single enemies, waves around a point, elites,
 * the trickle. Everything rolls on `s.rngs.spawn`, so a seed reproduces the population.
 */
import type { Bus, GameEvents } from '../core/events';
import type { Vec } from '../core/vec';
import type { Enemy } from '../entities/types';
import { t } from '../i18n';
import { reachableCells } from '../world/base';
import { resolveMove } from '../world/pages';
import { nextId, type RunState } from '../world/run';
import { ELITE_IDS, FAMILY_IDS, makeMix, pickFamily, setEnemyScale, type EliteId, type FamilyId, type MissionMix } from './families';
import { planScale } from '../world/campaign';
import { ownsAffix, POWIELONY_COPIES } from './elites';
import { applyTierStats, makeEnemy, type MakeOpts } from './make';
import { generateName, namedAllowed, namedRecord, NAMED_CHANCE, pickNamedAffixes, recordNamed } from './named';
import { rtOf } from './runtime';

export type { MissionMix };
export const ENEMY_COUNT = 5;
const MIN_SPAWN_DISTANCE = 320;
/** Share of ordinary spawns that come as elites. */
const ELITE_CHANCE = 0.07;

/** Elites rolled by the spawner lead a pack this often (explicit elites only when `pack: true`). */
export const PACK_CHANCE = 0.5;
export const PACK_MIN = 2;
export const PACK_MAX = 4;

export interface SpawnOpts {
  tier?: number;
  elite?: EliteId;
  /** Two or three affixes and a recorded name instead of one affix (named elite). Needs `elite` or a rolled elite. */
  makeNamed?: boolean;
  /** The fixed name of a named elite instead of a rolled one (the elite of an 'elite' gate, planet 3). */
  name?: string;
  /** Force (true) or forbid (false) the leader's pack of 2-4 minions. */
  pack?: boolean;
  /** Ring around `around` the enemies are placed on. */
  minRadius?: number;
  maxRadius?: number;
  /** Nobody is placed closer than this to the player (default 160). */
  minPlayer?: number;
}

/** Put one enemy at (x, y) if the spot is free (not inside an obstacle). */
export function placeEnemy(s: RunState, family: FamilyId, x: number, y: number, opts: Omit<SpawnOpts, 'makeNamed' | 'pack'> & MakeOpts = {}): Enemy | null {
  const r = s.rngs.spawn;
  const e = makeEnemy(nextId(s), x, y, r.int(1, 1e6), family, opts);
  if (s.plan) {
    // The campaign's planet and priority scale racja and damage; the numbers are applied again with the scale set.
    setEnemyScale(e, planScale(s.plan));
    applyTierStats(e, false);
  }
  const before = { x: e.x, y: e.y };
  resolveMove(s.page, e, e.r);
  if (Math.hypot(e.x - before.x, e.y - before.y) > 1) return null;
  e.home = { x: e.x, y: e.y };
  s.enemies.push(e);
  trackElite(s, e);
  return e;
}

// ---------- elites alive, packs, names ----------

const alive = new WeakMap<RunState, Map<number, Enemy>>();

/** Remember an elite (or a bearer of any affix) so its death can be handled: copies, the named record. */
export function trackElite(s: RunState, e: Enemy): void {
  if (!e.elite) return;
  let m = alive.get(s);
  if (!m) {
    m = new Map();
    alive.set(s, m);
  }
  m.set(e.id, e);
}

/** The leader's affix list after the roll: one affix, or two to three plus a name when it becomes a named elite. */
function eliteOpts(s: RunState, base: SpawnOpts, rolled: EliteId): MakeOpts {
  const r = s.rngs.spawn;
  // the page of an 'elite' gate carries exactly one named elite, the forced one (`spawnGateElite`): none is rolled besides it
  const named = base.makeNamed ?? (base.elite === undefined && s.page.gate?.kind !== 'elite' && namedAllowed(s) && r.chance(NAMED_CHANCE));
  if (!named) return { elite: rolled };
  const affixes = [rolled, ...pickNamedAffixes(r).filter((a) => a !== rolled)].slice(0, r.chance(0.5) ? 2 : 3);
  return { elite: rolled, affixes, named: base.name ?? generateName(r) };
}

/** Put the leader's minions around it: 2-4 of its family and tier, no elite of their own, sharing its aura. Returns them. */
export function spawnPack(s: RunState, leader: Enemy): Enemy[] {
  const r = s.rngs.spawn;
  const want = r.int(PACK_MIN, PACK_MAX);
  const out: Enemy[] = [];
  for (let i = 0; i < want; i++) {
    for (let tries = 0; tries < 10; tries++) {
      const a = r.range(0, Math.PI * 2);
      const d = r.range(46, 110);
      const m = placeEnemy(s, leader.family, leader.x + Math.cos(a) * d, leader.y + Math.sin(a) * d, { tier: leader.tier });
      if (!m) continue;
      rtOf(m).packOf = leader.id;
      out.push(m);
      break;
    }
  }
  rtOf(leader).packSize = out.length;
  return out;
}

/** Copies a dying powielony elite leaves: ordinary enemies of its family and tier close to the spot. */
function spawnCopies(s: RunState, e: Enemy, x: number, y: number): void {
  const r = s.rngs.spawn;
  for (let i = 0; i < POWIELONY_COPIES; i++) {
    for (let tries = 0; tries < 8; tries++) {
      const a = r.range(0, Math.PI * 2);
      const d = r.range(18, 60);
      if (placeEnemy(s, e.family, x + Math.cos(a) * d, y + Math.sin(a) * d, { tier: e.tier })) break;
    }
  }
}

function onEliteDied(s: RunState, bus: Bus, ev: GameEvents['enemy:died']): void {
  const m = alive.get(s);
  const e = m?.get(ev.id);
  m?.delete(ev.id);
  const rec = namedRecord(s, ev.id);
  if (rec) {
    bus.emit('elite:slain', { id: ev.id, x: ev.x, y: ev.y, name: rec.name, minTier: 'nietypowy' });
    bus.emit('footnote', { text: t('enemies.named.slain', { name: rec.name }) });
  }
  if (e && ownsAffix(e, 'powielony')) spawnCopies(s, e, ev.x, ev.y);
}

const bound = new WeakMap<Bus, { s: RunState }>();
/** Listen once per bus for elite deaths; the run in force is the one the AI last stepped (called from updateEnemyAi). */
export function bindEliteDeaths(s: RunState, bus: Bus): void {
  const cur = bound.get(bus);
  if (cur) {
    cur.s = s;
    return;
  }
  const ref = { s };
  bound.set(bus, ref);
  bus.on('enemy:died', (ev) => onEliteDied(ref.s, bus, ev));
}

/** Place the leader (one affix or a named elite) and, when it is to lead a pack, its minions. Returns leader first. */
function placeElite(s: RunState, family: FamilyId, x: number, y: number, tier: number, rolled: EliteId, o: SpawnOpts): Enemy[] {
  const mk = eliteOpts(s, o, rolled);
  const leader = placeEnemy(s, family, x, y, { tier, ...mk });
  if (!leader) return [];
  const rec = mk.named;
  if (rec !== undefined) {
    recordNamed(s, { id: leader.id, name: rec, affixes: mk.affixes ?? [rolled], family, claimed: false });
    return [leader];
  }
  const pack = o.pack ?? (o.elite === undefined && s.rngs.spawn.chance(PACK_CHANCE));
  return pack ? [leader, ...spawnPack(s, leader)] : [leader];
}

/**
 * The forced named elite of an 'elite' gate (world/gate.ts, planet 3): one named elite with the fixed name `story.p3.gate.elite`
 * instead of a rolled one, otherwise the S9 machinery (2-3 affixes, the record, the guaranteed drop on its death). Placed on a
 * cell the player can walk to from the entry, clear of obstacles, well away from the exit corner (the barrier), preferably inside
 * `view` (what the camera shows on entry). Not under Parzystosc's doubling: it is placed directly. Returns it, or null when the
 * page has no such gate, the elite was placed already, or no spot was found.
 */
export function spawnGateElite(s: RunState, view?: Rect): Enemy | null {
  const g = s.page.gate;
  if (!g || g.kind !== 'elite' || g.eliteId !== undefined || g.slain) return null;
  const r = s.rngs.spawn;
  const page = s.page;
  const cells = reachableCells(page, page.entry, 20).filter(
    (c) =>
      Math.hypot(c.x - page.entry.x, c.y - page.entry.y) > 230 &&
      (!page.exit || Math.hypot(c.x - page.exit.x, c.y - page.exit.y) > 440) &&
      c.x > 100 && c.y > 100 && c.x < page.w - 100 && c.y < page.h - 100 &&
      page.obstacles.every((o) => o.colliders.every((q) => Math.hypot(c.x - q.x, c.y - q.y) > q.r + 70)),
  );
  const seen = view ? cells.filter((c) => inRect(c, { x0: view.x0 + 60, y0: view.y0 + 60, x1: view.x1 - 60, y1: view.y1 - 60 })) : [];
  const pool = seen.length > 0 ? seen : cells;
  const tier = s.ticket.family === 'powiadomienia' ? 1 : pageTier(s);
  for (let tries = 0; tries < 40 && pool.length > 0; tries++) {
    const c = pool[r.int(0, pool.length - 1)];
    if (!c) continue;
    const got = placeElite(s, s.ticket.family, c.x, c.y, tier, r.pick(ELITE_IDS), { makeNamed: true, name: t('story.p3.gate.elite'), pack: false });
    const leader = got[0];
    if (leader) {
      g.eliteId = leader.id;
      return leader;
    }
  }
  return null;
}

/** The mission's tier for a family: Powiadomienia start at 1, the others rise with the page. */
function pageTier(s: RunState): number {
  return Math.max(1, 1 + Math.floor(s.pageIndex / 2) + planScale(s.plan).tierOffset);
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
      const elite = opts.elite ?? (wantElite || r.chance(ELITE_CHANCE * planScale(s.plan).eliteMul) ? r.pick(ELITE_IDS) : undefined);
      const tier = opts.tier ?? (fam === 'powiadomienia' ? 1 : pageTier(s));
      const placed = elite ? placeElite(s, fam, x, y, tier, elite, opts) : [placeEnemy(s, fam, x, y, { tier })].filter((e): e is Enemy => e !== null);
      if (placed.length > 0) {
        if (elite) wantElite = false;
        out.push(...placed);
        i += placed.length - 1; // a pack counts against the wave
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
  // One spot per enemy, spread over the view (at least 110 units apart, 260..420 from the player), so the
  // first screen is a loose crowd and not one pile. Under Parzystosc each spot gets its twin beside it.
  const spots: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    for (let tries = 0; tries < 80; tries++) {
      const ax = r.range(Math.max(inner.x0, 80), Math.min(inner.x1, s.page.w - 80));
      const ay = r.range(Math.max(inner.y0, 80), Math.min(inner.y1, s.page.h - 80));
      const d = Math.hypot(ax - p.x, ay - p.y);
      if (d < ENTRY_MIN + 80 || d > 420) continue;
      if (spots.some((q) => Math.hypot(q.x - ax, q.y - ay) < 110)) continue;
      const got = spawnWave(s, family, 1, { x: ax, y: ay }, { minRadius: 0, maxRadius: 30, minPlayer: ENTRY_MIN });
      if (got.length === 0) continue;
      spots.push({ x: ax, y: ay });
      out.push(...got);
      break;
    }
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
export function spawnElite(s: RunState, family: FamilyId, around?: Vec, affix?: EliteId, extra: Pick<SpawnOpts, 'makeNamed' | 'pack'> = {}): Enemy | null {
  const r = s.rngs.spawn;
  const at = around ?? { x: r.range(160, s.page.w - 160), y: r.range(160, s.page.h - 160) };
  const got = spawnWave(s, family, 1, at, { elite: affix ?? r.pick(ELITE_IDS), minRadius: 0, maxRadius: 80, ...extra });
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
    const elite = r.chance(ELITE_CHANCE * planScale(s.plan).eliteMul) ? r.pick(ELITE_IDS) : undefined;
    if (elite) {
      const got = placeElite(s, family, x, y, tier, elite, {});
      if (got[0]) return got[0];
      continue;
    }
    const e = placeEnemy(s, family, x, y, { tier });
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
