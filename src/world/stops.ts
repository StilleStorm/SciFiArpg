/**
 * Przystanki na żądanie (DESIGN 4.1, S21a): the waypoints of a ticket.
 *
 * A campaign ticket carries a stop (a timetable post, its timetable struck out) on page 1 and on every second page after it:
 * page indices 0, 2, 4, ... below the page count. Walking over one enters its page index on the character, per planet; the
 * stop board at the base lists them (`stopRows`) and a tap prints the ticket again from that page (`planStopTravel`: a plan
 * and a bookmark the base exit leads to). In a run a tap on a registered stop settles the run as Zakończ (`tapStop`).
 *
 * Pure rules and thin per-step code. The drawing is `render/stop.ts`, the sheet `ui/stops.ts`, the wiring `main.ts`.
 * The stop is not an obstacle: nothing collides with it and nothing is placed on it. The finale has no stops, nor has a run
 * with no plan (the older random tickets), nor a planet past `CAMPAIGN_LAST`.
 */
import type { Bus } from '../core/events';
import type { Rng } from '../core/rng';
import { dist, type Vec } from '../core/vec';
import { t } from '../i18n';
import { BOOKMARK_VERSION, type Bookmark } from '../save/bookmark';
import { TAP_PX, WALK_R } from './base';
import { CAMPAIGN_LAST, clampPriority, isPlanetIndex, lawForPlanet, newCampaign, nextCampaignPlan, type CampaignState, type PriorityId, type TicketPlan } from './campaign';
import { PAGE_H, PAGE_W, type Circle, type Page, type PageStop } from './pages';
import type { RunState } from './run';
import { ticketForPlan } from './ticket';

/** A stop stands on every second page: indices 0, 2, 4, ... */
export const STOP_EVERY = 2;
/** Walking this close to the post registers it (world units). */
export const STOP_WALK_R = 52;
/** The drawn post relative to its foot: the tap target before it is grown to 44 css px. */
export const STOP_BOX = { x0: -32, y0: -96, x1: 32, y1: 12 } as const;

// ---------- which pages carry a stop ----------

/** The page indices that carry a stop on a ticket of `pageCount` pages: 0, 2, 4, ... below it. */
export function stopIndices(pageCount: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < Math.floor(pageCount); i += STOP_EVERY) out.push(i);
  return out;
}

/** Whether a ticket of this plan has stops at all: a campaign, extra or travel ticket on a planet below `CAMPAIGN_LAST`; never the finale. */
export const ticketHasStops = (plan: TicketPlan | undefined): boolean => plan !== undefined && plan.kind !== 'final' && plan.planet < CAMPAIGN_LAST;

// ---------- the character's record ----------

/** Planet index -> registered page indices (ascending, no repeats). Saved with the character (`Character.stops`). */
export type Stops = Record<number, number[]>;

export const cloneStops = (st: Stops): Stops => Object.fromEntries(Object.entries(st).map(([k, v]) => [k, [...v]]));

export const isRegistered = (st: Stops | undefined, planet: number, index: number): boolean => st?.[planet]?.includes(index) === true;

/** The record with `index` added for `planet` (a copy; the argument is not touched). */
export function withStop(st: Stops | undefined, planet: number, index: number): Stops {
  const next = cloneStops(st ?? {});
  const list = next[planet] ?? [];
  if (!list.includes(index)) list.push(index);
  next[planet] = list.sort((a, b) => a - b);
  return next;
}

export const hasAnyStop = (st: Stops | undefined): boolean => st !== undefined && Object.values(st).some((l) => l.length > 0);

/** Validate whatever was stored: planets that exist and are open to the campaign, whole page indices, no repeats. Never throws. */
export function toStops(raw: unknown): Stops {
  const out: Stops = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  for (const [key, list] of Object.entries(raw)) {
    const planet = Number(key);
    if (!isPlanetIndex(planet) || planet >= CAMPAIGN_LAST || !Array.isArray(list)) continue;
    const idx = [...new Set(list.filter((i): i is number => typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < 64 && i % STOP_EVERY === 0))].sort((a, b) => a - b);
    if (idx.length > 0) out[planet] = idx;
  }
  return out;
}

// ---------- placement ----------

