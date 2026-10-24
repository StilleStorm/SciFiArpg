/**
 * Page gates (S11a, DESIGN 4): a story lock is terrain, never the base exit. A page may carry a `gate`: a drawn obstacle
 * (an inked barrier across the exit corner, kind 'gate') that stays until its condition holds. Kinds: 'boss' (the boss of the
 * page is beaten), 'teczka' (teczki have been taken), 'quest' (a side ticket is done, by id). Pure data and functions here;
 * `pageTurn.ts tickPageTurn` applies the results (lift, footnote, redraw). Data comes from `PlanetDef.gates` (none yet) or
 * `installGate` (the test hook's fixture).
 */
import type { Bus } from '../core/events';
import { createRng } from '../core/rng';
import { dist } from '../core/vec';
import { t } from '../i18n';
import { reachableCells } from './base';
import { CONTENT } from './contentKinds';
import { colliders, PAGE_H, PAGE_W, type Obstacle, type Page } from './pages';
import { questsOf } from './quests';
import type { RunState } from './run';

export type GateKind = 'boss' | 'teczka' | 'quest';

export interface PageGate {
  kind: GateKind;
  /** quest: the id of the side ticket that must be done. */
  id?: string;
  /** teczka: how many teczki must have been taken on the run (default 1). */
  need?: number;
  /** The i18n key of the Asystent's footnote that names the condition; default `screens.base.gate.<kind>`. */
  key?: string;
  /** teczka: the page carries one forced "key" folder (`placeKeyTeczka`) and only its opening lifts the gate, not any folder. */
  keyTeczka?: boolean;
  /** How the barrier is drawn: absent = the hatched tape band; 'parcels' = a wall of parcels two deep with a gap for the figure. */
  look?: 'parcels';
  /** The i18n key of the footnote written when the gate lifts; default `screens.base.gate.lifted`. */
  liftKey?: string;
  /** A figure standing at the gap (render/npc.ts primitive, `look` seeds it): a tap writes the one line `key` as a footnote. */
  figure?: { look: number; key: string };
  /** boss: set when the page's boss fell (`bindGates`). */
  beaten?: boolean;
  /** Run time before which the footnote is not written again. */
  noteAt?: number;
}

/** A gate placed on a page of a planet (`PlanetDef.gates`). */
export interface PlanetGate {
  /** 0-based page of the run; the boss page has no exit and cannot carry a gate. */
  page: number;
  gate: PageGate;
}

/** Radius of the barrier around the exit corner: the exit radius (100) stays out of the player's reach behind it. */
export const GATE_RADIUS = 150;
/** The footnote is written when the player comes this close to the blocked corner, and at most this often (seconds). */
export const GATE_NOTE_DIST = 300;
export const GATE_NOTE_EVERY = 14;

export const gateKey = (g: PageGate): string => g.key ?? `screens.base.gate.${g.kind}`;
export const gateLiftKey = (g: PageGate): string => g.liftKey ?? 'screens.base.gate.lifted';

/** Where the figure of a gated page stands: on the barrier arc, on the diagonal of the exit corner (the gap of the wall). */
export function gateFigureAt(page: Page): { x: number; y: number } | null {
  const e = page.exit;
  if (!e || !page.gate?.figure) return null;
  const fx = e.x < PAGE_W / 2 ? 1 : -1;
  const fy = e.y < PAGE_H / 2 ? 1 : -1;
  const k = GATE_RADIUS / Math.SQRT2;
  return { x: e.x + fx * k, y: e.y + fy * k };
}

/** The tap box of the figure (world units, around its body). */
export const GATE_FIGURE_TAP = 62;

/** Teczki taken so far on the run. */
export const teczkiTaken = (s: Pick<RunState, 'pages'>): number => s.pages.reduce((n, p) => n + (p.content ?? []).filter((c) => c.kind === 'teczka' && c.opened).length, 0);

/** True while the gate still blocks. */
export function gateHolds(s: RunState, g: PageGate): boolean {
  switch (g.kind) {
    case 'boss':
      return g.beaten !== true;
    case 'teczka':
      if (g.keyTeczka) return !(s.page.content ?? []).some((c) => c.kind === 'teczka' && c.key === true && c.opened);
      return teczkiTaken(s) < (g.need ?? 1);
    case 'quest':
      return !questsOf(s).log.includes(g.id ?? '');
  }
}

