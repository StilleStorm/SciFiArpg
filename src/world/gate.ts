/**
 * Page gates (S11a, DESIGN 4): a story lock is terrain, never the base exit. A page may carry a `gate`: a drawn obstacle
 * (an inked barrier across the exit corner, kind 'gate') that stays until its condition holds. Kinds: 'boss' (the boss of the
 * page is beaten), 'teczka' (teczki have been taken), 'quest' (a side ticket is done, by id). Pure data and functions here;
 * `pageTurn.ts tickPageTurn` applies the results (lift, footnote, redraw). Data comes from `PlanetDef.gates` (none yet) or
 * `installGate` (the test hook's fixture).
 */
import type { Bus } from '../core/events';
import { dist } from '../core/vec';
import { colliders, type Obstacle, type Page } from './pages';
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

/** Teczki taken so far on the run. */
export const teczkiTaken = (s: Pick<RunState, 'pages'>): number => s.pages.reduce((n, p) => n + (p.content ?? []).filter((c) => c.kind === 'teczka' && c.opened).length, 0);

/** True while the gate still blocks. */
export function gateHolds(s: RunState, g: PageGate): boolean {
  switch (g.kind) {
    case 'boss':
      return g.beaten !== true;
    case 'teczka':
      return teczkiTaken(s) < (g.need ?? 1);
    case 'quest':
      return !questsOf(s).log.includes(g.id ?? '');
  }
}

/** The barrier: an arc of colliders across the exit corner (see `colliders` in pages.ts for the shape). */
export function gateObstacle(page: Page): Obstacle | null {
  const e = page.exit;
  if (!e) return null;
  const o: Obstacle = { kind: 'gate', x: e.x, y: e.y, size: GATE_RADIUS, rot: 0, seed: 4177 + page.index * 31, colliders: [] };
  o.colliders = colliders(o);
  return o;
}

/** Put a gate on a page. False when the page has no exit corner or already carries a gate. */
export function installGate(page: Page, gate: PageGate): boolean {
  if (page.gate) return false;
  const o = gateObstacle(page);
  if (!o) return false;
  page.gate = { ...gate };
  page.obstacles.push(o);
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