/** The coarse grid the walkable part of a page is flooded on (placement runs for every ticket made, so it stays cheap). */
const REACH_STEP = 40;

/** The cells of a coarse grid the player can walk to from the page's entry (8-neighbour flood fill over booleans): the answer is `has(p)` for a point. */
function reachableFromEntry(page: Page, colliders: readonly Circle[]): (p: Vec) => boolean {
  const cols = Math.floor(page.w / REACH_STEP);
  const rows = Math.floor(page.h / REACH_STEP);
  const cell = (v: number, n: number): number => Math.max(0, Math.min(n - 1, Math.floor(v / REACH_STEP)));
  const reach = WALK_R + 2;
  const free = new Uint8Array(cols * rows).fill(1);
  for (const c of colliders) {
    const span = c.r + reach;
    for (let r = cell(c.y - span, rows); r <= cell(c.y + span, rows); r++) {
      for (let q = cell(c.x - span, cols); q <= cell(c.x + span, cols); q++) {
        if (Math.hypot(q * REACH_STEP + REACH_STEP / 2 - c.x, r * REACH_STEP + REACH_STEP / 2 - c.y) < span) free[r * cols + q] = 0;
      }
    }
  }
  const seen = new Uint8Array(cols * rows);
  const stack = [cell(page.entry.y, rows) * cols + cell(page.entry.x, cols)];
  while (stack.length) {
    const k = stack.pop() ?? 0;
    if (seen[k] || !free[k]) continue;
    seen[k] = 1;
    const c = k % cols;
    const r = (k - c) / cols;
    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        const nc = c + dc;
        const nr = r + dr;
        if ((dc || dr) && nc >= 0 && nr >= 0 && nc < cols && nr < rows) stack.push(nr * cols + nc);
      }
    }
  }
  return (p) => {
    const c = cell(p.x, cols);
    const r = cell(p.y, rows);
    for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) if (seen[cell((r + dr) * REACH_STEP, rows) * cols + cell((c + dc) * REACH_STEP, cols)]) return true;
    return false;
  };
}

const EDGE_X = 150;
const EDGE_TOP = 270;
const EDGE_BOTTOM = 190;

/**
 * Where the post stands on `page`: clear of the obstacles (the barrier of a gate included), of the entry, of the exit corner
 * and its barrier, of the page content, and in the part of the paper the player can walk to. Own stream: no other roll moves.
 * The margins are halved twice when the page is crowded; null when even that finds nothing.
 */
export function placeStop(page: Page, r: Rng): PageStop | null {
  const solid = page.obstacles.flatMap((o) => o.colliders);
  let reach: ((p: Vec) => boolean) | null = null; // flooded the first time a candidate is otherwise fit
  for (const shrink of [1, 0.7, 0.5]) {
    const clearOf = (p: Vec): boolean =>
      solid.every((c) => dist(c, p) > c.r + 58 * shrink) &&
      dist(p, page.entry) > 270 * shrink &&
      (!page.exit || dist(p, page.exit) > 420 * shrink) &&
      (page.content ?? []).every((c) => dist(c, p) > 150 * shrink && (c.kind !== 'zdarzenie' || !c.to || dist(c.to, p) > 150 * shrink));
    for (let tries = 0; tries < 260; tries++) {
      const p = { x: r.range(EDGE_X, PAGE_W - EDGE_X), y: r.range(EDGE_TOP, PAGE_H - EDGE_BOTTOM) };
      if (!clearOf(p)) continue;
      reach ??= reachableFromEntry(page, solid);
      if (!reach(p)) continue;
      return { x: p.x, y: p.y, seed: r.int(1, 1e6), registered: false };
    }
  }
  return null;
}

/** Put a stop on every page of `stopIndices(pages.length)`. Draws from `rng.fork('stops')`, so nothing else on the pages moves. */
export function installStops(pages: Page[], rng: Rng): void {
  const base = rng.fork('stops');
  for (const i of stopIndices(pages.length)) {
    const page = pages[i];
    if (!page) continue;
    const stop = placeStop(page, base.fork(`page:${i}`));
    if (stop) page.stop = stop;
    else delete page.stop;
  }
}

