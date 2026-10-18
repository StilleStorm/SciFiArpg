/**
 * The base of a planet (DESIGN 4.1): a small walkable page, about one screen, with the stations of the ticket system
 * drawn as objects, no enemies and an exit that stays locked until a ticket is accepted.
 *
 * Pure rules and data. The page is generated from the planet seed: one of three layouts (lądowisko, wioska,
 * miasteczko) arranges the same four stations differently and adds a few drawn props. The run state is in the `base`
 * field of `RunState` while `phase` is 'base'; the drawings are `render/stations.ts`, the sheets are `ui/*.ts` and the
 * wiring is `main.ts`.
 *
 * The page's pages (`RunState.pages`) are the run's pages, as always; the base is not one of them. `RunState.pageIndex`
 * is the run page the exit leads to (0, or the bookmarked page when a ticket is being resumed).
 */
import type { Bus } from '../core/events';
import { createRng } from '../core/rng';
import { dist, type Vec } from '../core/vec';
import { t } from '../i18n';
import type { Bookmark } from '../save/bookmark';
import { atExit, colliders, PAGE_INSET, type Circle, type Corner, type Obstacle, type ObstacleKind, type Page } from './pages';
import type { RunState } from './run';

/** The base page is smaller than the run pages: about one screen. */
export const BASE_W = 900;
export const BASE_H = 700;
/** A station's margin-note label appears, and a tapped station opens, when the player is this close (world units). */
export const LABEL_RANGE = 90;
/** The tap target of a station is at least this many css pixels across. */
export const TAP_PX = 44;
/** Collision radius used for the reachability checks (the player's). */
export const WALK_R = 13;

export type BaseLayout = 'ladowisko' | 'wioska' | 'miasteczko';
export const BASE_LAYOUTS: readonly BaseLayout[] = ['ladowisko', 'wioska', 'miasteczko'];
/** The stations that open a sheet. The tunnel is a hole, not a station: the player walks into it. */
export type TappableStation = 'biurko' | 'kiosk' | 'tablica' | 'paczkomat';
export type StationId = TappableStation | 'tunel';
export const STATIONS: readonly TappableStation[] = ['biurko', 'kiosk', 'tablica', 'paczkomat'];

export interface Station {
  id: TappableStation;
  x: number;
  y: number;
  /** Tap radius in world units (at least 22 css px, see `tapRadius`). */
  hit: number;
}

export type PropKind = 'leg' | 'flag' | 'scorch' | 'hut' | 'square' | 'house';

/** A drawn extra of the layout (a landing leg, a flag, a hut, a square, a house front). */
export interface BaseProp {
  kind: PropKind;
  x: number;
  y: number;
  /** Seeds the hand-drawn irregularity (render only). */
  seed: number;
  rot: number;
}

/** What the base page knows about itself (`Page.base`). */
export interface BasePageInfo {
  layout: BaseLayout;
  stations: Station[];
  props: BaseProp[];
  /** Where the open service tunnel's hole is cut when a run is held (the base end of the tunnel). */
  hole: Vec;
}

/** The base part of the run state (`RunState.base`, present while `phase` is 'base'). */
export interface BaseState {
  layout: BaseLayout;
  /** "Akceptuję regulamin" (or "Wznów zgłoszenie") was pressed: the exit is open. */
  accepted: boolean;
  /** A bookmarked ticket the exit leads back into: the page index is `RunState.pageIndex`, the clock is restored on entry. */
  resume: Bookmark | null;
  /** A station the player tapped and is walking to. */
  pending: TappableStation | null;
  /** Seconds until the next "wymaga zgłoszenia" note may be written. */
  noteCooldown: number;
}

// ---------- layouts ----------

interface Anchor {
  x: number;
  y: number;
}

interface LayoutSpec {
  spawn: Anchor;
  exit: Corner;
  torn: Corner;
  hole: Anchor;
  stations: Record<TappableStation, Anchor>;
  props: { kind: PropKind; x: number; y: number }[];
}

