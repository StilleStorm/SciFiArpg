/**
 * Tunel serwisowy, the town portal (DESIGN 4.1). State and rules; the drawing is render/tunnelFx.ts, the trip to the base
 * and back is main.ts.
 *
 * One tunnel at a time, in `RunState.tunnel`. The pure part (`planOpen`, `stepTunnel`, `closeFor`, `fateOfHeldRun`,
 * `createRunHold`) takes plain data and returns plain data, so the rules are tested without a run. The thin part
 * (`openTunnel`, `closeTunnel`, `tickTunnel`, `bindTunnel`) applies them to a run and the bus.
 *
 * The tunnel lives inside one session and is never saved: the exact-state return holds the same RunState object in
 * memory while the player is in the base (`createRunHold`), nothing is serialised.
 */
import type { Bus, TunnelCloseReason } from '../core/events';
import { t } from '../i18n';
import { recomputeStats } from '../items/stats';
import { highestNumber, type Character } from '../save/character';
import type { RunState } from './run';

/** The player is on the hole when closer than this (world units). */
export const ENTER_R = 28;

export interface Tunnel {
  x: number;
  y: number;
  /** The page the hole is cut in (0-based). It cannot be reached from another page. */
  pageIndex: number;
  /**
   * False from the moment the tunnel is cut at the player's feet until he has stepped out of the hole once; only an
   * armed tunnel takes him in. Without it the tunnel would swallow the player the instant it opens.
   */
  armed: boolean;
}

export interface Point {
  x: number;
  y: number;
}

// ---------- open / replace ----------

/** Cutting a tunnel at `at`: the new one, and the old one it replaces (closed by tape), if there was one. */
export function planOpen(prev: Tunnel | undefined, at: Point, pageIndex: number): { tunnel: Tunnel; replaced: Tunnel | null } {
  return { tunnel: { x: at.x, y: at.y, pageIndex, armed: false }, replaced: prev ?? null };
}

// ---------- entering ----------

/** The player stands on the hole. */
export function isOnHole(tunnel: Pick<Tunnel, 'x' | 'y'>, p: Point): boolean {
  return Math.hypot(p.x - tunnel.x, p.y - tunnel.y) < ENTER_R;
}

/**
 * One step of the walk-in rule. `enter` is true on the step the player walks onto an armed hole of the page he is on;
 * a hole on another page never takes him. Returns the tunnel as it stands afterwards (armed once the player is off it).
 */
export function stepTunnel(tunnel: Tunnel, p: Point, pageIndex: number): { tunnel: Tunnel; enter: boolean } {
  if (tunnel.pageIndex !== pageIndex) return { tunnel, enter: false };
  const on = isOnHole(tunnel, p);
  if (on && tunnel.armed) return { tunnel, enter: true };
  if (!on && !tunnel.armed) return { tunnel: { ...tunnel, armed: true }, enter: false };
  return { tunnel, enter: false };
}

// ---------- closing ----------

/** What happens to the run (or the tunnel) that closes a tunnel. */
export type CloseTrigger = 'open' | 'death' | 'runEnd' | 'abandon' | 'pageTurn' | 'return';

/** Why a tunnel closes, by what happened. Opening another closes the first; a death, the end of the run, leaving the ticket, or turning the page also close it. */
export function closeFor(trigger: CloseTrigger): TunnelCloseReason {
  switch (trigger) {
    case 'open':
      return 'second';
    case 'death':
      return 'death';
    case 'runEnd':
    case 'abandon':
      return 'end';
    case 'pageTurn':
      return 'page';
    case 'return':
      return 'return';
  }
}

/** A hole that is left behind when the player turns the page can never be reached again, so the turn closes it. */
export const closesOnPage = (tunnel: Pick<Tunnel, 'pageIndex'>, enteredPage: number): boolean => tunnel.pageIndex !== enteredPage;

/** The closing is repaired with tape (visible) or only rubbed out (the page or the run is going away anyway). */
export const repairedWithTape = (reason: TunnelCloseReason): boolean => reason === 'return' || reason === 'second' || reason === 'death';

// ---------- the held run ----------

/** What the player does in the base while a run is held, and what becomes of the held run. */
export type LeaveAction = 'return' | 'settings' | 'newTicket' | 'resumeBookmark' | 'changeHero';
/**
 * none      no run is held
 * continue  go back into the held run, exactly as it was
 * keep      the player only looked at another form; the run stays held
 * settle    the held run is given up: character saved, bookmarked like Zakończ so it can be resumed from the base
 */