/** The planet a run's stops belong to, or null when the run has none. */
export const stopPlanet = (s: RunState): number | null => (ticketHasStops(s.plan) && s.plan ? s.plan.planet : null);

/** Mark the stops of the pages the character has registered already (after the record is on the state). */
export function syncStops(s: RunState): void {
  const planet = stopPlanet(s);
  for (const page of s.pages) if (page.stop) page.stop.registered = planet !== null && isRegistered(s.stops, planet, page.index);
}

// ---------- walking over and tapping ----------

/**
 * Register the stop of the page the player stands on (or `index`, for a script): the record gains the page, the post is
 * marked, the Asystent writes the footnote, a stamp lands and `stop:registered` is emitted so the caller saves at once.
 * False when there is no stop, it is registered already, or the run has none.
 */
export function registerStop(s: RunState, bus: Bus, index: number = s.pageIndex): boolean {
  const planet = stopPlanet(s);
  const page = s.pages[index];
  if (planet === null || !page?.stop || page.stop.registered) return false;
  s.stops = withStop(s.stops, planet, index);
  page.stop.registered = true;
  bus.emit('stop:registered', { planet, index });
  bus.emit('footnote', { text: t('ui.note.stopRegistered', { page: index + 1 }) });
  bus.emit('stamp', { text: t('ui.stop.stamp'), x: page.stop.x, y: page.stop.y - 120, quiet: true });
  return true;
}

/**
 * Enter `index` of `planet` on the character without any page (the test hook, scripts): false when the planet is not open to the
 * case file or the index is not a stop index. The record is mirrored on the pages of the current ticket.
 */
export function recordStop(s: RunState, bus: Bus, planet: number, index: number): boolean {
  if (!isOpenPlanet(s.campaign ?? newCampaign(), planet) || index < 0 || index % STOP_EVERY !== 0) return false;
  s.stops = withStop(s.stops, planet, index);
  syncStops(s);
  bus.emit('stop:registered', { planet, index });
  return true;
}

/** Per step in a run: the player on the post of the page registers it. Walking registers; a tap does not. */
export function tickStops(s: RunState, bus: Bus): void {
  const stop = s.page.stop;
  if (s.phase !== 'run' || !stop || stop.registered) return;
  if (dist(s.player, stop) <= STOP_WALK_R) registerStop(s, bus);
}

/** The stop of the page if the world point (x, y) is on its post (grown to at least 44 css px at `zoom` css px per unit). */
export function stopAt(page: Page, x: number, y: number, zoom = 1): PageStop | null {
  const stop = page.stop;
  if (!stop) return null;
  const need = TAP_PX / Math.max(0.2, zoom);
  const gx = Math.max(0, (need - (STOP_BOX.x1 - STOP_BOX.x0)) / 2);
  const gy = Math.max(0, (need - (STOP_BOX.y1 - STOP_BOX.y0)) / 2);
  const hit = x >= stop.x + STOP_BOX.x0 - gx && x <= stop.x + STOP_BOX.x1 + gx && y >= stop.y + STOP_BOX.y0 - gy && y <= stop.y + STOP_BOX.y1 + gy;
  return hit ? stop : null;
}

/** A tap at world (x, y) in a run: on a registered stop it asks main.ts to go back to the base (`stop:tapped`). An unregistered post just gets walked to. */
export function tapStop(s: RunState, bus: Bus, x: number, y: number, zoom = 1): boolean {
  const planet = stopPlanet(s);
  if (s.phase !== 'run' || planet === null) return false;
  const stop = stopAt(s.page, x, y, zoom);
  if (!stop?.registered) return false;
  bus.emit('stop:tapped', { planet, index: s.pageIndex });
  return true;
}

// ---------- the stop board ----------

/** Whether the board lists this planet: one the case file has reached (the current one and the closed ones), below `CAMPAIGN_LAST`. */
export const isOpenPlanet = (c: CampaignState, planet: number): boolean =>
  isPlanetIndex(planet) && planet < CAMPAIGN_LAST && (planet === c.current || c.closed.includes(planet) || c.caseClosed || c.finalTicket);

export interface StopRow {
  planet: number;
  /** Registered page indices, ascending (0-based). */
  indices: number[];
}