/** Each layout is a different arrangement of the same stations. Coordinates in the 900 x 700 page; jittered a little by the seed. */
const SPECS: Record<BaseLayout, LayoutSpec> = {
  // an open field: the capsule's foot and a flag by the landing spot, the stations spread far apart
  ladowisko: {
    spawn: { x: 190, y: 535 },
    exit: 'br',
    torn: 'tr',
    hole: { x: 330, y: 545 },
    stations: {
      tablica: { x: 255, y: 290 },
      biurko: { x: 450, y: 325 },
      kiosk: { x: 660, y: 290 },
      paczkomat: { x: 705, y: 480 },
    },
    props: [
      { kind: 'scorch', x: 190, y: 550 },
      { kind: 'leg', x: 95, y: 595 },
      { kind: 'flag', x: 260, y: 640 },
    ],
  },
  // huts around a lane
  wioska: {
    spawn: { x: 450, y: 600 },
    exit: 'bl',
    torn: 'tr',
    hole: { x: 590, y: 625 },
    stations: {
      kiosk: { x: 250, y: 340 },
      biurko: { x: 440, y: 330 },
      tablica: { x: 640, y: 280 },
      paczkomat: { x: 770, y: 495 },
    },
    props: [
      { kind: 'hut', x: 130, y: 470 },
      { kind: 'hut', x: 315, y: 505 },
      { kind: 'hut', x: 615, y: 490 },
      { kind: 'hut', x: 795, y: 310 },
    ],
  },
  // a square with the notice board in its middle, stations round it, house fronts at the edges
  miasteczko: {
    spawn: { x: 170, y: 570 },
    exit: 'br',
    torn: 'tl',
    hole: { x: 305, y: 615 },
    stations: {
      biurko: { x: 255, y: 290 },
      tablica: { x: 450, y: 415 },
      kiosk: { x: 650, y: 290 },
      paczkomat: { x: 735, y: 520 },
    },
    props: [
      { kind: 'square', x: 450, y: 420 },
      { kind: 'house', x: 80, y: 335 },
      { kind: 'house', x: 830, y: 330 },
    ],
  },
};

/** Which layout a planet seed gets. */
export function layoutForSeed(seed: number): BaseLayout {
  return createRng(seed).fork('base-layout').pick(BASE_LAYOUTS);
}

/** Colliders of a station or a prop, relative to its centre. */
function stationBody(id: TappableStation): Circle[] {
  switch (id) {
    case 'biurko':
      return [{ x: -26, y: 4, r: 26 }, { x: 26, y: 4, r: 26 }];
    case 'kiosk':
      return [{ x: -28, y: 8, r: 24 }, { x: 0, y: 8, r: 24 }, { x: 28, y: 8, r: 24 }];
    case 'tablica':
      return [{ x: -38, y: 12, r: 12 }, { x: 0, y: 12, r: 10 }, { x: 38, y: 12, r: 12 }];
    case 'paczkomat':
      return [{ x: 0, y: -8, r: 22 }, { x: 0, y: 20, r: 20 }];
  }
}

function propBody(kind: PropKind): Circle[] {
  switch (kind) {
    case 'leg':
      return [{ x: -26, y: -4, r: 12 }, { x: 26, y: -4, r: 12 }];
    case 'flag':
      return [{ x: 0, y: 0, r: 7 }];
    case 'hut':
      return [{ x: 0, y: 8, r: 33 }];
    case 'house':
      return [{ x: 0, y: -18, r: 34 }, { x: 0, y: 26, r: 34 }];
    case 'scorch':
    case 'square':
      return []; // flat marks on the paper
  }
}

const cornerOf = (c: Corner, w: number, h: number): Vec => ({ x: c[1] === 'l' ? PAGE_INSET : w - PAGE_INSET, y: c[0] === 't' ? PAGE_INSET : h - PAGE_INSET });

/** Half the width of a tap target in world units for a view that shows `zoom` css px per unit. */
export const tapRadius = (st: Pick<Station, 'hit'>, zoom: number): number => Math.max(st.hit, TAP_PX / 2 / Math.max(0.2, zoom));