export type HeldFate = 'none' | 'continue' | 'keep' | 'settle';

export function fateOfHeldRun(held: boolean, action: LeaveAction): HeldFate {
  if (!held) return 'none';
  if (action === 'return') return 'continue';
  if (action === 'settings') return 'keep';
  return 'settle';
}

export interface RunHold<R extends object> {
  /** Keep this very object. */
  hold(run: R): void;
  /** Give it back (the same object, not a copy) and forget it. */
  take(): R | null;
  peek(): R | null;
  readonly held: boolean;
}

/** The holder of the one run that waits while the player is in the base. It never copies: `take()` returns what `hold()` was given. */
export function createRunHold<R extends object>(): RunHold<R> {
  let run: R | null = null;
  return {
    hold(r) {
      run = r;
    },
    take() {
      const r = run;
      run = null;
      return r;
    },
    peek: () => run,
    get held() {
      return run !== null;
    },
  };
}

/**
 * The base has a shop: what the player bought or sold there is in the saved character. When he walks back into the held
 * run, his purse, bag and gear are taken from it (stats recomputed, racja kept), so the next save does not undo the trip.
 * Returns false, and touches nothing, when the character holds exactly what the run holds (the usual case).
 */
export function carryPurse(s: RunState, c: Character | undefined): boolean {
  const p = s.player;
  if (!c || c.heroId !== p.heroId) return false;
  const same = p.gwiazdki === c.gwiazdki && JSON.stringify(p.inventory) === JSON.stringify(c.inventory) && JSON.stringify(p.equipment) === JSON.stringify(c.equipment);
  if (same) return false;
  const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
  p.gwiazdki = c.gwiazdki;
  p.inventory = copy(c.inventory);
  p.equipment = copy(c.equipment);
  recomputeStats(p);
  s.nextItemNumber = Math.max(s.nextItemNumber, highestNumber(c) + 1);
  return true;
}

// ---------- applying the rules to a run ----------

/** Cut a tunnel at the player's feet. Replaces (and closes) an open one. False when nothing can be cut now (sheet, form, page turn, dead). */
export function openTunnel(s: RunState, bus: Bus): boolean {
  if (s.status !== 'running' || s.modal || s.turning || s.player.hp <= 0) return false;
  const plan = planOpen(s.tunnel, s.player, s.pageIndex);
  if (plan.replaced) closeTunnel(s, bus, closeFor('open'));
  s.tunnel = plan.tunnel;
  bus.emit('tunnel:opened', { x: plan.tunnel.x, y: plan.tunnel.y, pageIndex: plan.tunnel.pageIndex });
  return true;
}

/** Close the open tunnel for `reason`; false when there was none. */
export function closeTunnel(s: RunState | null, bus: Bus, reason: TunnelCloseReason): boolean {
  if (!s?.tunnel) return false;
  delete s.tunnel;
  bus.emit('tunnel:closed', { reason });
  return true;
}

/** Per step (systems/step.ts): arm the hole, and report `tunnel:entered` on the step the player walks onto it. */
export function tickTunnel(s: RunState, bus: Bus): void {
  const tn = s.tunnel;
  if (!tn || s.turning || s.modal || s.status !== 'running') return;
  const r = stepTunnel(tn, s.player, s.pageIndex);
  s.tunnel = r.tunnel;
  if (r.enter) bus.emit('tunnel:entered');
}

/**
 * Events that close a tunnel by themselves (death, the end of the run, the page turn) and the Asystent's notes on
 * opening and on the return. Register before main.ts listens to `run:ended`, which drops the state. Returns the unbind function.
 */
export function bindTunnel(bus: Bus, getState: () => RunState | null): () => void {
  const offs = [
    bus.on('tunnel:opened', () => bus.emit('footnote', { text: t('ui.note.tunnelOpened') })),
    bus.on('tunnel:closed', (e) => {
      if (e.reason === 'return') bus.emit('footnote', { text: t('ui.note.tunnelClosed') });
    }),
    bus.on('player:died', () => void closeTunnel(getState(), bus, closeFor('death'))),
    bus.on('run:ended', () => void closeTunnel(getState(), bus, closeFor('runEnd'))),
    bus.on('page:entered', (e) => {
      const s = getState();
      if (s?.tunnel && closesOnPage(s.tunnel, e.index)) closeTunnel(s, bus, closeFor('pageTurn'));
    }),
  ];
  return () => {
    for (const off of offs) off();
  };
}