/** The rows of the board: every open planet, with the page indices registered on it (an empty list is kept: the board says so). */
export function stopRows(c: CampaignState, st: Stops | undefined): StopRow[] {
  const rows: StopRow[] = [];
  for (let planet = 0; planet < CAMPAIGN_LAST; planet++) {
    if (!isOpenPlanet(c, planet)) continue;
    rows.push({ planet, indices: [...(st?.[planet] ?? [])].sort((a, b) => a - b) });
  }
  return rows;
}

// ---------- travel ----------

export interface StopTravel {
  plan: TicketPlan;
  /** Where the base exit leads: the stop's page, the clock at 0, the page count at least `index + 1`. */
  bookmark: Bookmark;
}

export interface TravelOptions {
  /** The priority last chosen on the ticket form; clamped to the character's level. */
  priority: PriorityId;
  level: number;
  /** The seed and number of the base page the board stands in: the printout keeps both. */
  seed: number;
  number: number;
}

/**
 * The ticket a tap on a stop of the board prints: the campaign plan when `planet` is the current planet of the case, else a
 * travel plan (free travel needs no closed case here: the stop is the ticket). The bookmark points at the stop's page and its
 * page count is at least `index + 1`. Null when the planet is not open, past `CAMPAIGN_LAST`, or the stop is not registered.
 */
export function planStopTravel(c: CampaignState, st: Stops | undefined, planet: number, index: number, o: TravelOptions): StopTravel | null {
  if (!isOpenPlanet(c, planet) || !isRegistered(st, planet, index)) return null;
  const priority = clampPriority(o.priority, o.level);
  const next = nextCampaignPlan(c, priority, o.seed);
  const plan: TicketPlan = next && next.kind === 'campaign' && next.planet === planet ? next : { kind: 'travel', planet, priority, lawId: lawForPlanet(planet, o.seed) };
  const ticket = ticketForPlan(o.seed, plan, o.number);
  const pageCount = Math.max(ticket.pageCount, index + 1);
  return {
    plan,
    bookmark: {
      version: BOOKMARK_VERSION,
      ticketNumber: o.number,
      seed: o.seed,
      pageIndex: index,
      lawId: plan.lawId,
      clockS: 0,
      planetName: ticket.planet,
      pageCount,
      plan: { ...plan },
    },
  };
}

// ---------- the test hook (src/testHook.ts) ----------

export interface StopsHook {
  /** The registered stops of the character as the live state has them (planet index -> page indices). */
  list(): Stops;
  /** Register the stop of page `index` of planet `planet` on the character, as walking over it does (no stop on the page needed); false when the planet is not open. */
  register(planet: number, index: number): boolean;
  /** Stand beside the current page's stop (`onIt`: on its foot, which registers it on the next step). False without a stop. */
  place(onIt?: boolean): boolean;
  /** Travel from the base to a registered stop, as a tap on the board does. False when it is not registered or not open. */
  travel(planet: number, index: number): boolean;
  /** The current page: its stop, the indices that carry one for the page count, and the live record. */
  info(): { planet: number | null; index: number; count: number; carries: number[]; stop: { x: number; y: number; registered: boolean } | null; registered: Stops };
}

export function createStopsHook(getState: () => RunState | null, bus: Bus, travel: (planet: number, index: number) => boolean): StopsHook {
  return {
    list: () => cloneStops(getState()?.stops ?? {}),
    register(planet, index) {
      const s = getState();
      return s ? recordStop(s, bus, planet, index) : false;
    },
    place(onIt = false) {
      const s = getState();
      const stop = s?.page.stop;
      if (!s || !stop) return false;
      s.player.x = stop.x + (onIt ? 0 : 120);
      s.player.y = stop.y + (onIt ? 0 : 20);
      s.player.target = null;
      return true;
    },
    travel,
    info() {
      const s = getState();
      const stop = s?.page.stop;
      return {
        planet: s ? stopPlanet(s) : null,
        index: s?.pageIndex ?? -1,
        count: s?.pageCount ?? 0,
        carries: s ? s.pages.filter((p) => p.stop).map((p) => p.index) : [],
        stop: stop ? { x: stop.x, y: stop.y, registered: stop.registered } : null,
        registered: cloneStops(s?.stops ?? {}),
      };
    },
  };
}