// ---------- reachability (also used by the tests) ----------

/** True when a figure of radius `r` can stand at `p`: inside the walls and clear of every collider. */
export function walkableAt(page: Page, p: Vec, r = WALK_R): boolean {
  const lo = page.inset + r;
  if (p.x < lo || p.x > page.w - lo || p.y < lo || p.y > page.h - lo) return false;
  for (const o of page.obstacles) for (const c of o.colliders) if (Math.hypot(p.x - c.x, p.y - c.y) < c.r + r) return false;
  return true;
}

/** Every grid cell (centre) the player can walk to from `from`, by an 8-neighbour flood fill on a grid of `step` units. */
export function reachableCells(page: Page, from: Vec, step = 10, r = WALK_R): Vec[] {
  const cols = Math.floor(page.w / step);
  const rows = Math.floor(page.h / step);
  const at = (c: number, rw: number): Vec => ({ x: c * step + step / 2, y: rw * step + step / 2 });
  const free = (c: number, rw: number): boolean => c >= 0 && rw >= 0 && c < cols && rw < rows && walkableAt(page, at(c, rw), r);
  const seen = new Set<number>();
  const out: Vec[] = [];
  const queue: [number, number][] = [[Math.floor(from.x / step), Math.floor(from.y / step)]];
  while (queue.length) {
    const next = queue.pop();
    if (!next) break;
    const [c, rw] = next;
    const key = rw * cols + c;
    if (seen.has(key) || !free(c, rw)) continue;
    seen.add(key);
    out.push(at(c, rw));
    for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) if (dc || dr) queue.push([c + dc, rw + dr]);
  }
  return out;
}

/** What a base page must offer a player who stands at its spawn: every station within label range, the exit, the hole. */
export function unreachableGoals(page: Page): string[] {
  const info = page.base;
  if (!info) return ['no base'];
  const cells = reachableCells(page, page.spawn);
  const near = (p: Vec, d: number): boolean => cells.some((c) => dist(c, p) <= d);
  const missing: string[] = [];
  for (const st of info.stations) if (!near(st, LABEL_RANGE - 8)) missing.push(st.id);
  if (page.exit && !cells.some((c) => atExit(page, c))) missing.push('exit');
  if (!near(info.hole, 14)) missing.push('tunel');
  return missing;
}

// ---------- generation ----------

/** The minimum free space left between two colliders of the decor (a figure is 26 units across). */
const DECOR_GAP = 74;

const DECOR_KINDS: readonly ObstacleKind[] = ['ring', 'blot', 'sticky', 'clip', 'blot', 'note', 'ring', 'qr'];

/**
 * The base page of a planet. A pure function of the seed. Three to five inked obstacles of the usual kinds stand
 * between the stations, placed clear of them, of the landing spot, the exit and the hole; stations and props are
 * obstacles flagged with `station` (so the walls and colliders of `resolveMove` apply to them), which the drawing skips
 * and draws itself (`render/stations.ts`).
 */
