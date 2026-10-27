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
import { planetDef } from './campaign';
import { atExit, colliders, PAGE_INSET, type Circle, type Corner, type Obstacle, type ObstacleKind, type Page } from './pages';
import type { RunState } from './run';

/** The base page is smaller than the run pages: about one screen. */
export const BASE_W = 900;
export const BASE_H = 700;
/** Every station must be reachable on foot to within this many world units (the reachability checks; walking up opens nothing). */
export const LABEL_RANGE = 90;
/** The tap target of a station is at least this many css pixels across and high. */
export const TAP_PX = 44;
/** The station labels are set in this type size on the screen, whatever the zoom (css px). */
export const LABEL_PX = 12;
/** Collision radius used for the reachability checks (the player's). */
export const WALK_R = 13;

export type BaseLayout = 'ladowisko' | 'wioska' | 'miasteczko';
export const BASE_LAYOUTS: readonly BaseLayout[] = ['ladowisko', 'wioska', 'miasteczko'];
/** The stations that open a sheet. The tunnel is a hole, not a station: the player walks into it. */
export type TappableStation = 'biurko' | 'kiosk' | 'tablica' | 'paczkomat' | 'urzednik' | 'przystanek';
export type StationId = TappableStation | 'tunel';
export const STATIONS: readonly TappableStation[] = ['biurko', 'kiosk', 'tablica', 'paczkomat', 'urzednik', 'przystanek'];

export interface Station {
  id: TappableStation;
  x: number;
  y: number;
}

/** A rectangle relative to a station's centre, in world units. */
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The drawn object of each station (the extent of `render/stations.ts`), relative to its centre: the tap target. */
export const STATION_BOX: Record<TappableStation, Box> = {
  biurko: { x0: -68, y0: -52, x1: 68, y1: 52 },
  kiosk: { x0: -60, y0: -46, x1: 60, y1: 42 },
  tablica: { x0: -60, y0: -58, x1: 60, y1: 26 },
  paczkomat: { x0: -26, y0: -76, x1: 26, y1: 54 },
  // the clerk (world/npc.ts, render/npc.ts): a standing figure with a stack of forms and a raised stamp
  urzednik: { x0: -34, y0: -76, x1: 34, y1: 56 },
  // the stop board (render/stop.ts drawStopBoard): a post with three arrow plates and a struck-out timetable (S21a)
  przystanek: { x0: -40, y0: -92, x1: 40, y1: 14 },
};

/** Where the margin-note label hangs: this far under the station's centre (world units), centred on it. */
export const LABEL_DY: Record<TappableStation, number> = { biurko: 60, kiosk: 50, tablica: 32, paczkomat: 60, urzednik: 62, przystanek: 30 };
/** The label takes this many css px per character (Space Mono at `LABEL_PX`) and is this high (text and underline). */
export const LABEL_CHAR_PX = 7.2;
export const LABEL_H_PX = 20;

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
  /** A bookmarked ticket the exit leads back into: the page index is `RunState.pageIndex`, the clock is restored on entry. */
  resume: Bookmark | null;
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
      urzednik: { x: 130, y: 380 },
      przystanek: { x: 815, y: 330 },
    },
    props: [
      { kind: 'scorch', x: 190, y: 550 },
      { kind: 'leg', x: 95, y: 595 },
      { kind: 'flag', x: 260, y: 640 },
    ],
  },
  // huts around a lane
  wioska: {
    spawn: { x: 390, y: 610 },
    exit: 'bl',
    torn: 'tr',
    hole: { x: 590, y: 625 },
    stations: {
      kiosk: { x: 250, y: 340 },
      biurko: { x: 440, y: 330 },
      tablica: { x: 640, y: 280 },
      paczkomat: { x: 770, y: 495 },
      urzednik: { x: 500, y: 565 },
      przystanek: { x: 650, y: 612 },
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
      urzednik: { x: 220, y: 480 },
      przystanek: { x: 590, y: 560 },
    },
    props: [
      { kind: 'square', x: 450, y: 420 },
      { kind: 'house', x: 80, y: 335 },
      { kind: 'house', x: 830, y: 330 },
    ],
  },
};

