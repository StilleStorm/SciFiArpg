import type { Bus } from './core/events';
import type { Entity } from './entities';
import type { Input } from './input';
import { t } from './i18n';
import type { Camera } from './render/camera';
import { bindEnemyFx, enemyBuilder } from './render/enemyFigures';
import { createViews, type Views } from './render/view';
import { groundBuilders } from './render/figures';
import { drawPage } from './render/obstacles';
import { drawBase, type BaseView } from './render/stations';
import { freeViewRect, portraitSpan, viewZoom } from './render/camera';
import { stationAt } from './world/base';
import { onPageEntered } from './world/laws';
import { baseHeaderFor, headerFor, tapKiosk } from './world/pageTurn';
import { stampsOnPage, tapMark } from './render/ink';
import type { Stage } from './render/stage';
import { createSim } from './systems/step';
import { installItems } from './items/install';
import { createRun, type RunOptions, type RunState } from './world/run';
import { createHeroLayer, type HeroLayer } from './heroes/layer';
import { heroBuilders, wrapEnemyBuilder } from './render/heroFigures';
import { bindHeroFx, zoneBuilder } from './render/heroFx';
import { createUltFx } from './render/ultFx';
import { createExitReveal } from './render/exitReveal';
import { updateBubbleFocus } from './render/bubbleFocus';

export interface Game {
  readonly state: RunState | null;
  readonly views: Views;
  /** Hero skills, update form and death forms (heroes/layer.ts). */
  readonly hero: HeroLayer;
  start(seed: number, opts?: RunOptions): RunState;
  /**
   * Make a run that was held (the service tunnel) the live state again: its page and entities are drawn anew, nothing in the
   * state changes. The caller resumes it (`resume()`), which needs the state to be 'paused' by this game's `pause()`.
   */
  adopt(s: RunState): void;
  /** Leave the run: the views and the page are cleared and input is off. */
  stop(): void;
  /** The pause sheet holds the run: status 'paused', input off, `game:paused {paused: true}`. False when a sheet or a form already holds it. */
  pause(): boolean;
  /** Take the run back exactly as it was (the same state object). False when this game did not pause it. */
  resume(): boolean;
  readonly paused: boolean;
  update(dt: number): void;
  render(dtSec: number): void;
  /** A tap on the page. `walk` false (joystick mode): do not walk there, only the kiosk and the bot hear it. */
  onTap(clientX: number, clientY: number, walk?: boolean): void;
}

