import type { Bus } from './core/events';
import type { Entity } from './entities';
import type { Input } from './input';
import { t } from './i18n';
import type { Camera } from './render/camera';
import { bindEnemyFx, enemyBuilder } from './render/enemyFigures';
import { createViews, type Views } from './render/view';
import { groundBuilders } from './render/figures';
import { drawPage } from './render/obstacles';
import { onPageEntered } from './world/laws';
import { headerFor, tapKiosk } from './world/pageTurn';
import { tapMark } from './render/ink';
import type { Stage } from './render/stage';
import { createSim } from './systems/step';
import { installItems } from './items/install';
import { createRun, type RunOptions, type RunState } from './world/run';
import { createHeroLayer, type HeroLayer } from './heroes/layer';
import { heroBuilders, wrapEnemyBuilder } from './render/heroFigures';
import { bindHeroFx, zoneBuilder } from './render/heroFx';
import { createExitReveal } from './render/exitReveal';
import { updateBubbleFocus } from './render/bubbleFocus';

export interface Game {
  readonly state: RunState | null;
  readonly views: Views;
  /** Hero skills, update form and death forms (heroes/layer.ts). */
  readonly hero: HeroLayer;
  start(seed: number, opts?: RunOptions): RunState;
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
export function createGame(stage: Stage, bus: Bus, camera: Camera, input: Input): Game {
  const views = createViews(stage.world, {
    ...groundBuilders,
    ...heroBuilders,
    enemy: wrapEnemyBuilder(enemyBuilder),
    zone: zoneBuilder,
  });
  const hero = createHeroLayer({ root: stage.ui, bus, views, input, getState: () => state });
  bindHeroFx(bus, stage.fx);
  bindEnemyFx(bus);
  const exits = createExitReveal(stage.page);
  const sim = createSim(bus);
  installItems(stage.ui, bus, () => state);
  const ents: Entity[] = [];
  let state: RunState | null = null;
  let pausedByGame = false;

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
    start(seed, opts) {
      const s = createRun(seed, opts);
      pausedByGame = false;
      state = s;
      hero.onStart(s);
      views.clear();
      stage.fx.replaceChildren();
      drawPage(stage.page, s.page, headerFor(s));
      camera.snap(s.player.x, s.player.y);
      camera.apply();
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
      if (s.status !== 'running') input.setEnabled(false);
    },
    render(dtSec) {
      const s = state;
      if (!s) return;
      ents.length = 0;
      ents.push(s.player);
      for (const e of s.enemies) ents.push(e);
      for (const k of s.pickups) ents.push(k);
      for (const p of s.projectiles) ents.push(p);
      for (const m of s.summons) ents.push(m);
      for (const z of s.zones) ents.push(z);
      hero.frame(s);
      exits.frame(s);
      updateBubbleFocus(s.enemies, s.player);
      views.sync(ents, s.time * 1000);
      camera.follow(s.player.x, s.player.y, dtSec);
      camera.apply();
    },
    onTap(clientX, clientY, walk = true) {
      const s = state;
      if (!s || s.status !== 'running' || s.modal || s.turning) return;
      const w = camera.screenToWorld(clientX, clientY);
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
