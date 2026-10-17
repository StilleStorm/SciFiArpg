import type { Bus } from './core/events';
import type { Entity } from './entities';
import type { Input } from './input';
import { t } from './i18n';
import type { Camera } from './render/camera';
import { bindEnemyFx, enemyBuilder } from './render/enemyFigures';
import { createViews, type Views } from './render/view';
import { placeholderBuilders } from './render/figures';
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

export interface Game {
  readonly state: RunState | null;
  readonly views: Views;
  /** Hero skills, update form and death forms (heroes/layer.ts). */
  readonly hero: HeroLayer;
  start(seed: number, opts?: RunOptions): RunState;
  /** Leave the run: the views and the page are cleared and input is off. */
  stop(): void;
  update(dt: number): void;
  render(dtSec: number): void;
  onTap(clientX: number, clientY: number): void;
}

/** Ties run state to the stage: simulation step, view sync, camera. Owns no rules. */
export function createGame(stage: Stage, bus: Bus, camera: Camera, input: Input): Game {
  const views = createViews(stage.world, {
    ...placeholderBuilders,
    ...heroBuilders,
    enemy: wrapEnemyBuilder(enemyBuilder),
    zone: zoneBuilder,
  });
  const hero = createHeroLayer({ root: stage.ui, bus, views, input, getState: () => state });
  bindHeroFx(bus, stage.fx);
  bindEnemyFx(bus);
  const sim = createSim(bus);
  installItems(stage.ui, bus, () => state);
  const ents: Entity[] = [];
  let state: RunState | null = null;

  const game: Game = {
    get state() {
      return state;
    },
    views,
    hero,
    start(seed, opts) {
      const s = createRun(seed, opts);
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
      bus.emit('page:entered', { index: 0, count: s.pageCount });
      return s;
    },
    stop() {
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
      views.sync(ents, s.time * 1000);
      camera.follow(s.player.x, s.player.y, dtSec);
      camera.apply();
    },
    onTap(clientX, clientY) {
      const s = state;
      if (!s || s.status !== 'running' || s.modal || s.turning) return;
      const w = camera.screenToWorld(clientX, clientY);
      s.player.target = w;
      tapMark(w.x, w.y);
      tapKiosk(s, w.x, w.y);
      bus.emit('player:tap', { x: w.x, y: w.y });
    },
  };
  return game;
}