/** Ties run state to the stage: simulation step, view sync, camera. Owns no rules. */
export function createGame(stage: Stage, bus: Bus, camera: Camera, input: Input, bounds?: { w: number; h: number }): Game {
  const views = createViews(stage.world, {
    ...groundBuilders,
    ...heroBuilders,
    enemy: wrapEnemyBuilder(enemyBuilder),
    zone: zoneBuilder,
  });
  const hero = createHeroLayer({ root: stage.ui, bus, views, input, getState: () => state });
  bindHeroFx(bus, stage.fx);
  const ultFx = createUltFx(stage.fx);
  bindEnemyFx(bus);
  const exits = createExitReveal(stage.page);
  const sim = createSim(bus);
  installItems(stage.ui, bus, () => state);
  const ents: Entity[] = [];
  /** Every entity of the run, in the order the views are layered. */
  const collect = (s: RunState): Entity[] => {
    ents.length = 0;
    ents.push(s.player);
    for (const e of s.enemies) ents.push(e);
    for (const k of s.pickups) ents.push(k);
    for (const p of s.projectiles) ents.push(p);
    for (const m of s.summons) ents.push(m);
    for (const z of s.zones) ents.push(z);
    return ents;
  };
  let state: RunState | null = null;
  let pausedByGame = false;
  /** Render clock for the base page (ms): the base does not advance `RunState.time`, which drives the figures' walk cycle in the run. */
  let animMs = 0;
  /** The drawn base page, while the state is in the base (labels, the exit, the header). */
  let baseView: BaseView | null = null;
  /** The camera's page bounds follow the page that is shown (the base page is smaller than the run's pages). */
  const fitBounds = (page: { w: number; h: number }): void => {
    if (!bounds) return;
    bounds.w = page.w;
    bounds.h = page.h;
  };
  bus.on('ticket:accepted', () => {
    if (state?.phase === 'base') baseView?.unlock(baseHeaderFor(state, portraitSpan(camera)));
  });

  const game: Game = {
    get state() {
      return state;
    },
    views,
    hero,
    get paused() {
      return pausedByGame;
    },
    pause() {
      const s = state;
      if (!s || pausedByGame || s.status !== 'running' || s.modal) return false;
      s.status = 'paused';
      pausedByGame = true;
      input.setEnabled(false);
      bus.emit('game:paused', { paused: true });
      return true;
    },
    resume() {
      const s = state;
      if (!s || !pausedByGame) return false;
      pausedByGame = false;
      if (s.status === 'paused') s.status = 'running';
      input.setEnabled(true);
      bus.emit('game:paused', { paused: false });
      return true;
    },
    adopt(s) {
      state = s;
      pausedByGame = s.status === 'paused';
      baseView = null;
      hero.onStart(s);
      views.clear();
      stage.world.replaceChildren();
      stage.fx.replaceChildren();
      fitBounds(s.page);
      camera.snap(s.player.x, s.player.y);
      camera.apply();
      drawPage(stage.page, s.page, headerFor(s, portraitSpan(camera)));
      views.sync(collect(s), s.time * 1000, { drawIn: false }); // they were on the page all along: no drawing in again
    },
    start(seed, opts) {
      const s = createRun(seed, opts);
      pausedByGame = false;
      state = s;
      hero.onStart(s);
      views.clear();
      stage.fx.replaceChildren();
      fitBounds(s.page);
      if (s.phase === 'base' && s.base) {
        // The base page of the planet: stations, no enemies, a locked exit. The run starts when the exit is walked through.
        baseView = drawBase(stage.page, s.page, { accepted: false, header: null });
        camera.snap(s.player.x, s.player.y);
        camera.apply();
        input.setEnabled(true);
        bus.emit('base:entered', { layout: s.base.layout, seed, number: s.ticket.number }); // the Asystent writes the arrival note
        return s;
      }
      baseView = null;
      camera.snap(s.player.x, s.player.y);
      camera.apply();
      drawPage(stage.page, s.page, headerFor(s, portraitSpan(camera)));
      input.setEnabled(true);
      bus.emit('run:started', { seed });
      bus.emit('stamp', { text: t('ui.run.stamp'), x: s.player.x, y: s.player.y - 120 });
      onPageEntered(s, bus);
      bus.emit('page:entered', { index: s.pageIndex, count: s.pageCount });
      // A resumed ticket is a new page from the seed handled by another consultant (DESIGN 4.1).
      if (opts?.resume) bus.emit('footnote', { text: t('ui.note.reassigned', { number: s.ticket.number }) });
      return s;
    },
    stop() {
      baseView = null;
      pausedByGame = false;
      input.setEnabled(false);
      views.clear();
      stage.world.replaceChildren();
      stage.fx.replaceChildren();
      state = null;
    },
    update(dt) {
      const s = state;
      if (!s || s.status !== 'running') return;
      const held = input.held();
      if (held) s.player.target = camera.screenToWorld(held.x, held.y);
      const steer = input.steer();
      if (steer) s.player.steer = steer;
      else delete s.player.steer;
      sim.step(s, dt);
      if (state === s && s.status !== 'running') input.setEnabled(false); // (a step that swapped the state — the tunnel, the end of a run — leaves the new one alone)
    },
    render(dtSec) {
      const s = state;
      if (!s) return;
      animMs += dtSec * 1000; // the base has no clock (s.time stays 0 there), so its figures animate on this one
      collect(s);
      hero.frame(s);
      ultFx.frame(s);
      if (s.phase === 'base') baseView?.frame(s);
      else {
        baseView = null; // the exit walked through: the base drawing went with the old sheet
        exits.frame(s);
        updateBubbleFocus(s.enemies, s.player, { view: freeViewRect(camera), hush: stampsOnPage() > 0 });
      }
      views.sync(ents, s.phase === 'base' ? animMs : s.time * 1000);
      camera.follow(s.player.x, s.player.y, dtSec);
      camera.apply();
    },
    onTap(clientX, clientY, walk = true) {
      const s = state;
      if (!s || s.status !== 'running' || s.modal || s.turning) return;
      const w = camera.screenToWorld(clientX, clientY);
      if (s.phase === 'base') {
        // A tap on a station (its drawn object or its label, at least 44 px) opens it at once, wherever the player stands, in
        // both steering modes. Walking into a station is harmless. A tap elsewhere walks there (tap mode only).
        const hit = stationAt(s.page, w.x, w.y, viewZoom());
        if (hit) {
          bus.emit('station:opened', { station: hit.id });
          return;
        }
        if (!walk) return;
        s.player.target = w;
        tapMark(w.x, w.y);
        bus.emit('player:tap', { x: w.x, y: w.y });
        return;
      }
      if (!walk) {
        // Joystick mode: a quick tap only matters on the kiosk (the player steers there himself).
        if (tapKiosk(s, w.x, w.y)) bus.emit('player:tap', { x: w.x, y: w.y });
        return;
      }
      s.player.target = w;
      tapMark(w.x, w.y);
      tapKiosk(s, w.x, w.y);
      bus.emit('player:tap', { x: w.x, y: w.y });
    },
  };
  return game;
}