export function generateBase(seed: number): Page {
  const layout = layoutForSeed(seed);
  const spec = SPECS[layout];
  const r = createRng(seed).fork('base');
  const jit = r.fork('jitter');
  const move = (a: Anchor, d: number): Vec => ({ x: a.x + jit.range(-d, d), y: a.y + jit.range(-d, d) });

  const spawn = move(spec.spawn, 8);
  const hole = move(spec.hole, 6);
  const exitPt = cornerOf(spec.exit, BASE_W, BASE_H);
  const obstacles: Obstacle[] = [];
  const add = (o: Obstacle): void => {
    obstacles.push(o);
  };

  const tp = { x: spec.torn[1] === 'l' ? 0 : BASE_W, y: spec.torn[0] === 't' ? 0 : BASE_H };
  const torn: Obstacle = { kind: 'torn', x: tp.x, y: tp.y, size: 150, rot: 0, seed: r.int(1, 1e6), colliders: [] };
  torn.colliders = colliders(torn);
  add(torn);

  const stations: Station[] = STATIONS.map((id) => {
    const p = move(spec.stations[id], 14);
    return { id, x: p.x, y: p.y, hit: id === 'tablica' ? 52 : 48 };
  });
  for (const st of stations) {
    add({
      kind: 'blot',
      x: st.x,
      y: st.y,
      size: 0,
      rot: 0,
      seed: r.int(1, 1e6),
      colliders: stationBody(st.id).map((c) => ({ x: st.x + c.x, y: st.y + c.y, r: c.r })),
      station: st.id,
    });
  }
  const props: BaseProp[] = spec.props.map((p) => {
    const q = move(p, 10);
    return { kind: p.kind, x: q.x, y: q.y, seed: r.int(1, 1e6), rot: r.range(-0.12, 0.12) };
  });
  for (const pr of props) {
    const body = propBody(pr.kind);
    if (body.length === 0) continue;
    add({ kind: 'blot', x: pr.x, y: pr.y, size: 0, rot: 0, seed: pr.seed, colliders: body.map((c) => ({ x: pr.x + c.x, y: pr.y + c.y, r: c.r })), station: 'prop' });
  }

  // decor: a few inked obstacles in the free places
  const decorRng = r.fork('decor');
  const keepOut: { p: Vec; r: number }[] = [
    { p: spawn, r: 150 },
    { p: hole, r: 120 },
    { p: exitPt, r: 210 },
  ];
  const decor: Obstacle[] = [];
  const want = decorRng.int(3, 5);
  for (let guard = 0, n = 0; decor.length < want && guard < 400; guard++) {
    const kind = DECOR_KINDS[n % DECOR_KINDS.length] ?? 'blot';
    const size = kind === 'blot' ? decorRng.range(26, 46) : kind === 'ring' ? decorRng.range(54, 68) : kind === 'qr' ? decorRng.range(90, 106) : decorRng.range(76, 94);
    const o: Obstacle = {
      kind,
      x: decorRng.range(90, BASE_W - 90),
      y: decorRng.range(190, BASE_H - 80),
      size,
      rot: kind === 'clip' ? decorRng.range(-1.4, 1.4) : decorRng.range(-0.5, 0.5),
      seed: decorRng.int(1, 1e6),
      colliders: [],
    };
    o.colliders = colliders(o);
    const inside = o.colliders.every((c) => c.x - c.r > PAGE_INSET + 30 && c.x + c.r < BASE_W - PAGE_INSET - 30 && c.y - c.r > PAGE_INSET + 150 && c.y + c.r < BASE_H - PAGE_INSET - 30);
    const clear =
      inside &&
      o.colliders.every(
        (c) =>
          keepOut.every((k) => dist(c, k.p) > c.r + k.r) &&
          obstacles.every((p) => p.colliders.every((d) => dist(c, d) > c.r + d.r + DECOR_GAP)) &&
          decor.every((p) => p.colliders.every((d) => dist(c, d) > c.r + d.r + DECOR_GAP)),
      );
    if (!clear) continue;
    decor.push(o);
    n++;
  }

  const page: Page = {
    w: BASE_W,
    h: BASE_H,
    inset: PAGE_INSET,
    spawn: { ...spawn },
    obstacles: [...obstacles, ...decor],
    index: -1,
    entry: { ...spawn },
    entrySide: 'b',
    entryCorner: null,
    torn: spec.torn,
    exit: { side: spec.exit[0] === 't' ? 't' : 'b', corner: spec.exit, x: exitPt.x, y: exitPt.y },
    hasKiosk: false,
    base: { layout, stations, props, hole },
  };
  // a decor piece that would shut a way is dropped (the placement rules make this a safety net)
  while (unreachableGoals(page).length > 0 && decor.length > 0) {
    const gone = decor.pop();
    page.obstacles = page.obstacles.filter((o) => o !== gone);
  }
  return page;
}

// ---------- the state of the base ----------

export function createBaseState(layout: BaseLayout, resume: Bookmark | null): BaseState {
  return { layout, accepted: false, resume, pending: null, noteCooldown: 0 };
}