/** Which layout a planet seed gets: out of the planet's `baseLayouts` when the planet is known, else any of the three. */
export function layoutForSeed(seed: number, planet?: number): BaseLayout {
  const pool = planet === undefined ? BASE_LAYOUTS : planetDef(planet).baseLayouts;
  return createRng(seed).fork('base-layout').pick(pool.length > 0 ? pool : BASE_LAYOUTS);
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
    case 'urzednik':
      return [{ x: 0, y: -42, r: 11 }, { x: 0, y: -4, r: 17 }, { x: 0, y: 34, r: 12 }];
    case 'przystanek':
      return [{ x: 0, y: 0, r: 11 }, { x: 0, y: -34, r: 8 }];
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

/** A rectangle grown (never shrunk) to at least `TAP_PX` css pixels each way for a view that shows `zoom` css px per unit. */
function grown(b: Box, zoom: number): Box {
  const need = TAP_PX / Math.max(0.2, zoom);
  const gx = Math.max(0, (need - (b.x1 - b.x0)) / 2);
  const gy = Math.max(0, (need - (b.y1 - b.y0)) / 2);
  return { x0: b.x0 - gx, y0: b.y0 - gy, x1: b.x1 + gx, y1: b.y1 + gy };
}

/** The label of a station as printed (upper case, as the HUD labels are). */
export const labelText = (id: TappableStation): string => t(`screens.base.station.${id}`).toLocaleUpperCase('pl-PL');

/** The label's rectangle relative to the station's centre, for a view that shows `zoom` css px per unit. */
export function labelBox(id: TappableStation, zoom: number): Box {
  const z = Math.max(0.2, zoom);
  const half = (labelText(id).length * LABEL_CHAR_PX + 10) / 2 / z;
  return { x0: -half, y0: LABEL_DY[id], x1: half, y1: LABEL_DY[id] + LABEL_H_PX / z };
}

/** The tap target of the drawn object of a station (at least 44 x 44 css px), relative to its centre. */
export const stationBox = (st: Pick<Station, 'id'>, zoom: number): Box => grown(STATION_BOX[st.id], zoom);
/** The tap target of its label (the same size rule). */
export const stationLabelBox = (st: Pick<Station, 'id'>, zoom: number): Box => grown(labelBox(st.id, zoom), zoom);

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

/** What a base page must offer a player who stands at its spawn: every station within walking range, the exit, the hole. */
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
export function generateBase(seed: number, planet?: number): Page {
  const layout = layoutForSeed(seed, planet);
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
    return { id, x: p.x, y: p.y };
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
    // the margin-note labels of the stations hang under them (they stay clear of the decor)
    ...stations.map((st) => ({ p: { x: st.x, y: st.y + LABEL_DY[st.id] + 12 }, r: 48 })),
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
  return { layout, resume };
}

/**
 * The exit of the base is never locked: the base is entered with its ticket accepted. This (re)accepts the plan on the desk
 * (the form's button, a change of priority) or points the exit at a bookmark: with `resume` the exit leads to the
 * bookmarked page and the clock is restored on entry (`pageTurn.ts` `enterPage`); without, to the first page. False outside the base.
 */
export function acceptTicket(s: RunState, resume: Bookmark | null = s.base?.resume ?? null): boolean {
  const b = s.base;
  if (s.phase !== 'base' || !b) return false;
  b.resume = resume;
  s.pageIndex = resume ? Math.min(s.pages.length - 1, Math.max(0, resume.pageIndex)) : 0;
  return true;
}

/** The ticket may be written in the Historia and the bookmark only while the run proper goes on. */
export const bookmarkAllowed = (s: RunState): boolean => s.phase === 'run';

// ---------- the stations ----------

const within = (b: Box, st: Pick<Station, 'x' | 'y'>, x: number, y: number): boolean => x >= st.x + b.x0 && x <= st.x + b.x1 && y >= st.y + b.y0 && y <= st.y + b.y1;

/**
 * The station tapped at the world point (x, y), if any: its drawn object or its label, each grown to at least 44 x 44 css px.
 * `zoom` is css px per world unit. A tap anywhere on the screen opens it at once; walking into one is harmless.
 */
export function stationAt(page: Page, x: number, y: number, zoom = 1): Station | null {
  let best: Station | null = null;
  let bestD = Infinity;
  for (const st of page.base?.stations ?? []) {
    if (!within(stationBox(st, zoom), st, x, y) && !within(stationLabelBox(st, zoom), st, x, y)) continue;
    const d = Math.hypot(x - st.x, y - st.y);
    if (d < bestD) {
      best = st;
      bestD = d;
    }
  }
  return best;
}

/** Per step in the base: watch the exit. No clock, no laws, no spawns. */
export function tickBase(s: RunState, bus: Bus, _dt: number): void {
  const b = s.base;
  if (s.phase !== 'base' || !b || s.turning) return;
  const page = s.page;
  if (!page.exit || !atExit(page, s.player)) return;
  s.turning = true;
  s.player.target = null;
  bus.emit('base:exit'); // main.ts settles a run held in the tunnel, as starting another ticket does
  bus.emit('page:turn', { from: -1, to: s.pageIndex });
}

// ---------- the Asystent's arrival note ----------

/** The i18n key of the arrival footnote: three variants per layout, chosen by the planet seed. */
export function arrivalKey(seed: number, layout: BaseLayout): string {
  return `screens.base.arrival.${layout}.${createRng(seed).fork('arrival').int(0, 2)}`;
}