/** The barrier: an arc of colliders across the exit corner (see `colliders` in pages.ts for the shape). */
export function gateObstacle(page: Page, look?: string): Obstacle | null {
  const e = page.exit;
  if (!e) return null;
  const o: Obstacle = { kind: 'gate', x: e.x, y: e.y, size: GATE_RADIUS, rot: 0, seed: 4177 + page.index * 31, colliders: [], ...(look ? { variant: look } : {}) };
  o.colliders = colliders(o);
  return o;
}

/** Put a gate on a page. False when the page has no exit corner or already carries a gate. */
export function installGate(page: Page, gate: PageGate): boolean {
  if (page.gate) return false;
  const o = gateObstacle(page, gate.look);
  if (!o) return false;
  page.gate = { ...gate };
  page.obstacles.push(o);
  if (gate.keyTeczka) placeKeyTeczka(page);
  return true;
}

/**
 * The forced folder of a keyed gate: the page's own teczki are taken away and one key folder is put where the player can walk
 * to it (clear of every obstacle, the entry and the exit, reachable from the entry). Placed from the page's seeds, so a seed lays it
 * the same way every time. Returns it, or null when the page has no room (then the gate is not keyed and any folder lifts it).
 */
export function placeKeyTeczka(page: Page): { x: number; y: number } | null {
  const r = createRng(page.obstacles.reduce((a, o) => (a ^ Math.imul(o.seed | 0, 2654435761)) >>> 0, 0x6b657921 + page.index));
  const reach = reachableCells(page, page.entry, 20);
  const rad = CONTENT.teczkaR;
  const others = (page.content ?? []).filter((c) => c.kind !== 'teczka');
  const free = (x: number, y: number, pad: number): boolean =>
    page.obstacles.every((o) => o.colliders.every((c) => dist(c, { x, y }) > c.r + rad + pad)) &&
    dist({ x, y }, page.entry) > 300 &&
    (!page.exit || dist({ x, y }, page.exit) > 380) &&
    others.every((c) => dist(c, { x, y }) > 120) &&
    reach.some((c) => dist(c, { x, y }) < 40);
  for (let tries = 0; tries < 800; tries++) {
    const x = r.range(180, PAGE_W - 180);
    const y = r.range(220, PAGE_H - 180);
    if (!free(x, y, tries < 400 ? 40 : 14)) continue;
    page.content = [...others, { kind: 'teczka', id: page.index * 100 + 90, x, y, seed: r.int(1, 1e6), opened: false, key: true }];
    return { x, y };
  }
  if (page.gate) page.gate.keyTeczka = false;
  return null;
}

/** A tap at world (x, y) on the figure of the gated page: its one line goes to the footnote. True when it hit. */
export function tapGateFigure(s: RunState, bus: Bus, x: number, y: number): boolean {
  const g = s.page.gate;
  const at = gateFigureAt(s.page);
  if (!g?.figure || !at || Math.hypot(x - at.x, y - at.y) > GATE_FIGURE_TAP) return false;
  bus.emit('footnote', { text: t(g.figure.key) });
  return true;
}

/** Take the gate off the page (obstacle and flag). */
export function liftGate(page: Page): boolean {
  if (!page.gate) return false;
  delete page.gate;
  page.obstacles = page.obstacles.filter((o) => o.kind !== 'gate');
  return true;
}

/** Put the gates of a planet on its pages. */
export function applyPlanetGates(pages: Page[], gates: readonly PlanetGate[] | undefined): void {
  for (const g of gates ?? []) {
    const page = pages[g.page];
    if (page) installGate(page, g.gate);
  }
}

/**
 * Per step on the current page: 'lifted' once when the condition holds (the gate is taken off here), 'note' when the player is
 * at the blocked corner and the footnote is due, else null.
 */
export function stepGate(s: RunState): 'lifted' | 'note' | null {
  const g = s.page.gate;
  if (!g) return null;
  if (!gateHolds(s, g)) {
    liftGate(s.page);
    return 'lifted';
  }
  const e = s.page.exit;
  if (e && dist(s.player, e) < GATE_NOTE_DIST && s.time >= (g.noteAt ?? 0)) {
    g.noteAt = s.time + GATE_NOTE_EVERY;
    return 'note';
  }
  return null;
}

/** The boss of the gated page fell: the 'boss' gate of the page it fell on opens. Returns the unbind function. */
export function bindGates(bus: Bus, getState: () => RunState | null): () => void {
  return bus.on('boss:died', () => {
    const g = getState()?.page.gate;
    if (g?.kind === 'boss') g.beaten = true;
  });
}