/** The exit of the base page is locked until a ticket is accepted. */
export const exitLocked = (s: RunState): boolean => s.phase === 'base' && s.base?.accepted !== true;

/**
 * "Akceptuję regulamin" or "Wznów zgłoszenie": the exit opens. With a bookmark the exit leads to the bookmarked page and
 * the clock is restored on entry (`pageTurn.ts` `enterPage`); without, to the first page. False outside the base or when
 * the ticket was already accepted.
 */
export function acceptTicket(s: RunState, resume: Bookmark | null = null): boolean {
  const b = s.base;
  if (s.phase !== 'base' || !b || b.accepted) return false;
  b.accepted = true;
  b.resume = resume;
  b.pending = null;
  s.pageIndex = resume ? Math.min(s.pages.length - 1, Math.max(0, resume.pageIndex)) : 0;
  return true;
}

/** The ticket may be written in the Historia and the bookmark only while the run proper goes on. */
export const bookmarkAllowed = (s: RunState): boolean => s.phase === 'run';

// ---------- the stations ----------

/** The station whose tap target holds the world point (x, y), if any. `zoom` is css px per world unit. */
export function stationAt(page: Page, x: number, y: number, zoom = 1): Station | null {
  let best: Station | null = null;
  let bestD = Infinity;
  for (const st of page.base?.stations ?? []) {
    const d = Math.hypot(x - st.x, y - st.y);
    if (d <= tapRadius(st, zoom) && d < bestD) {
      best = st;
      bestD = d;
    }
  }
  return best;
}

/** The station nearest to `p` within the label range, if any. */
export function stationNear(page: Page, p: Vec): Station | null {
  let best: Station | null = null;
  let bestD = LABEL_RANGE;
  for (const st of page.base?.stations ?? []) {
    const d = dist(st, p);
    if (d <= bestD) {
      best = st;
      bestD = d;
    }
  }
  return best;
}

/** A tap at (x, y): remember the station for the walk there, or forget the old one on a tap elsewhere (`keep` leaves it alone). */
export function tapStation(s: RunState, x: number, y: number, zoom: number, keep = false): TappableStation | null {
  const b = s.base;
  if (s.phase !== 'base' || !b) return null;
  const hit = stationAt(s.page, x, y, zoom);
  if (hit || !keep) b.pending = hit ? hit.id : null;
  return hit ? hit.id : null;
}

/** The tapped station once the player stands within range of it (clears the pending tap); null otherwise. */
export function stationReached(s: RunState): TappableStation | null {
  const b = s.base;
  if (!b?.pending) return null;
  const st = s.page.base?.stations.find((q) => q.id === b.pending);
  if (!st || dist(st, s.player) > LABEL_RANGE) return null;
  b.pending = null;
  s.player.target = null;
  return st.id;
}

/** Per step in the base: open a reached station, watch the exit. No clock, no laws, no spawns. */
export function tickBase(s: RunState, bus: Bus, dt: number): void {
  const b = s.base;
  if (s.phase !== 'base' || !b || s.turning) return;
  b.noteCooldown = Math.max(0, b.noteCooldown - dt);
  const reached = stationReached(s);
  if (reached) {
    bus.emit('station:opened', { station: reached });
    return;
  }
  const page = s.page;
  if (!page.exit || !atExit(page, s.player)) return;
  if (b.accepted) {
    s.turning = true;
    s.player.target = null;
    bus.emit('page:turn', { from: -1, to: s.pageIndex });
  } else if (b.noteCooldown <= 0) {
    b.noteCooldown = 4;
    bus.emit('margin:note', { text: t('screens.base.exitLocked'), x: s.player.x, y: s.player.y - 34, ttl: 1800 });
  }
}

// ---------- the Asystent's arrival note ----------

/** The i18n key of the arrival footnote: three variants per layout, chosen by the planet seed. */
export function arrivalKey(seed: number, layout: BaseLayout): string {
  return `screens.base.arrival.${layout}.${createRng(seed).fork('arrival').int(0, 2)}`;
}
